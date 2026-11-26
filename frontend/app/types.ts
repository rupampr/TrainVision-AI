// types.ts
export interface Station {
  id: string;
  name: string;
  platforms: number;
}

export interface ScheduleEntry {
  id?: string;
  train_id: string;
  station_id: string;
  name: string;
  type?: string;
  priority?: number;
  scheduled_arrival?: string;
  scheduled_departure?: string;
  assigned_platform: number;
  actual_arrival: string;
  actual_departure: string;
  delay_minutes: number;
  is_override: boolean;
  reason: string;
}

export interface Conflict {
  id?: string;
  severity: "critical" | "high" | "medium" | "low";
  trains_involved: string[];
  station_id: string;
  platform: number | null;
  type?: "platform_overlap" | "headway_violation";
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

export interface DataSourceInfo {
  source: string;
  fetched_at: string | null;
  cache_ttl_seconds: number;
  last_error: string | null;
}

export interface AuditLogItem {
  id: number;
  timestamp: string;
  action: string;
  train_id: string | null;
  station_id: string | null;
  platform: number | null;
  details: string | null;
}

export interface OverrideInfo {
  train_id: string;
  station_id: string;
  platform: number;
}

export interface AlgorithmMetrics {
  algorithm: "greedy" | "ilp";
  total_trains: number;
  delayed_trains: number;
  on_time_pct: number;
  total_delay_minutes: number;
  weighted_delay: number;
  max_delay_minutes: number;
  conflict_count: number;
  solve_time_ms: number;
}

export interface PlatformUtilization {
  platform: number;
  train_count: number;
  occupied_minutes: number;
  utilization_pct: number;
}

export interface StationAnalytics {
  station_id: string;
  station_name: string;
  total_platforms: number;
  train_count: number;
  delayed_count: number;
  total_delay_minutes: number;
  conflict_count: number;
  utilization_pct: number;
  platforms: PlatformUtilization[];
}

export interface AnalyticsResponse {
  active_algorithm: "greedy" | "ilp";
  schedule: ScheduleEntry[];
  conflicts: Conflict[];
  comparison: AlgorithmMetrics[];
  recommended_algorithm: "greedy" | "ilp";
  stations: StationAnalytics[];
  generated_at: string;
}

export interface DelayInjection {
  train_id: string;
  station_id: string;
  extra_delay_minutes: number;
}

export interface ExtraVisitInput {
  train_id: string;
  name: string;
  type: string;
  priority: number;
  station_id: string;
  scheduled_arrival: string;
  scheduled_departure: string;
  platform_pref: number;
}

export interface SimulationRequest {
  algorithm: "greedy" | "ilp";
  blocked_platforms: Record<string, number[]>;
  delay_injections: DelayInjection[];
  extra_visits: ExtraVisitInput[];
}

export interface SimulationImpactItem {
  train_id: string;
  name: string;
  station_id: string;
  baseline_platform: number | null;
  simulated_platform: number;
  baseline_arrival: string | null;
  simulated_arrival: string;
  baseline_delay: number;
  simulated_delay: number;
  delay_delta: number;
  is_extra_train: boolean;
  reason: string;
}

export interface SimulationResponse {
  algorithm: "greedy" | "ilp";
  baseline_metrics: AlgorithmMetrics;
  simulated_metrics: AlgorithmMetrics;
  comparison: AlgorithmMetrics[];
  schedule: ScheduleEntry[];
  conflicts: Conflict[];
  impacted_trains: SimulationImpactItem[];
  generated_at: string;
}