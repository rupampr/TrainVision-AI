"""
Analytics, algorithm benchmarking (Greedy vs ILP), and What-If disruption simulation
engine for TrainVision AI.

All simulations operate on copies of the live/cached visits in memory and never mutate
persistent database overrides.
"""
from datetime import datetime
import time
from typing import Dict, List, Literal, Optional, Tuple

from ilp_optimizer import ilp_optimizer
from models import (
    AlgorithmMetrics,
    AnalyticsResponse,
    ConflictLogEntry,
    PlatformUtilization,
    ScheduleEntry,
    SimulationImpactItem,
    SimulationRequest,
    SimulationResponse,
    Station,
    StationAnalytics,
    Visit,
)
from optimizer import greedy_optimizer, to_hhmm, to_minutes


def _run_timed(
    algorithm: Literal["greedy", "ilp"],
    visits: List[Visit],
    stations: List[Station],
    overrides: Dict[Tuple[str, str], int],
    blocked_platforms: Optional[Dict[str, List[int]]] = None,
) -> Tuple[List[ScheduleEntry], List[ConflictLogEntry], float]:
    t0 = time.perf_counter()
    if algorithm == "ilp":
        schedule, conflicts = ilp_optimizer(
            visits, stations, overrides, blocked_platforms=blocked_platforms
        )
    else:
        schedule, conflicts = greedy_optimizer(
            visits, stations, overrides, blocked_platforms=blocked_platforms
        )
    elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    return schedule, conflicts, elapsed_ms


def compute_metrics(
    algorithm: Literal["greedy", "ilp"],
    schedule: List[ScheduleEntry],
    conflicts: List[ConflictLogEntry],
    solve_time_ms: float,
) -> AlgorithmMetrics:
    total_trains = len(schedule)
    delayed_trains = sum(1 for e in schedule if e.delay_minutes > 0)
    total_delay = sum(e.delay_minutes for e in schedule)
    weighted_delay = sum(e.delay_minutes * e.priority for e in schedule)
    max_delay = max((e.delay_minutes for e in schedule), default=0)
    on_time_pct = (
        round(((total_trains - delayed_trains) / total_trains) * 100.0, 1)
        if total_trains
        else 100.0
    )
    return AlgorithmMetrics(
        algorithm=algorithm,
        total_trains=total_trains,
        delayed_trains=delayed_trains,
        on_time_pct=on_time_pct,
        total_delay_minutes=total_delay,
        weighted_delay=weighted_delay,
        max_delay_minutes=max_delay,
        conflict_count=len(conflicts),
        solve_time_ms=solve_time_ms,
    )


def _entry_duration_minutes(entry: ScheduleEntry) -> int:
    arr = to_minutes(entry.actual_arrival)
    dep = to_minutes(entry.actual_departure)
    dur = dep - arr
    if dur < 0:
        dur += 24 * 60
    return max(dur, 5)


def compute_station_analytics(
    stations: List[Station],
    schedule: List[ScheduleEntry],
    conflicts: List[ConflictLogEntry],
) -> List[StationAnalytics]:
    results: List[StationAnalytics] = []

    for station in stations:
        st_entries = [e for e in schedule if e.station_id == station.id]
        st_conflicts = [c for c in conflicts if c.station_id == station.id]

        # Operational window across the station's active schedule (minimum 60 min)
        if st_entries:
            starts = [to_minutes(e.actual_arrival) for e in st_entries]
            ends = [to_minutes(e.actual_arrival) + _entry_duration_minutes(e) for e in st_entries]
            window_minutes = max(60, max(ends) - min(starts))
        else:
            window_minutes = 60

        platform_stats: List[PlatformUtilization] = []
        total_occupied = 0
        for p in range(1, station.platforms + 1):
            p_entries = [e for e in st_entries if e.assigned_platform == p]
            occupied = sum(_entry_duration_minutes(e) for e in p_entries)
            total_occupied += occupied
            util_pct = round(min(100.0, (occupied / window_minutes) * 100.0), 1)
            platform_stats.append(
                PlatformUtilization(
                    platform=p,
                    train_count=len(p_entries),
                    occupied_minutes=occupied,
                    utilization_pct=util_pct,
                )
            )

        station_capacity = max(1, station.platforms * window_minutes)
        station_util = round(min(100.0, (total_occupied / station_capacity) * 100.0), 1)

        results.append(
            StationAnalytics(
                station_id=station.id,
                station_name=station.name,
                total_platforms=station.platforms,
                train_count=len(st_entries),
                delayed_count=sum(1 for e in st_entries if e.delay_minutes > 0),
                total_delay_minutes=sum(e.delay_minutes for e in st_entries),
                conflict_count=len(st_conflicts),
                utilization_pct=station_util,
                platforms=platform_stats,
            )
        )

    return results


def build_analytics_report(
    active_algorithm: Literal["greedy", "ilp"],
    visits: List[Visit],
    stations: List[Station],
    overrides: Dict[Tuple[str, str], int],
) -> AnalyticsResponse:
    greedy_sched, greedy_conf, greedy_ms = _run_timed("greedy", visits, stations, overrides)
    ilp_sched, ilp_conf, ilp_ms = _run_timed("ilp", visits, stations, overrides)

    greedy_metrics = compute_metrics("greedy", greedy_sched, greedy_conf, greedy_ms)
    ilp_metrics = compute_metrics("ilp", ilp_sched, ilp_conf, ilp_ms)

    # Recommend ILP whenever it reduces weighted delay or total delay; otherwise greedy for speed
    recommended: Literal["greedy", "ilp"] = (
        "ilp"
        if (ilp_metrics.weighted_delay, ilp_metrics.total_delay_minutes)
        < (greedy_metrics.weighted_delay, greedy_metrics.total_delay_minutes)
        else "greedy"
    )

    active_sched = ilp_sched if active_algorithm == "ilp" else greedy_sched
    active_conf = ilp_conf if active_algorithm == "ilp" else greedy_conf

    return AnalyticsResponse(
        active_algorithm=active_algorithm,
        schedule=active_sched,
        conflicts=active_conf,
        comparison=[greedy_metrics, ilp_metrics],
        recommended_algorithm=recommended,
        stations=compute_station_analytics(stations, active_sched, active_conf),
        generated_at=datetime.now().isoformat(),
    )


