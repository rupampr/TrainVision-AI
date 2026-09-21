"""
ILP (Integer Linear Programming) optimizer — finds a mathematically optimal
platform assignment per station, instead of the greedy optimizer's
one-train-at-a-time heuristic.

Formulation (per station, solved independently):

  Decision variables
    x[t, p]   in {0,1}  — 1 if train t is assigned to platform p
    start[t]  continuous — actual arrival time of train t (minutes since 00:00)
    order[t1,t2] in {0,1} — 1 if t1 is scheduled before t2 (only meaningful
                             when they end up sharing a platform)

  Objective
    minimize  sum( priority[t] * delay[t] )
    — delaying a HIGH priority train costs more, so the solver prefers to
      delay low-priority trains when a trade-off is unavoidable.

  Constraints
    1. Each train assigned to exactly one platform:      sum_p x[t,p] = 1
    2. No early arrivals:                                  start[t] >= scheduled_arrival[t]
    3. Delay is bounded:                                    start[t] <= scheduled_arrival[t] + MAX_DELAY
    4. Controller overrides are fixed:                     x[t, fixed_platform] = 1
    5. No two trains overlap (with headway) on a shared
       platform — modelled as a disjunctive big-M pair
       constraint, gated by whether both trains actually
       share that platform in the solution.

This is the "optimal" counterpart to optimizer.py's greedy heuristic —
slower, but guarantees the best possible schedule (by this objective)
within the solver's time limit.
"""
from typing import Dict, List, Optional, Tuple

import pulp

from models import ConflictLogEntry, ScheduleEntry, Station, Visit
from optimizer import MIN_HEADWAY, to_hhmm, to_minutes

MAX_DELAY = 60          # minutes — ILP is allowed more room than the greedy optimizer
BIG_M = 24 * 60          # a full day, safely larger than any real gap
DEFAULT_TIME_LIMIT = 15  # seconds, per station


def ilp_optimizer(
    visits: List[Visit],
    stations: List[Station],
    fixed_platforms: Optional[Dict[Tuple[str, str], int]] = None,
    time_limit_seconds: int = DEFAULT_TIME_LIMIT,
) -> Tuple[List[ScheduleEntry], List[ConflictLogEntry]]:
    fixed_platforms = fixed_platforms or {}
    station_platforms = {s.id: s.platforms for s in stations}

    schedule: List[ScheduleEntry] = []
    conflicts: List[ConflictLogEntry] = []

    by_station: Dict[str, List[Visit]] = {}
    for v in visits:
        by_station.setdefault(v.station_id, []).append(v)

    for station_id, station_visits in by_station.items():
        num_platforms = station_platforms.get(station_id, 1)
        entries, station_conflicts = _solve_station(
            station_id, station_visits, num_platforms, fixed_platforms, time_limit_seconds
        )
        schedule.extend(entries)
        conflicts.extend(station_conflicts)

    schedule.sort(key=lambda e: (e.station_id, to_minutes(e.actual_arrival)))
    return schedule, conflicts


