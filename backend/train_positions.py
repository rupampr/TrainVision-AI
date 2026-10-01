"""
Live train position tracking with intelligent corridor prioritization,
spherical heading (bearing) calculation, and realistic speed telemetry.

Uses RailRadar's per-train live status endpoint:
    GET /v1/trains/{number}/live

Cached aggressively (POSITION_CACHE_TTL) to protect monthly RailRadar quota.
Between fetches, positions are smoothly extrapolated along their true track
bearing using speed telemetry.
"""
import math
import os
import time
from datetime import datetime
from typing import Dict, List, Optional

import requests
from dotenv import load_dotenv

# Ensure environment variables are loaded
dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path)
load_dotenv()

from railradar_client import RAILRADAR_BASE_URL, RAILRADAR_API_KEY, RailRadarError
from models import Visit

POSITION_CACHE_TTL = int(os.getenv("RAILRADAR_POSITION_CACHE_TTL", "300"))  # 5 min
MAX_TRACKED_TRAINS = int(os.getenv("RAILRADAR_MAX_TRACKED_TRAINS", "10"))   # Max trains to track simultaneously

# _cache[train_id] = {"lat", "lng", "speed_kmh", "avg_speed_kmh", "bearing", "status",
#                      "delay_minutes", "station_code", "fetched_at", "error"}
_cache: Dict[str, dict] = {}


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * max(0.0, min(1.0, t))


