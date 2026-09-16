# TrainVision AI — Project Status & README

A railway platform-scheduling and conflict-resolution system for three
stations (Hyderabad Deccan, Secunderabad Junction, Kacheguda), built as a
final-year project. This document tracks what's actually been implemented,
how to run it, and what's still ahead.

---

## 1. Current architecture

```
┌──────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   Frontend    │◄────►│     Backend       │◄────►│   PostgreSQL      │
│   (React)     │ REST │    (FastAPI)      │ SQL  │  overrides +      │
│               │      │  optimizer,       │      │  audit_log        │
│               │      │  conflict logic   │      └──────────────────┘
└──────────────┘      └────────┬─────────┘
                                │ REST
                                ▼
                      ┌──────────────────┐
                      │   RailRadar API    │
                      │  (live train data) │
                      └──────────────────┘
```

- **Frontend**: React (implemented separately — see note in section 6).
- **Backend**: FastAPI + a greedy scheduling optimizer + conflict detector.
- **Live data**: pulled from the RailRadar API instead of a static dataset.
- **Database**: PostgreSQL, storing controller overrides and a persistent
  audit log.

---

## 2. What's implemented

| Feature | Status | Notes |
|---|---|---|
| Greedy platform-assignment optimizer | Done | `backend/optimizer.py` — priority + arrival sort, reassigns/delays on conflict |
| Conflict detection with logged resolution | Done | Every clash is recorded with severity + how it was resolved |
| Live train data via RailRadar API | Done | Replaces the old static `trains.json` dataset entirely |
| Configurable station list | Done | `backend/data/stations.json` — add a station by adding one JSON entry |
| PostgreSQL persistence | Done | Overrides and audit log now survive a server restart |
| Manual controller override | Done | Upserted into Postgres, re-optimizes the schedule live |
| Persistent audit log (`GET /log`) | Done | Matches the "audit log" feature from the original architecture doc |
| React frontend | Done | Built by you — not documented here in detail, see section 6 |
| ILP optimizer | Not started | Future phase |
| Gemini AI recommendations / chatbot | Not started | Future phase |
| WebSocket live train positions | Not started | Future phase |
| Simulation / Analytics dashboards | Not started | Future phase |

---

## 3. Repository structure

```
trainvision-demo/
├── docker-compose.yml          # Local PostgreSQL container
├── backend/
│   ├── main.py                  # FastAPI routes, startup, live-data cache
│   ├── models.py                 # Pydantic request/response models
│   ├── optimizer.py              # Greedy scheduling + conflict logging
│   ├── railradar_client.py       # Pulls + parses RailRadar live station data
│   ├── database.py               # SQLAlchemy engine/session setup
│   ├── db_models.py              # ORM models: OverrideRecord, AuditLogEntry
│   ├── data/
│   │   └── stations.json         # Station list — id, name, platform count
│   ├── requirements.txt
│   └── .env.example              # RAILRADAR_API_KEY, DATABASE_URL, etc.
└── frontend/                     # React app (your implementation)
```

> Note: `backend/data/trains.json` (the original static demo dataset) has
> been removed. The system now depends entirely on the RailRadar API — see
> section 5 for what that means in practice.

---

## 4. Setup & running it

**1. Start PostgreSQL:**
```bash
docker compose up -d
```

**2. Configure environment:**
```bash
cd backend
cp .env.example .env
# then edit .env and fill in:
#   RAILRADAR_API_KEY   — get a free key at https://railradar.in/developers
#   DATABASE_URL         — defaults to the docker-compose Postgres, no change needed
```

**3. Run the backend:**
```bash
pip install -r requirements.txt
python -m uvicorn main:app --reload
```
Tables are created automatically on startup (`init_db()` runs via a FastAPI
startup hook) — no manual migration step needed.

**4. Run the frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## 5. Important things to know before demoing

- **RailRadar free tier = 1,000 requests/month, total.** The backend caches
  live data for 30 minutes by default (`RAILRADAR_CACHE_TTL` in `.env`), so
  normal use stays well under quota — but avoid calling `POST
  /trains/refresh` repeatedly. Use it once, right before you actually
  demo, so the data is fresh.
- **There is no offline fallback anymore.** Since `trains.json` was
  removed, if the API key is missing, RailRadar is down, or you're rate
  limited, the schedule will come back empty rather than showing demo
  data. Check `GET /data-source` if the dashboard looks blank — it reports
  the current source (`railradar` / `unavailable`) and the last error.
- **Real traffic won't always produce dramatic conflicts.** The old
  hardcoded dataset was deliberately built to trigger 8 conflicts across
  the 3 stations every time. Live data depends on what's actually running
  at HYB/SC/KCG at that moment — test at the time of day you'll actually
  present, so you know what your mentor will see.
- **Overrides and the audit log now persist** in Postgres — this is new
  since the original in-memory-dict version, and worth mentioning to the
  mentor as a concrete reliability improvement.

---

## 6. API reference

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Service check |
| GET | `/stations` | List of configured stations |
| GET | `/trains` | Current live train visits (from cache) |
| GET | `/schedule` | Optimized schedule + conflicts, respecting overrides |
| POST | `/override` | Apply a controller override `{train_id, station_id, platform}` |
| POST | `/reset` | Clear all overrides |
| GET | `/log` | Persistent audit trail (last 200 entries) |
| GET | `/data-source` | Whether data is live or unavailable, cache timing, last error |
| POST | `/trains/refresh` | Force a fresh RailRadar pull (counts against quota — use sparingly) |

---

## 7. Frontend note

The React frontend was implemented directly by the project owner, separate
from this documented backend work. If you want this README to fully cover
the frontend as well (component structure, state management approach, how
it talks to the API), that section should be added once the frontend's
final structure is settled — happy to help write that part too if useful.

---

## 8. Development history (for reference)

1. Built the initial FastAPI + vanilla JS demo: greedy optimizer, conflict
   detection, manual overrides, static `trains.json` dataset (15 trains,
   3 stations, deliberate conflicts for demo purposes).
2. Fixed a frontend bug where the override dropdown silently reset to the
   first train (T101) on every 15-second auto-refresh, causing overrides
   to always apply to the wrong train.
3. Integrated the RailRadar API for live train data, with a 30-minute
   cache and (at the time) a static-data fallback.
4. Removed the static fallback and `trains.json` entirely — the system now
   depends solely on live RailRadar data. Station list moved to its own
   `stations.json` for easy extension beyond the original 3 stations.
5. Added PostgreSQL for persistent overrides and a persistent audit log,
   replacing the in-memory overrides dictionary.
6. Migrated the frontend to React (implemented independently).