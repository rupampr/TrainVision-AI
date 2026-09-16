"""
Client for the RailRadar API (https://railradar.in/docs).

We use the Live Station Arrival & Departure Board endpoint:
    GET https://api.railradar.in/v1/stations/{code}/live

...once per station (HYB, SC, KCG) and convert each train entry into our
existing `Visit` model, so nothing downstream (optimizer, conflict logic,
schedule models) needs to change.

IMPORTANT — free tier is 1,000 requests/month. Do not call this on every
poll; always go through the cache in main.py.
"""
import os
from dotenv import load_dotenv
from typing import List, Optional

import requests

from models import Visit

load_dotenv()

RAILRADAR_BASE_URL = os.getenv("RAILRADAR_BASE_URL", "https://api.railradar.in/v1")
RAILRADAR_API_KEY = os.getenv("RAILRADAR_API_KEY", "")
RAILRADAR_HOURS_AHEAD = int(os.getenv("RAILRADAR_HOURS_AHEAD", "4"))  # 2|4|6|8 per RailRadar docs

# Rough priority mapping from Indian Railways train category names.
# Checked in order — first substring match wins.
_PRIORITY_KEYWORDS = [
    ("rajdhani", 10), ("shatabdi", 10), ("vande bharat", 10),
    ("duronto", 9), ("superfast", 8), ("mail", 7), ("express", 7),
    ("intercity", 7), ("passenger", 4), ("memu", 5), ("demu", 5),
    ("local", 5), ("freight", 2), ("goods", 2),
]


class RailRadarError(Exception):
    """Raised for any RailRadar failure — missing key, HTTP error, bad payload."""


def _priority_for_type(train_type: Optional[str]) -> int:
    if not train_type:
        return 5
    t = train_type.lower()
    for keyword, score in _PRIORITY_KEYWORDS:
        if keyword in t:
            return score
    return 5


def _safe_hhmm(value: Optional[str], fallback: Optional[str] = None) -> Optional[str]:
    """RailRadar returns times like '23:55' or full ISO timestamps; normalize to 'HH:MM'."""
    if not value:
        return fallback
    if len(value) >= 5 and value[2] == ":":
        return value[:5]
    if "T" in value:  # ISO timestamp e.g. 2026-06-22T23:55:00+05:30
        try:
            return value.split("T", 1)[1][:5]
        except IndexError:
            return fallback
    return fallback


def _parse_platform(raw) -> Optional[int]:
    if raw is None:
        return None
    try:
        return int(str(raw).strip())
    except ValueError:
        return None


def fetch_station_live_board(station_code: str, hours: int = RAILRADAR_HOURS_AHEAD) -> dict:
    if not RAILRADAR_API_KEY:
        raise RailRadarError("RAILRADAR_API_KEY is not set (check backend/.env)")

    url = f"{RAILRADAR_BASE_URL}/stations/{station_code}/live"
    headers = {"Authorization": f"Bearer {RAILRADAR_API_KEY}"}

    try:
        resp = requests.get(url, headers=headers, params={"hours": hours}, timeout=8)
    except requests.RequestException as e:
        raise RailRadarError(f"Network error calling RailRadar for {station_code}: {e}")

    if resp.status_code != 200:
        raise RailRadarError(f"RailRadar returned {resp.status_code} for {station_code}: {resp.text[:200]}")

    payload = resp.json()
    if not payload.get("success"):
        raise RailRadarError(f"RailRadar error for {station_code}: {payload.get('error')}")
    return payload["data"]


def live_board_to_visits(station_code: str, board: dict) -> List[Visit]:
    visits: List[Visit] = []
    for entry in board.get("trains", []):
        train = entry.get("train", {}) or {}
        stop = entry.get("stop", {}) or {}
        live = entry.get("live", {}) or {}

        number = train.get("number")
        if not number:
            continue

        departure = _safe_hhmm(stop.get("departure"))
        arrival = _safe_hhmm(stop.get("arrival"), fallback=departure)
        departure = departure or arrival
        if not arrival or not departure:
            continue  # can't schedule a visit with no timestamps at all

        visits.append(Visit(
            id=f"{number}-{station_code}",
            train_id=str(number),
            name=train.get("name") or f"Train {number}",
            type=train.get("type") or "Unknown",
            priority=_priority_for_type(train.get("type")),
            station_id=station_code,
            scheduled_arrival=arrival,
            scheduled_departure=departure,
            platform_pref=_parse_platform(live.get("platform")),
        ))
    return visits


def fetch_live_visits(station_codes: List[str]) -> List[Visit]:
    """Fetch + convert live boards for every station. Raises RailRadarError on any failure
    (caller decides whether to fall back to static data)."""
    all_visits: List[Visit] = []
    for code in station_codes:
        board = fetch_station_live_board(code)
        all_visits.extend(live_board_to_visits(code, board))
    return all_visits