def _calculate_bearing(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate the great-circle compass initial bearing from (lat1, lng1) to (lat2, lng2).
    Returns degrees in range [0, 360)."""
    try:
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dlambda = math.radians(lng2 - lng1)
        y = math.sin(dlambda) * math.cos(phi2)
        x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
        bearing = math.degrees(math.atan2(y, x))
        return round((bearing + 360) % 360, 1)
    except Exception:
        return 90.0


def _generate_synthetic_position(train_id: str, now: float, error: Optional[str] = None) -> dict:
    """Fallback generator for demo trains (T101, etc.) or when RailRadar is rate-limited,
    placing trains along the Kharagpur -> Santragachi -> Howrah corridor."""
    h = abs(hash(train_id))
    is_halted = (h % 3 == 0)
    direction_east = (h % 2 == 0)
    t = 0.15 + ((h % 70) / 100.0)
    
    # Corridor anchors: KGP (22.3428, 87.3245) to HWH (22.5833, 88.3424)
    lat = round(_lerp(22.3428, 22.5833, t), 5)
    lng = round(_lerp(87.3245, 88.3424, t), 5)
    speed = 0.0 if is_halted else float(52 + (h % 26))
    bearing = 75.4 if direction_east else 255.8
    status = "at-station" if is_halted else "in-transit"
    delay = (h % 18) if (h % 3 == 0) else 0
    st_code = "KGP" if t < 0.35 else ("SRC" if t < 0.75 else "HWH")
    
    return {
        "lat": lat,
        "lng": lng,
        "speed_kmh": speed,
        "avg_speed_kmh": 65.0,
        "bearing": bearing,
        "status": status,
        "delay_minutes": delay,
        "station_code": st_code,
        "fetched_at": now,
        "error": error,
    }


def _fetch_train_live(train_number: str) -> dict:
    if not RAILRADAR_API_KEY:
        raise RailRadarError("RAILRADAR_API_KEY is not set")

    url = f"{RAILRADAR_BASE_URL}/trains/{train_number}/live"
    headers = {"Authorization": f"Bearer {RAILRADAR_API_KEY}"}
    try:
        resp = requests.get(url, headers=headers, params={"includeCoordinates": "true"}, timeout=8)
    except requests.RequestException as e:
        raise RailRadarError(f"Network error fetching live status for {train_number}: {e}")

    if resp.status_code != 200:
        raise RailRadarError(f"RailRadar returned {resp.status_code} for train {train_number}")

    payload = resp.json()
    if not isinstance(payload, dict) or not payload.get("success"):
        raise RailRadarError(f"RailRadar error for train {train_number}: {payload.get('error')}")
    return payload["data"]


def _position_from_live_data(data: dict) -> Optional[dict]:
    """Parse RailRadar live payload into clean GPS, speed, and computed bearing telemetry."""
    loc = data.get("currentLocation") or {}
    route = data.get("route") or []
    train_meta = data.get("train") or {}
    station_code = loc.get("stationCode")
    progress = float(loc.get("segmentProgress", 0.0) or 0.0)
    curr_seq = loc.get("sequence", 1) or 1
    status = loc.get("status") or data.get("status", "unknown")

    # 1. Precise GPS Coordinates
    lat, lng = None, None
    loc_coords = loc.get("coordinates")
    if isinstance(loc_coords, dict) and loc_coords.get("lat") is not None and loc_coords.get("lng") is not None:
        lat = float(loc_coords["lat"])
        lng = float(loc_coords["lng"])

    current_stop = next((r for r in route if r.get("stationCode") == station_code), None)
    next_halt = data.get("nextHalt") or {}
    next_stop = next((r for r in route if r.get("stationCode") == next_halt.get("stationCode")), None)
    if not next_stop:
        next_stop = next((r for r in route if r.get("sequence", 0) > curr_seq and r.get("lat") is not None), None)

    if lat is None or lng is None:
        if current_stop and current_stop.get("lat") is not None:
            if next_stop and next_stop.get("lat") is not None and progress > 0:
                lat = _lerp(current_stop["lat"], next_stop["lat"], progress)
                lng = _lerp(current_stop["lng"], next_stop["lng"], progress)
            else:
                lat, lng = current_stop["lat"], current_stop["lng"]
        elif next_stop and next_stop.get("lat") is not None:
            lat, lng = next_stop["lat"], next_stop["lng"]
        else:
            valid_stops = [r for r in route if r.get("lat") is not None]
            if valid_stops:
                lat, lng = valid_stops[0]["lat"], valid_stops[0]["lng"]
            else:
                return None

    # 2. Compass Heading (Bearing)
    bearing = None
    if next_stop and next_stop.get("lat") is not None and next_stop.get("lng") is not None:
        if abs(next_stop["lat"] - lat) > 1e-4 or abs(next_stop["lng"] - lng) > 1e-4:
            bearing = _calculate_bearing(lat, lng, next_stop["lat"], next_stop["lng"])

    if bearing is None:
        # If arrived at destination or next stop coords not available, use arrival track orientation
        prev_stop = next((r for r in reversed(route) if r.get("sequence", 0) < curr_seq and r.get("lat") is not None), None)
        if prev_stop and prev_stop.get("lat") is not None and prev_stop.get("lng") is not None:
            if abs(lat - prev_stop["lat"]) > 1e-4 or abs(lng - prev_stop["lng"]) > 1e-4:
                bearing = _calculate_bearing(prev_stop["lat"], prev_stop["lng"], lat, lng)

    if bearing is None:
        # Corridor orientation fallback:
        # KGP heading toward HWH is ~75.4°, HWH heading outbound is ~255.8°
        if station_code == "KGP":
            bearing = 75.4
        elif station_code == "HWH":
            bearing = 255.8
        else:
            bearing = 90.0

    # 3. Realistic Speed Telemetry
    speed_kmh = loc.get("speedKmh")
    avg_speed = train_meta.get("avgSpeed") or 55.0

    if speed_kmh is not None and float(speed_kmh) > 0:
        reported_speed = round(float(speed_kmh), 1)
    elif status in ["in-transit", "running"]:
        next_speed = current_stop.get("speedToNextStationKmph") if current_stop else None
        if next_speed and float(next_speed) > 0:
            reported_speed = round(float(next_speed), 1)
        else:
            reported_speed = round(float(avg_speed), 1)
    else:
        # Stationary platform halt, terminal arrival, or not started
        reported_speed = 0.0

    return {
        "lat": round(lat, 5),
        "lng": round(lng, 5),
        "speed_kmh": reported_speed,
        "avg_speed_kmh": round(float(avg_speed), 1),
        "bearing": round(bearing, 1),
        "status": status,
        "delay_minutes": loc.get("delayMinutes") or data.get("delayMinutes", 0),
        "station_code": station_code or (current_stop.get("stationCode") if current_stop else "HWH"),
    }


def _extrapolate(position: dict, elapsed_seconds: float) -> dict:
    """Smoothly nudge position forward along its bearing vector using current speed."""
    speed_kmh = position.get("speed_kmh") or 0
    if speed_kmh <= 0 or elapsed_seconds <= 0:
        return position

    distance_km = speed_kmh * (elapsed_seconds / 3600.0)
    bearing_rad = math.radians(position.get("bearing") or 0)

    lat_rad = math.radians(position["lat"])
    dlat = (distance_km / 111.32) * math.cos(bearing_rad)
    dlng = (distance_km / (111.32 * math.cos(lat_rad))) * math.sin(bearing_rad) if math.cos(lat_rad) != 0 else 0

    extrapolated = dict(position)
    extrapolated["lat"] = round(position["lat"] + dlat, 5)
    extrapolated["lng"] = round(position["lng"] + dlng, 5)
    return extrapolated


def prioritize_trains_for_tracking(visits: List[Visit], max_count: int = MAX_TRACKED_TRAINS) -> List[str]:
    """Select the top 10 most relevant trains for live radar tracking.
    
    Prioritization criteria:
    1. Time Proximity: Trains scheduled within +/- 90 minutes of the current time.
    2. Operational Tier: High-priority express/mail trains (Rajdhani/Vande Bharat=10,
       Duronto=9, Superfast=8, Express=7) ranked higher than suburban locals.
    3. Active Tracking Continuity: Trains already in cache with active movement or delays.
    4. Corridor Balance: Balances selection across HWH, SRC, and KGP to ensure the
       entire corridor is represented rather than clustering only at Howrah.
    """
    if not visits:
        return []

    now = datetime.now()
    now_m = now.hour * 60 + now.minute

    def score_visit(v: Visit) -> float:
        time_str = v.scheduled_arrival or v.scheduled_departure or "12:00"
        try:
            parts = time_str.split(":")
            v_minutes = int(parts[0]) * 60 + int(parts[1])
        except Exception:
            v_minutes = 720

        diff = abs(v_minutes - now_m)
        if diff > 720:
            diff = 1440 - diff  # handle midnight wrap-around

        # Proximity score (0 to 100): closer to current time scores higher
        time_score = max(0.0, 100.0 - (diff * 0.4))
        prio_score = (getattr(v, "priority", 5) or 5) * 12.0

        # Cache continuity bonus
        cached_info = _cache.get(v.train_id)
        cache_bonus = 25.0 if cached_info and (cached_info.get("speed_kmh", 0) > 0 or cached_info.get("delay_minutes", 0) > 0) else 0.0

        return prio_score + time_score + cache_bonus

    sorted_visits = sorted(visits, key=score_visit, reverse=True)

    # Balance trains across stations (e.g. max 5 per station)
    max_per_station = max(3, max_count // 2)
    station_counts: Dict[str, int] = {}
    selected_ids: List[str] = []
    seen: set = set()

    for v in sorted_visits:
        if v.train_id in seen:
            continue
        st = v.station_id
        if station_counts.get(st, 0) < max_per_station:
            station_counts[st] = station_counts.get(st, 0) + 1
            selected_ids.append(v.train_id)
            seen.add(v.train_id)
        if len(selected_ids) == max_count:
            break

    # If still below max_count, fill remaining slots
    if len(selected_ids) < max_count:
        for v in sorted_visits:
            if v.train_id not in seen:
                selected_ids.append(v.train_id)
                seen.add(v.train_id)
            if len(selected_ids) == max_count:
                break

    return selected_ids


def get_positions(train_ids: List[str]) -> Dict[str, dict]:
    """Return current (extrapolated) positions for the requested trains.
    Safeguards against burst rate limits (429) by adding polite delays and
    serving graceful fallbacks if errors occur."""
    now = time.time()
    result: Dict[str, dict] = {}
    to_track = train_ids[:MAX_TRACKED_TRAINS]

    for train_id in to_track:
        cached = _cache.get(train_id)
        is_stale = cached is None or (now - cached.get("fetched_at", 0) > POSITION_CACHE_TTL)

        if is_stale:
            # Static demo visits (e.g. T101, T102) or offline mode
            if train_id.startswith("T") or not RAILRADAR_API_KEY:
                cached = _generate_synthetic_position(train_id, now)
                _cache[train_id] = cached
            else:
                # Add a brief pause between outbound HTTP calls to prevent 429 rate limit
                time.sleep(0.3)
                try:
                    raw = _fetch_train_live(train_id)
                    pos = _position_from_live_data(raw)
                    if pos:
                        pos["fetched_at"] = now
                        pos["error"] = None
                        _cache[train_id] = pos
                        cached = pos
                except RailRadarError as e:
                    if cached:
                        cached["error"] = str(e)
                    else:
                        cached = _generate_synthetic_position(train_id, now, error=str(e))
                        # Back off for 60 seconds before retrying
                        cached["fetched_at"] = now - POSITION_CACHE_TTL + 60
                        _cache[train_id] = cached

        if cached:
            elapsed = now - cached["fetched_at"]
            result[train_id] = _extrapolate(cached, elapsed)

    return result