from typing import Dict, List, Optional, Literal
from pydantic import BaseModel


class Station(BaseModel):
    id: str
    name: str
    platforms: int


class Visit(BaseModel):
    """One train's scheduled stop at one station."""
    id: str
    train_id: str
    name: str
    type: str
    priority: int
    station_id: str
    scheduled_arrival: str   # "HH:MM"
    scheduled_departure: str  # "HH:MM"
    platform_pref: Optional[int] = None


class ScheduleEntry(BaseModel):
    id: str
    train_id: str
    name: str
    type: str
    priority: int
    station_id: str
    scheduled_arrival: str
    scheduled_departure: str
    assigned_platform: int
    actual_arrival: str
    actual_departure: str
    delay_minutes: int
    reason: str
    is_override: bool = False


class ConflictLogEntry(BaseModel):
    id: str
    station_id: str
    platform: Optional[int]
    trains_involved: List[str]
    type: Literal["platform_overlap", "headway_violation"]
    severity: Literal["low", "medium", "high", "critical"]
    root_cause: str
    resolution: str


class OverrideRequest(BaseModel):
    train_id: str
    station_id: str
    platform: int


class ScheduleResponse(BaseModel):
    schedule: List[ScheduleEntry]
    conflicts: List[ConflictLogEntry]
    generated_at: str


class OverrideInfo(BaseModel):
    train_id: str
    station_id: str
    platform: int


class DelayInjection(BaseModel):
    train_id: str
    station_id: str
    extra_delay_minutes: int


class ExtraVisitInput(BaseModel):
    train_id: str
    name: str
    type: str = "Special"
    priority: int = 8
    station_id: str
    scheduled_arrival: str
    scheduled_departure: str
    platform_pref: Optional[int] = 1


class SimulationRequest(BaseModel):
    algorithm: Literal["greedy", "ilp"] = "ilp"
    blocked_platforms: Dict[str, List[int]] = {}
    delay_injections: List[DelayInjection] = []
    extra_visits: List[ExtraVisitInput] = []


class AlgorithmMetrics(BaseModel):
    algorithm: Literal["greedy", "ilp"]
    total_trains: int
    delayed_trains: int
    on_time_pct: float
    total_delay_minutes: int
    weighted_delay: int
    max_delay_minutes: int
    conflict_count: int
    solve_time_ms: float


class PlatformUtilization(BaseModel):
    platform: int
    train_count: int
    occupied_minutes: int
    utilization_pct: float


class StationAnalytics(BaseModel):
    station_id: str
    station_name: str
    total_platforms: int
    train_count: int
    delayed_count: int
    total_delay_minutes: int
    conflict_count: int
    utilization_pct: float
    platforms: List[PlatformUtilization]


class AnalyticsResponse(BaseModel):
    active_algorithm: Literal["greedy", "ilp"]
    schedule: List[ScheduleEntry]
    conflicts: List[ConflictLogEntry]
    comparison: List[AlgorithmMetrics]
    recommended_algorithm: Literal["greedy", "ilp"]
    stations: List[StationAnalytics]
    generated_at: str


class SimulationImpactItem(BaseModel):
    train_id: str
    name: str
    station_id: str
    baseline_platform: Optional[int] = None
    simulated_platform: int
    baseline_arrival: Optional[str] = None
    simulated_arrival: str
    baseline_delay: int
    simulated_delay: int
    delay_delta: int
    is_extra_train: bool = False
    reason: str


class SimulationResponse(BaseModel):
    algorithm: Literal["greedy", "ilp"]
    baseline_metrics: AlgorithmMetrics
    simulated_metrics: AlgorithmMetrics
    comparison: List[AlgorithmMetrics]
    schedule: List[ScheduleEntry]
    conflicts: List[ConflictLogEntry]
    impacted_trains: List[SimulationImpactItem]
    generated_at: str
