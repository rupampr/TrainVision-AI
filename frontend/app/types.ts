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

export interface AIRecommendation {
  train_id: string;
  station_id: string;
  suggestion: string;
  rationale: string;
  priority_level: "low" | "medium" | "high";
}

export interface AIChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
}

export interface AIStatus {
  configured: boolean;
  model: string;
}

export interface TrainPosition {
  lat?: number;
  lng?: number;
  speed_kmh?: number;
  avg_speed_kmh?: number;
  bearing?: number;
  status?: string;
  delay_minutes?: number;
  station_code?: string;
  fetched_at?: number;
  error?: string;
}

export interface TrainPositionsMap {
  [train_id: string]: TrainPosition;
}

export interface WebSocketPositionMessage {
  type: string;
  data: TrainPositionsMap;
}