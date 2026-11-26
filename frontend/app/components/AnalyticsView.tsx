"use client";

import { useEffect, useMemo, useState } from "react";
import { AnalyticsResponse, ScheduleEntry, Station } from "../types";
import { fetchBackend } from "../utils/api";

interface Props {
  algorithm: "greedy" | "ilp";
  setAlgorithm: (algo: "greedy" | "ilp") => void;
  currentStation: string;
  stations: Station[];
  scheduleVersion: string;
  onSelectTrain?: (trainId: string, stationId: string) => void;
}

function toMinutes(hhmm: string): number {
  const parts = (hhmm || "00:00").split(":");
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  return h * 60 + m;
}

function toHHMM(totalMinutes: number): string {
  const m = ((totalMinutes % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function AnalyticsView({
  algorithm,
  setAlgorithm,
  currentStation,
  stations,
  scheduleVersion,
  onSelectTrain,
}: Props) {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [ganttStation, setGanttStation] = useState<string>(
    currentStation !== "ALL" ? currentStation : stations[0]?.id || "HWH"
  );
  const [hoveredEntry, setHoveredEntry] = useState<ScheduleEntry | null>(null);

  const activeGanttStation =
    currentStation !== "ALL"
      ? currentStation
      : stations.some((s) => s.id === ganttStation)
      ? ganttStation
      : stations[0]?.id || "HWH";

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchBackend(`/analytics?algorithm=${algorithm}`);
        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.detail || `Server returned ${res.status}`);
        }
        const data: AnalyticsResponse = await res.json();
        if (!cancelled) {
          setAnalytics(data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAnalytics();
    return () => {
      cancelled = true;
    };
  }, [algorithm, scheduleVersion]);

  const ganttData = useMemo(() => {
    const stationObj = stations.find((s) => s.id === activeGanttStation);
    const platformCount = stationObj?.platforms || 6;
    const entries = (analytics?.schedule || []).filter(
      (e) => e.station_id === activeGanttStation
    );

    if (entries.length === 0) {
      return {
        platformCount,
        entries,
        minStart: 8 * 60,
        maxEnd: 10 * 60,
        ticks: [8 * 60, 8 * 60 + 30, 9 * 60, 9 * 60 + 30, 10 * 60],
      };
    }

    const starts = entries.map((e) => toMinutes(e.actual_arrival));
    const ends = entries.map((e) => {
      const s = toMinutes(e.actual_arrival);
      let d = toMinutes(e.actual_departure) - s;
      if (d < 0) d += 1440;
      return s + Math.max(d, 5);
    });

    const rawMin = Math.min(...starts);
    const rawMax = Math.max(...ends);
    const minStart = Math.floor(rawMin / 15) * 15 - 10;
    const maxEnd = Math.max(minStart + 60, Math.ceil(rawMax / 15) * 15 + 10);

    const span = maxEnd - minStart;
    const step = span <= 90 ? 15 : span <= 240 ? 30 : 60;
    const ticks: number[] = [];
    const firstTick = Math.ceil(minStart / step) * step;
    for (let t = firstTick; t <= maxEnd; t += step) {
      ticks.push(t);
    }

    return { platformCount, entries, minStart, maxEnd, ticks };
  }, [analytics, activeGanttStation, stations]);

  const stationBreakdown = useMemo(() => {
    if (!analytics) return [];
    if (currentStation === "ALL") return analytics.stations;
    return analytics.stations.filter((s) => s.station_id === currentStation);
  }, [analytics, currentStation]);

  if (loading && !analytics) {
    return (
      <section className="p-10 rounded-xl border border-border bg-panel/60 flex flex-col items-center justify-center gap-3 text-dim">
        <div className="w-8 h-8 rounded-full border-2 border-cyan border-t-transparent animate-spin" />
        <p className="text-xs font-mono">Computing platform analytics &amp; Greedy vs ILP benchmarks...</p>
      </section>
    );
  }

  if (error && !analytics) {
    return (
      <section className="p-6 rounded-xl border border-red/30 bg-red/10 text-red text-xs font-mono">
        Failed to load analytics: {error}
      </section>
    );
  }

  const greedy = analytics?.comparison.find((m) => m.algorithm === "greedy");
  const ilp = analytics?.comparison.find((m) => m.algorithm === "ilp");
  const delaySaved =
    greedy && ilp ? greedy.total_delay_minutes - ilp.total_delay_minutes : 0;

  return (
    <section aria-labelledby="analytics-heading" className="flex flex-col gap-6">
      {/* 1. Greedy vs ILP Benchmark Comparison */}
      <div className="rounded-xl border border-border bg-panel/70 backdrop-blur-sm shadow-md shadow-black/20 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="analytics-heading" className="text-sm font-semibold tracking-wide text-primary">
                Optimizer Benchmark: Greedy vs ILP
              </h2>
              {analytics?.recommended_algorithm && (
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  Recommended: {analytics.recommended_algorithm.toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-[11px] text-dim mt-0.5">
              Live head-to-head comparison on current traffic &amp; manual overrides
              {delaySaved > 0 ? ` — ILP saves ${delaySaved} min total delay` : ""}
            </p>
          </div>
          {loading && (
            <span className="text-[11px] font-mono text-cyan animate-pulse">Refreshing...</span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[greedy, ilp].map((m) => {
            if (!m) return null;
            const isActive = algorithm === m.algorithm;
            const isRec = analytics?.recommended_algorithm === m.algorithm;
            return (
              <div
                key={m.algorithm}
                className={`p-4 rounded-xl border transition-all ${
                  isActive
                    ? "border-cyan/50 bg-cyan/5 shadow-sm shadow-cyan/10"
                    : "border-border bg-deep/50 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold uppercase text-primary">
                      {m.algorithm === "ilp" ? "ILP (PuLP CBC)" : "Greedy Heuristic"}
                    </span>
                    {isRec && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        Optimal Choice
                      </span>
                    )}
                  </div>
                  {isActive ? (
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan text-deep font-bold">
                      Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAlgorithm(m.algorithm)}
                      className="text-[11px] font-mono px-2.5 py-1 rounded border border-cyan/40 text-cyan hover:bg-cyan hover:text-deep transition-colors cursor-pointer"
                    >
                      Activate
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-panel/80 border border-border">
                    <div className="text-[10px] text-dim uppercase">Total Delay</div>
                    <div className="font-mono text-lg font-bold text-primary mt-0.5">
                      {m.total_delay_minutes}m
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-panel/80 border border-border">
                    <div className="text-[10px] text-dim uppercase">Weighted</div>
                    <div className="font-mono text-lg font-bold text-cyan mt-0.5">
                      {m.weighted_delay}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-panel/80 border border-border">
                    <div className="text-[10px] text-dim uppercase">On-Time</div>
                    <div className="font-mono text-lg font-bold text-emerald-400 mt-0.5">
                      {m.on_time_pct}%
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-secondary">
                  <span>Delayed: {m.delayed_trains}/{m.total_trains}</span>
                  <span>Conflicts: {m.conflict_count}</span>
                  <span>Solve: {m.solve_time_ms} ms</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Interactive Platform Occupancy Gantt Timeline */}
      <div className="rounded-xl border border-border bg-panel/70 backdrop-blur-sm shadow-md shadow-black/20 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-primary">
              Platform Occupancy Gantt Timeline
            </h3>
            <p className="text-[11px] text-dim mt-0.5">
              Click any train block to pre-fill it in the Controller Override panel
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {currentStation === "ALL" &&
              stations.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setGanttStation(s.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all cursor-pointer border ${
                    activeGanttStation === s.id
                      ? "bg-cyan/15 border-cyan/40 text-cyan font-semibold"
                      : "bg-deep border-border text-secondary hover:text-primary"
                  }`}
                >
                  {s.id}
                </button>
              ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500/80 border border-emerald-400" />
            On Time
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber/80 border border-amber" />
            Delayed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-cyan/80 border border-cyan" />
            Manual Override
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-red/80 border border-red" />
            Needs Review
          </span>
        </div>

        {/* Timeline Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[680px] space-y-2">
            {/* Time Header */}
            <div className="grid grid-cols-[72px_1fr] items-center">
              <div className="text-[10px] font-mono uppercase text-dim">Platform</div>
              <div className="relative h-6 border-b border-border">
                {ganttData.ticks.map((tick) => {
                  const pct =
                    ((tick - ganttData.minStart) / (ganttData.maxEnd - ganttData.minStart)) * 100;
                  if (pct < 0 || pct > 100) return null;
                  return (
                    <div
                      key={tick}
                      style={{ left: `${pct}%` }}
                      className="absolute top-0 -translate-x-1/2 text-[10px] font-mono text-dim"
                    >
                      {toHHMM(tick)}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Platform Rows */}
            {Array.from({ length: ganttData.platformCount }, (_, i) => i + 1).map((pf) => {
              const rowEntries = ganttData.entries.filter((e) => e.assigned_platform === pf);
              const span = ganttData.maxEnd - ganttData.minStart;
              return (
                <div key={pf} className="grid grid-cols-[72px_1fr] items-center gap-2">
                  <div className="text-xs font-mono font-semibold text-secondary px-2 py-2 rounded bg-deep border border-border text-center">
                    PF {pf}
                  </div>
                  <div className="relative h-10 rounded-lg bg-deep/80 border border-border overflow-hidden">
                    {/* Vertical tick lines */}
                    {ganttData.ticks.map((tick) => {
                      const pct = ((tick - ganttData.minStart) / span) * 100;
                      if (pct <= 0 || pct >= 100) return null;
                      return (
                        <div
                          key={tick}
                          style={{ left: `${pct}%` }}
                          className="absolute inset-y-0 w-px bg-border/60"
                        />
                      );
                    })}

                    {/* Train Blocks */}
                    {rowEntries.map((entry, idx) => {
                      const startMin = toMinutes(entry.actual_arrival);
                      let durMin = toMinutes(entry.actual_departure) - startMin;
                      if (durMin < 0) durMin += 1440;
                      durMin = Math.max(durMin, 5);

                      const leftPct = Math.max(0, ((startMin - ganttData.minStart) / span) * 100);
                      const widthPct = Math.max(4, Math.min(100 - leftPct, (durMin / span) * 100));

                      const needsReview = entry.reason?.toLowerCase().includes("review");
                      const colorCls = entry.is_override
                        ? "bg-cyan/25 border-cyan text-cyan hover:bg-cyan/35"
                        : needsReview
                        ? "bg-red/25 border-red text-red hover:bg-red/35"
                        : entry.delay_minutes > 0
                        ? "bg-amber/25 border-amber text-amber hover:bg-amber/35"
                        : "bg-emerald-500/20 border-emerald-400/70 text-emerald-300 hover:bg-emerald-500/30";

                      return (
                        <button
                          key={`${entry.train_id}-${idx}`}
                          type="button"
                          onMouseEnter={() => setHoveredEntry(entry)}
                          onClick={() => onSelectTrain?.(entry.train_id, entry.station_id)}
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          title={`${entry.train_id} (${entry.name}) ${entry.actual_arrival}-${entry.actual_departure}`}
                          className={`absolute top-1.5 bottom-1.5 rounded border px-1.5 text-[10px] font-mono font-semibold truncate transition-all cursor-pointer flex items-center justify-center ${colorCls}`}
                        >
                          {entry.train_id}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Inspected Train Detail Bar */}
        {hoveredEntry && (
          <div className="p-3 rounded-lg bg-deep/80 border border-border flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-mono">
              <span className="font-bold text-cyan">{hoveredEntry.train_id}</span>
              <span className="text-primary">{hoveredEntry.name}</span>
              <span className="text-dim">&bull;</span>
              <span className="text-secondary">
                {hoveredEntry.station_id} PF {hoveredEntry.assigned_platform}
              </span>
              <span className="text-dim">&bull;</span>
              <span className="text-primary">
                {hoveredEntry.actual_arrival}&ndash;{hoveredEntry.actual_departure}
              </span>
              {hoveredEntry.delay_minutes > 0 && (
                <span className="text-amber">(+{hoveredEntry.delay_minutes}m)</span>
              )}
            </div>
            <span className="text-[11px] text-secondary">{hoveredEntry.reason}</span>
          </div>
        )}
      </div>

      {/* 3. Station & Platform Utilization Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stationBreakdown.map((st) => (
          <div
            key={st.station_id}
            className="rounded-xl border border-border bg-panel/70 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-xs font-bold text-cyan">{st.station_id}</div>
                <div className="text-xs font-medium text-primary">{st.station_name}</div>
              </div>
              <span className="font-mono text-lg font-bold text-primary">
                {st.utilization_pct}%
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-secondary">
              <span>{st.train_count} visits</span>
              <span>{st.delayed_count} delayed</span>
              <span>{st.total_delay_minutes}m total</span>
            </div>

            <div className="space-y-1.5 pt-1">
              {st.platforms.map((p) => (
                <div key={p.platform} className="grid grid-cols-[44px_1fr_42px] items-center gap-2 text-[11px] font-mono">
                  <span className="text-dim">PF {p.platform}</span>
                  <div className="h-2 rounded-full bg-deep border border-border overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        p.utilization_pct >= 75
                          ? "bg-amber"
                          : p.utilization_pct > 0
                          ? "bg-cyan"
                          : "bg-slate-700"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, p.utilization_pct))}%` }}
                    />
                  </div>
                  <span className="text-right text-secondary">{p.train_count}t</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