def _apply_disruptions(
    visits: List[Visit], request: SimulationRequest
) -> Tuple[List[Visit], set]:
    delay_map: Dict[Tuple[str, str], int] = {
        (d.train_id, d.station_id): max(0, d.extra_delay_minutes)
        for d in request.delay_injections
    }

    sim_visits: List[Visit] = []
    for v in visits:
        extra = delay_map.get((v.train_id, v.station_id), 0)
        if extra > 0:
            arr_min = to_minutes(v.scheduled_arrival) + extra
            dep_min = to_minutes(v.scheduled_departure) + extra
            sim_visits.append(
                v.model_copy(
                    update={
                        "scheduled_arrival": to_hhmm(arr_min),
                        "scheduled_departure": to_hhmm(dep_min),
                    }
                )
            )
        else:
            sim_visits.append(v.model_copy())

    extra_ids = set()
    for idx, ex in enumerate(request.extra_visits):
        vid = f"SIM-{ex.train_id}-{ex.station_id}-{idx}"
        extra_ids.add((ex.train_id, ex.station_id))
        sim_visits.append(
            Visit(
                id=vid,
                train_id=ex.train_id,
                name=ex.name,
                type=ex.type,
                priority=max(1, min(10, ex.priority)),
                station_id=ex.station_id,
                scheduled_arrival=ex.scheduled_arrival,
                scheduled_departure=ex.scheduled_departure,
                platform_pref=ex.platform_pref,
            )
        )

    return sim_visits, extra_ids


def run_simulation(
    request: SimulationRequest,
    visits: List[Visit],
    stations: List[Station],
    overrides: Dict[Tuple[str, str], int],
) -> SimulationResponse:
    # Validate blocked platforms leave at least 1 platform open per station
    station_map = {s.id: s for s in stations}
    for st_id, blocked in request.blocked_platforms.items():
        st = station_map.get(st_id)
        if st and len(set(blocked)) >= st.platforms:
            raise ValueError(
                f"Cannot block all {st.platforms} platforms at {st_id}; leave at least 1 open."
            )

    # Baseline run with selected algorithm
    base_sched, base_conf, base_ms = _run_timed(
        request.algorithm, visits, stations, overrides
    )
    baseline_metrics = compute_metrics(
        request.algorithm, base_sched, base_conf, base_ms
    )

    sim_visits, extra_ids = _apply_disruptions(visits, request)

    greedy_sched, greedy_conf, greedy_ms = _run_timed(
        "greedy", sim_visits, stations, overrides, request.blocked_platforms
    )
    ilp_sched, ilp_conf, ilp_ms = _run_timed(
        "ilp", sim_visits, stations, overrides, request.blocked_platforms
    )

    greedy_metrics = compute_metrics("greedy", greedy_sched, greedy_conf, greedy_ms)
    ilp_metrics = compute_metrics("ilp", ilp_sched, ilp_conf, ilp_ms)

    sim_sched = ilp_sched if request.algorithm == "ilp" else greedy_sched
    sim_conf = ilp_conf if request.algorithm == "ilp" else greedy_conf
    simulated_metrics = ilp_metrics if request.algorithm == "ilp" else greedy_metrics

    base_by_key = {(e.train_id, e.station_id): e for e in base_sched}
    impacted: List[SimulationImpactItem] = []

    for e in sim_sched:
        key = (e.train_id, e.station_id)
        base = base_by_key.get(key)
        is_extra = key in extra_ids and base is None
        if base is None:
            impacted.append(
                SimulationImpactItem(
                    train_id=e.train_id,
                    name=e.name,
                    station_id=e.station_id,
                    baseline_platform=None,
                    simulated_platform=e.assigned_platform,
                    baseline_arrival=None,
                    simulated_arrival=e.actual_arrival,
                    baseline_delay=0,
                    simulated_delay=e.delay_minutes,
                    delay_delta=e.delay_minutes,
                    is_extra_train=is_extra,
                    reason=e.reason,
                )
            )
            continue

        changed = (
            base.assigned_platform != e.assigned_platform
            or base.actual_arrival != e.actual_arrival
            or base.delay_minutes != e.delay_minutes
        )
        if changed:
            impacted.append(
                SimulationImpactItem(
                    train_id=e.train_id,
                    name=e.name,
                    station_id=e.station_id,
                    baseline_platform=base.assigned_platform,
                    simulated_platform=e.assigned_platform,
                    baseline_arrival=base.actual_arrival,
                    simulated_arrival=e.actual_arrival,
                    baseline_delay=base.delay_minutes,
                    simulated_delay=e.delay_minutes,
                    delay_delta=e.delay_minutes - base.delay_minutes,
                    is_extra_train=False,
                    reason=e.reason,
                )
            )

    return SimulationResponse(
        algorithm=request.algorithm,
        baseline_metrics=baseline_metrics,
        simulated_metrics=simulated_metrics,
        comparison=[greedy_metrics, ilp_metrics],
        schedule=sim_sched,
        conflicts=sim_conf,
        impacted_trains=impacted,
        generated_at=datetime.now().isoformat(),
    )