def _solve_station(
    station_id: str,
    visits: List[Visit],
    num_platforms: int,
    fixed_platforms: Dict[Tuple[str, str], int],
    time_limit_seconds: int,
) -> Tuple[List[ScheduleEntry], List[ConflictLogEntry]]:
    n = len(visits)
    if n == 0:
        return [], []

    arrival = {v.id: to_minutes(v.scheduled_arrival) for v in visits}
    duration = {v.id: max(to_minutes(v.scheduled_departure) - to_minutes(v.scheduled_arrival), 5) for v in visits}
    platforms = list(range(1, num_platforms + 1))

    prob = pulp.LpProblem(f"TrainScheduling_{station_id}", pulp.LpMinimize)

    x = {(v.id, p): pulp.LpVariable(f"x_{v.id}_{p}", cat="Binary") for v in visits for p in platforms}
    start = {
        v.id: pulp.LpVariable(f"start_{v.id}", lowBound=arrival[v.id], upBound=arrival[v.id] + MAX_DELAY)
        for v in visits
    }
    pairs = [(a, b) for i, a in enumerate(visits) for b in visits[i + 1:]]
    order = {(a.id, b.id): pulp.LpVariable(f"order_{a.id}_{b.id}", cat="Binary") for a, b in pairs}

    # Objective: minimize priority-weighted total delay
    prob += pulp.lpSum((start[v.id] - arrival[v.id]) * v.priority for v in visits)

    # Constraint 1: exactly one platform per train
    for v in visits:
        prob += pulp.lpSum(x[(v.id, p)] for p in platforms) == 1

    # Constraint 4: controller overrides are fixed
    for v in visits:
        key = (v.train_id, v.station_id)
        if key in fixed_platforms:
            fixed_p = fixed_platforms[key]
            for p in platforms:
                prob += x[(v.id, p)] == (1 if p == fixed_p else 0)

    # Constraint 5: no overlap on a shared platform (disjunctive, big-M)
    for a, b in pairs:
        end_a = start[a.id] + duration[a.id]
        end_b = start[b.id] + duration[b.id]
        o = order[(a.id, b.id)]
        for p in platforms:
            same_platform_slack = BIG_M * (2 - x[(a.id, p)] - x[(b.id, p)])
            # If a is before b: start[b] >= end[a] + headway
            prob += start[b.id] >= end_a + MIN_HEADWAY - BIG_M * (1 - o) - same_platform_slack
            # If b is before a: start[a] >= end[b] + headway
            prob += start[a.id] >= end_b + MIN_HEADWAY - BIG_M * o - same_platform_slack

    solver = pulp.PULP_CBC_CMD(msg=0, timeLimit=time_limit_seconds)
    prob.solve(solver)

    if pulp.LpStatus[prob.status] not in ("Optimal", "Not Solved"):
        raise RuntimeError(f"ILP solver could not find a feasible schedule for {station_id} "
                            f"(status: {pulp.LpStatus[prob.status]})")

    entries: List[ScheduleEntry] = []
    conflicts: List[ConflictLogEntry] = []

    for v in visits:
        assigned_platform = next(p for p in platforms if pulp.value(x[(v.id, p)]) > 0.5)
        actual_start = round(pulp.value(start[v.id]))
        actual_end = actual_start + duration[v.id]
        delay = actual_start - arrival[v.id]
        is_override = (v.train_id, v.station_id) in fixed_platforms

        if is_override:
            reason = "Controller override: fixed to this platform (ILP-respected)"
        elif delay == 0 and assigned_platform == (v.platform_pref or assigned_platform):
            reason = "ILP-optimal: preferred platform, no delay"
        elif delay == 0:
            reason = f"ILP-optimal: reassigned to platform {assigned_platform}, no delay needed"
        else:
            reason = f"ILP-optimal: platform {assigned_platform}, delayed {delay} min to avoid a worse conflict elsewhere"
            conflicts.append(ConflictLogEntry(
                id=f"ILP-CONF-{v.id}",
                station_id=station_id,
                platform=assigned_platform,
                trains_involved=[v.train_id],
                type="platform_overlap",
                severity=_severity(delay),
                root_cause=f"{v.train_id} could not keep its scheduled slot without violating headway "
                           f"with another train at {station_id}",
                resolution=reason,
            ))

        entries.append(ScheduleEntry(
            id=v.id, train_id=v.train_id, name=v.name, type=v.type, priority=v.priority,
            station_id=v.station_id, scheduled_arrival=v.scheduled_arrival, scheduled_departure=v.scheduled_departure,
            assigned_platform=assigned_platform, actual_arrival=to_hhmm(actual_start), actual_departure=to_hhmm(actual_end),
            delay_minutes=delay, reason=reason, is_override=is_override,
        ))

    return entries, conflicts


def _severity(delay_minutes: int) -> str:
    if delay_minutes > 20:
        return "critical"
    if delay_minutes >= 10:
        return "high"
    if delay_minutes >= 5:
        return "medium"
    return "low"