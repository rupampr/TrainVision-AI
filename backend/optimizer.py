"""
Greedy platform-assignment optimizer.

For each station independently:
  1. Sort visits: fixed overrides first, then by priority (desc), then by
     scheduled arrival time.
  2. Try the train's preferred platform at its scheduled time.
  3. If that slot is taken (within the safety headway), try other platforms
     at the same time.
  4. If no platform is free at the scheduled time, delay in fixed
     increments (re-checking all platforms each time) up to MAX_DELAY.
  5. If still nothing free after MAX_DELAY, force-assign to the least-busy
     platform at the delayed time and flag it for manual review.

Every decision is logged to `reason` on the schedule entry, and every time
a conflict had to be resolved it is also recorded as a ConflictLogEntry so
the frontend can show "what would have clashed and how we fixed it".
"""
from typing import List, Dict, Tuple, Optional
from models import Visit, ScheduleEntry, ConflictLogEntry, Station

MIN_HEADWAY = 5          # minutes of safety buffer required between trains on the same platform
DELAY_STEP = 2           # minutes added per retry
MAX_DELAY = 30           # minutes, after which we force-assign


def to_minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def to_hhmm(total_minutes: int) -> str:
    total_minutes %= 24 * 60
    return f"{total_minutes // 60:02d}:{total_minutes % 60:02d}"


def intervals_conflict(a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
    """True if [a_start,a_end] and [b_start,b_end] are closer than MIN_HEADWAY apart."""
    return not (a_end + MIN_HEADWAY <= b_start or b_end + MIN_HEADWAY <= a_start)


def sort_key(visit: Visit, fixed: Dict[Tuple[str, str], int]):
    is_fixed = (visit.train_id, visit.station_id) in fixed
    return (0 if is_fixed else 1, -visit.priority, to_minutes(visit.scheduled_arrival))


def greedy_optimizer(
    visits: List[Visit],
    stations: List[Station],
    fixed_platforms: Optional[Dict[Tuple[str, str], int]] = None,
) -> Tuple[List[ScheduleEntry], List[ConflictLogEntry]]:
    fixed_platforms = fixed_platforms or {}
    station_platforms = {s.id: s.platforms for s in stations}

    schedule: List[ScheduleEntry] = []
    conflicts: List[ConflictLogEntry] = []

    # platform_usage[station_id][platform] = list of (start, end, train_id)
    platform_usage: Dict[str, Dict[int, List[Tuple[int, int, str]]]] = {
        s.id: {p: [] for p in range(1, s.platforms + 1)} for s in stations
    }

    by_station: Dict[str, List[Visit]] = {}
    for v in visits:
        by_station.setdefault(v.station_id, []).append(v)

    for station_id, station_visits in by_station.items():
        num_platforms = station_platforms.get(station_id, 1)
        ordered = sorted(station_visits, key=lambda v: sort_key(v, fixed_platforms))

        for visit in ordered:
            duration = to_minutes(visit.scheduled_departure) - to_minutes(visit.scheduled_arrival)
            duration = max(duration, 5)
            arrival = to_minutes(visit.scheduled_arrival)

            override_key = (visit.train_id, visit.station_id)
            is_override = override_key in fixed_platforms

            if is_override:
                platform = fixed_platforms[override_key]
                start, end = arrival, arrival + duration
                clash = [t for (s, e, t) in platform_usage[station_id][platform] if intervals_conflict(start, end, s, e)]
                reason = "Controller override: fixed to this platform"
                if clash:
                    reason += f" (overlaps {', '.join(clash)} — manual review recommended)"
                platform_usage[station_id][platform].append((start, end, visit.train_id))
                schedule.append(_entry(visit, platform, start, end, reason, True))
                continue

            preferred = visit.platform_pref or 1
            preferred = min(max(preferred, 1), num_platforms)

            placed = False
            delay = 0
            attempted_conflict_logged = False

            while delay <= MAX_DELAY and not placed:
                start = arrival + delay
                end = start + duration

                candidate_order = [preferred] + [p for p in range(1, num_platforms + 1) if p != preferred]
                for platform in candidate_order:
                    existing = platform_usage[station_id][platform]
                    clashing = [t for (s, e, t) in existing if intervals_conflict(start, end, s, e)]
                    if not clashing:
                        if delay == 0 and platform == preferred:
                            reason = "Preferred platform available at scheduled time"
                        elif delay == 0:
                            reason = f"Reassigned to platform {platform} (platform {preferred} busy)"
                        else:
                            reason = f"Delayed {delay} min and assigned platform {platform} (platform {preferred} congested)"
                        existing.append((start, end, visit.train_id))
                        schedule.append(_entry(visit, platform, start, end, reason, False))
                        placed = True
                        break
                    elif platform == preferred and not attempted_conflict_logged:
                        overlap = min(end, max(e for _, e, _ in existing)) - max(start, min(s for s, _, _ in existing))
                        severity = _severity(overlap)
                        conflicts.append(
                            ConflictLogEntry(
                                id=f"CONF-{visit.id}",
                                station_id=station_id,
                                platform=preferred,
                                trains_involved=[visit.train_id] + clashing,
                                type="platform_overlap",
                                severity=severity,
                                root_cause=f"{visit.train_id} and {', '.join(clashing)} both scheduled on platform {preferred} within {MIN_HEADWAY} min of each other",
                                resolution="pending",
                            )
                        )
                        attempted_conflict_logged = True

                if not placed:
                    delay += DELAY_STEP

            if not placed:
                # Force-assign to the platform with the fewest bookings at the delayed time
                platform = min(range(1, num_platforms + 1), key=lambda p: len(platform_usage[station_id][p]))
                start = arrival + MAX_DELAY
                end = start + duration
                platform_usage[station_id][platform].append((start, end, visit.train_id))
                reason = f"Force-assigned to platform {platform} after {MAX_DELAY} min max delay — manual review recommended"
                schedule.append(_entry(visit, platform, start, end, reason, False))

            if attempted_conflict_logged:
                for c in conflicts:
                    if c.id == f"CONF-{visit.id}":
                        final = schedule[-1]
                        c.resolution = final.reason

    schedule.sort(key=lambda e: (e.station_id, to_minutes(e.actual_arrival)))
    return schedule, conflicts


def _severity(overlap_minutes: int) -> str:
    if overlap_minutes > 10:
        return "critical"
    if overlap_minutes >= 5:
        return "high"
    if overlap_minutes >= 2:
        return "medium"
    return "low"


def _entry(visit: Visit, platform: int, start: int, end: int, reason: str, is_override: bool) -> ScheduleEntry:
    delay = max(0, start - to_minutes(visit.scheduled_arrival))
    return ScheduleEntry(
        id=visit.id,
        train_id=visit.train_id,
        name=visit.name,
        type=visit.type,
        priority=visit.priority,
        station_id=visit.station_id,
        scheduled_arrival=visit.scheduled_arrival,
        scheduled_departure=visit.scheduled_departure,
        assigned_platform=platform,
        actual_arrival=to_hhmm(start),
        actual_departure=to_hhmm(end),
        delay_minutes=delay,
        reason=reason,
        is_override=is_override,
    )
