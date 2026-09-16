import json
import os
import time
from datetime import datetime
from typing import Dict, Tuple, List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from models import Station, Visit, OverrideRequest, ScheduleResponse
from optimizer import greedy_optimizer
from railradar_client import fetch_live_visits, RailRadarError


from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db, init_db
from db_models import OverrideRecord, AuditLogEntry

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "trains.json")
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")

# How long a RailRadar fetch stays valid before we hit the API again.
# RailRadar's free tier is 1,000 requests/month across the whole account —
# keep this generous. 1800s (30 min) x 3 stations = 6 calls/hour max.
CACHE_TTL_SECONDS = int(os.getenv("RAILRADAR_CACHE_TTL", "1800"))

app = FastAPI(title="TrainVision AI - Demo Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

with open(DATA_PATH) as f:
    raw = json.load(f)

STATIONS = [Station(**s) for s in raw["stations"]]
STATIC_VISITS = [Visit(**v) for v in raw["visits"]]

@app.on_event("startup")
def on_startup():
    init_db()


def load_overrides_dict(db: Session) -> Dict[Tuple[str, str], int]:
    rows = db.query(OverrideRecord).all()
    return {(r.train_id, r.station_id): r.platform for r in rows}

# Live-data cache. `source` is surfaced in API responses so the UI/demo can
# show whether we're looking at real RailRadar data or the offline fallback.
_cache = {"visits": None, "fetched_at": 0.0, "source": "not-fetched-yet", "error": None}


def get_current_visits(force_refresh: bool = False) -> List[Visit]:
    now = time.time()
    is_stale = _cache["visits"] is None or (now - _cache["fetched_at"] > CACHE_TTL_SECONDS)

    if force_refresh or is_stale:
        try:
            live_visits = fetch_live_visits([s.id for s in STATIONS])
            if not live_visits:
                raise RailRadarError("RailRadar returned no trains for any station")
            _cache.update(visits=live_visits, fetched_at=now, source="railradar", error=None)
        except RailRadarError as e:
            _cache["error"] = str(e)
            if _cache["visits"] is None:
                # No cached data at all yet (e.g. first request, no API key) —
                # fall back to the static demo dataset so the app never breaks.
                _cache.update(visits=STATIC_VISITS, fetched_at=now, source="static-fallback")
            # else: keep serving the last good cached data instead of static,
            # since it's more accurate than the hardcoded demo set.

    return _cache["visits"]


@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.now().isoformat()}


@app.get("/data-source")
def data_source():
    """Lets the frontend (and you, during the demo) show whether data is live or fallback."""
    return {
        "source": _cache["source"],
        "fetched_at": datetime.fromtimestamp(_cache["fetched_at"]).isoformat() if _cache["fetched_at"] else None,
        "cache_ttl_seconds": CACHE_TTL_SECONDS,
        "last_error": _cache["error"],
    }


@app.get("/stations", response_model=list[Station])
def get_stations():
    return STATIONS


@app.get("/trains", response_model=list[Visit])
def get_trains():
    return get_current_visits()


@app.get("/schedule", response_model=ScheduleResponse)
def get_schedule(db: Session = Depends(get_db)):
    visits = get_current_visits()
    overrides = load_overrides_dict(db)
    schedule, conflicts = greedy_optimizer(visits, STATIONS, overrides)
    return ScheduleResponse(schedule=schedule, conflicts=conflicts, generated_at=datetime.now().isoformat())


@app.get("/log")
def get_audit_log(db: Session = Depends(get_db)):
    """Returns the audit trail of override actions."""
    logs = db.query(AuditLogEntry).order_by(AuditLogEntry.timestamp.desc()).all()
    return logs


@app.post("/trains/refresh")
def refresh_trains():
    """Manually force a fresh RailRadar pull, bypassing the cache TTL. Use sparingly — counts
    against the monthly quota (3 calls per refresh, one per station)."""
    visits = get_current_visits(force_refresh=True)
    return {"source": _cache["source"], "count": len(visits), "last_error": _cache["error"]}


@app.post("/override", response_model=ScheduleResponse)
def apply_override(payload: OverrideRequest, db: Session = Depends(get_db)):
    station = next((s for s in STATIONS if s.id == payload.station_id), None)
    if station is None:
        raise HTTPException(status_code=404, detail="Unknown station")
    if not (1 <= payload.platform <= station.platforms):
        raise HTTPException(status_code=400, detail=f"{station.id} only has platforms 1-{station.platforms}")

    visits = get_current_visits()
    if not any(v.train_id == payload.train_id and v.station_id == payload.station_id for v in visits):
        raise HTTPException(status_code=404, detail="No such train visit at that station")

    # Upsert the override record
    record = db.query(OverrideRecord).filter_by(
        train_id=payload.train_id, 
        station_id=payload.station_id
    ).first()
    
    if record:
        record.platform = payload.platform
    else:
        record = OverrideRecord(
            train_id=payload.train_id, 
            station_id=payload.station_id, 
            platform=payload.platform
        )
        db.add(record)

    # Add audit log entry
    audit_entry = AuditLogEntry(
        action="OVERRIDE",
        detail=f"Set train {payload.train_id} at {payload.station_id} to platform {payload.platform}"
    )
    db.add(audit_entry)
    db.commit()

    overrides = load_overrides_dict(db)
    schedule, conflicts = greedy_optimizer(visits, STATIONS, overrides)
    return ScheduleResponse(schedule=schedule, conflicts=conflicts, generated_at=datetime.now().isoformat())


@app.post("/reset", response_model=ScheduleResponse)
def reset_overrides(db: Session = Depends(get_db)):
    # Delete all overrides
    db.query(OverrideRecord).delete()
    
    # Add audit log entry
    audit_entry = AuditLogEntry(
        action="RESET",
        detail="Cleared all manual platform overrides"
    )
    db.add(audit_entry)
    db.commit()

    overrides = load_overrides_dict(db)
    visits = get_current_visits()
    schedule, conflicts = greedy_optimizer(visits, STATIONS, overrides)
    return ScheduleResponse(schedule=schedule, conflicts=conflicts, generated_at=datetime.now().isoformat())


# Serve the frontend (single-page, no build step) at the root URL

