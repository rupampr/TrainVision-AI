// types.ts
export interface Station {
  id: string;
  name: string;
  platforms: number;
}

export interface ScheduleEntry {
  train_id: string;
  station_id: string;
  name: string;
  assigned_platform: number;
  actual_arrival: string;
  actual_departure: string;
  delay_minutes: number;
  is_override: boolean;
  reason: string;
}

export interface Conflict {
  severity: "critical" | "high" | "medium";
  trains_involved: string[];
  station_id: string;
  platform: number;
  root_cause: string;
  resolution: string;
}