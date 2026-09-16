from typing import List, Optional, Literal
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
