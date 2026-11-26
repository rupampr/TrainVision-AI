"use client";

import { useState } from "react";
import {
  DelayInjection,
  ExtraVisitInput,
  ScheduleEntry,
  SimulationResponse,
  Station,
} from "../types";
import { fetchBackend } from "../utils/api";

interface Props {
  algorithm: "greedy" | "ilp";
  stations: Station[];
  schedule: ScheduleEntry[];
}

export default function SimulationView({ algorithm, stations, schedule }: Props) {
  const [blockedPlatforms, setBlockedPlatforms] = useState<Record<string, number[]>>({});
  const [delayInjections, setDelayInjections] = useState<DelayInjection[]>([]);
  const [extraVisits, setExtraVisits] = useState<ExtraVisitInput[]>([]);

  // Delay injection form state
  const [selectedVisit, setSelectedVisit] = useState<string>(
    schedule[0] ? `${schedule[0].train_id}|${schedule[0].station_id}` : ""
  );
  const [delayMinutes, setDelayMinutes] = useState<number>(15);

  // Extra train form state
  const [extraTrainId, setExtraTrainId] = useState<string>("SPL-901");
  const [extraName, setExtraName] = useState<string>("Emergency Relief Special");
  const [extraStation, setExtraStation] = useState<string>(stations[0]?.id || "HWH");
  const [extraArr, setExtraArr] = useState<string>("08:06");
  const [extraDep, setExtraDep] = useState<string>("08:18");
  const [extraPriority, setExtraPriority] = useState<number>(9);
  const [extraPref, setExtraPref] = useState<number>(1);

  const [simResult, setSimResult] = useState<SimulationResponse | null>(null);
  const [running, setRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeVisitValue =
    selectedVisit ||
    (schedule[0] ? `${schedule[0].train_id}|${schedule[0].station_id}` : "");

  const toggleBlockedPlatform = (stationId: string, platform: number, totalPlatforms: number) => {
    setBlockedPlatforms((prev) => {
      const current = prev[stationId] || [];
      const exists = current.includes(platform);
      if (exists) {
        const next = current.filter((p) => p !== platform);
        return { ...prev, [stationId]: next };
      }
      if (current.length + 1 >= totalPlatforms) {
        return prev; // Always keep at least 1 platform open
      }
      return { ...prev, [stationId]: [...current, platform].sort((a, b) => a - b) };
    });
  };

  const addDelayInjection = () => {
    if (!activeVisitValue) return;
    const [trainId, stationId] = activeVisitValue.split("|");
    if (!trainId || !stationId) return;
    const mins = Math.max(1, Math.min(180, Number(delayMinutes) || 10));

    setDelayInjections((prev) => {
      const filtered = prev.filter(
        (d) => !(d.train_id === trainId && d.station_id === stationId)
      );
      return [...filtered, { train_id: trainId, station_id: stationId, extra_delay_minutes: mins }];
    });
  };

  const addExtraTrain = () => {
    const tid = extraTrainId.trim();
    if (!tid) return;
    setExtraVisits((prev) => [
      ...prev,
      {
        train_id: tid,
        name: extraName.trim() || `Special ${tid}`,
        type: "Special",
        priority: extraPriority,
        station_id: extraStation,
        scheduled_arrival: extraArr || "08:06",
        scheduled_departure: extraDep || "08:18",
        platform_pref: extraPref,
      },
    ]);
  };

  const runSimulation = async (
    overrideBlocked?: Record<string, number[]>,
    overrideDelays?: DelayInjection[],
    overrideExtras?: ExtraVisitInput[]
  ) => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetchBackend("/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algorithm,
          blocked_platforms: overrideBlocked ?? blockedPlatforms,
          delay_injections: overrideDelays ?? delayInjections,
          extra_visits: overrideExtras ?? extraVisits,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.detail || `Server returned ${res.status}`);
      }
      const data: SimulationResponse = await res.json();
      setSimResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  const applyPreset = (preset: "closure" | "cascade" | "relief") => {
    const firstSt = stations[0]?.id || "HWH";
    const firstTrain = schedule[0];
    if (preset === "closure") {
      const nextBlocked = { [firstSt]: [1] };
      setBlockedPlatforms(nextBlocked);
      setDelayInjections([]);
      setExtraVisits([]);
      runSimulation(nextBlocked, [], []);
    } else if (preset === "cascade" && firstTrain) {
      const nextDelays = [
        { train_id: firstTrain.train_id, station_id: firstTrain.station_id, extra_delay_minutes: 20 },
      ];
      setBlockedPlatforms({});
      setDelayInjections(nextDelays);
      setExtraVisits([]);
      runSimulation({}, nextDelays, []);
    } else {
      const arr = firstTrain?.actual_arrival || "08:06";
      const nextExtra: ExtraVisitInput[] = [
        {
          train_id: "SPL-901",
          name: "Emergency Relief Special",
          type: "Special",
          priority: 10,
          station_id: firstTrain?.station_id || firstSt,
          scheduled_arrival: arr,
          scheduled_departure: arr,
          platform_pref: 1,
        },
      ];
      setBlockedPlatforms({});
      setDelayInjections([]);
      setExtraVisits(nextExtra);
      runSimulation({}, [], nextExtra);
    }
  };

  const clearScenario = () => {
    setBlockedPlatforms({});
    setDelayInjections([]);
    setExtraVisits([]);
    setSimResult(null);
    setError(null);
  };

  const totalBlockedCount = Object.values(blockedPlatforms).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  return (
    <section aria-labelledby="simulation-heading" className="flex flex-col gap-6">
      {/* Header + Presets */}
      <div className="rounded-xl border border-border bg-panel/70 backdrop-blur-sm shadow-md shadow-black/20 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="simulation-heading" className="text-sm font-semibold tracking-wide text-primary">
                What-If Disruption Simulator
              </h2>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-cyan/10 border border-cyan/30 text-cyan">
                Non-Destructive Sandbox
              </span>
            </div>
            <p className="text-[11px] text-dim mt-0.5">
              Test platform closures, incoming delays, and emergency trains without altering live controller overrides
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => applyPreset("closure")}
              className="px-2.5 py-1.5 rounded-lg bg-deep border border-border hover:border-cyan/40 text-[11px] font-mono text-secondary hover:text-cyan transition-colors cursor-pointer"
            >
              Preset: Block {stations[0]?.id || "HWH"} PF 1
            </button>
            <button
              type="button"
              onClick={() => applyPreset("cascade")}
              className="px-2.5 py-1.5 rounded-lg bg-deep border border-border hover:border-amber/40 text-[11px] font-mono text-secondary hover:text-amber transition-colors cursor-pointer"
            >
              Preset: +20m Delay Cascade
            </button>
            <button
              type="button"
              onClick={() => applyPreset("relief")}
              className="px-2.5 py-1.5 rounded-lg bg-deep border border-border hover:border-emerald-500/40 text-[11px] font-mono text-secondary hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Preset: Relief Special
            </button>
          </div>
        </div>

        {/* Disruption Controls Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 1. Platform Closures */}
          <div className="p-4 rounded-xl bg-deep/60 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary">
                1. Platform Maintenance / Closure
              </h3>
              <span className="text-[10px] font-mono text-dim">{totalBlockedCount} blocked</span>
            </div>
            <div className="space-y-2.5">
              {stations.map((st) => {
                const blocked = blockedPlatforms[st.id] || [];
                return (
                  <div key={st.id} className="space-y-1">
                    <div className="text-[11px] font-mono text-primary">{st.id} &middot; {st.name}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: st.platforms }, (_, i) => i + 1).map((pf) => {
                        const isBlocked = blocked.includes(pf);
                        return (
                          <button
                            key={pf}
                            type="button"
                            onClick={() => toggleBlockedPlatform(st.id, pf, st.platforms)}
                            className={`px-2 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                              isBlocked
                                ? "bg-red/20 border-red/50 text-red font-semibold"
                                : "bg-panel border-border text-secondary hover:border-slate-600"
                            }`}
                          >
                            {isBlocked ? `PF ${pf} ✕` : `PF ${pf}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Delay Injection */}
          <div className="p-4 rounded-xl bg-deep/60 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary">
                2. Inject Incoming Delay
              </h3>
              <span className="text-[10px] font-mono text-dim">{delayInjections.length} active</span>
            </div>

            <div className="space-y-2">
              <select
                value={activeVisitValue}
                onChange={(e) => setSelectedVisit(e.target.value)}
                className="w-full bg-panel border border-border rounded-lg px-2.5 py-2 text-xs text-primary focus:outline-none focus:border-cyan"
              >
                {schedule.map((e, idx) => (
                  <option key={`${e.train_id}-${e.station_id}-${idx}`} value={`${e.train_id}|${e.station_id}`}>
                    {e.train_id} — {e.name} @ {e.station_id}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={delayMinutes}
                  onChange={(e) => setDelayMinutes(Number(e.target.value))}
                  className="w-24 bg-panel border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-primary focus:outline-none focus:border-cyan"
                />
                <span className="text-xs text-dim font-mono">min late</span>
                <button
                  type="button"
                  onClick={addDelayInjection}
                  disabled={!activeVisitValue}
                  className="ml-auto px-3 py-1.5 rounded-lg bg-amber/15 border border-amber/40 text-amber hover:bg-amber/25 text-xs font-mono font-semibold cursor-pointer disabled:opacity-50"
                >
                  + Add Delay
                </button>
              </div>
            </div>

            {delayInjections.length > 0 && (
              <div className="space-y-1.5 pt-1 max-h-28 overflow-y-auto">
                {delayInjections.map((d) => (
                  <div
                    key={`${d.train_id}-${d.station_id}`}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded bg-panel border border-amber/30 text-[11px] font-mono"
                  >
                    <span className="text-primary">
                      {d.train_id} @ {d.station_id}: <span className="text-amber">+{d.extra_delay_minutes}m</span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDelayInjections((prev) =>
                          prev.filter((x) => !(x.train_id === d.train_id && x.station_id === d.station_id))
                        )
                      }
                      className="text-dim hover:text-red cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Extra / Emergency Train */}
          <div className="p-4 rounded-xl bg-deep/60 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary">
                3. Insert Special Train
              </h3>
              <span className="text-[10px] font-mono text-dim">{extraVisits.length} added</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <input
                type="text"
                value={extraTrainId}
                onChange={(e) => setExtraTrainId(e.target.value)}
                placeholder="Train ID"
                className="bg-panel border border-border rounded-lg px-2.5 py-1.5 font-mono text-primary focus:outline-none focus:border-cyan"
              />
              <select
                value={extraStation}
                onChange={(e) => setExtraStation(e.target.value)}
                className="bg-panel border border-border rounded-lg px-2.5 py-1.5 font-mono text-primary focus:outline-none focus:border-cyan"
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={extraName}
                onChange={(e) => setExtraName(e.target.value)}
                placeholder="Train Name"
                className="col-span-2 bg-panel border border-border rounded-lg px-2.5 py-1.5 text-primary focus:outline-none focus:border-cyan"
              />
              <input
                type="time"
                value={extraArr}
                onChange={(e) => setExtraArr(e.target.value)}
                className="bg-panel border border-border rounded-lg px-2.5 py-1.5 font-mono text-primary focus:outline-none focus:border-cyan"
              />
              <input
                type="time"
                value={extraDep}
                onChange={(e) => setExtraDep(e.target.value)}
                className="bg-panel border border-border rounded-lg px-2.5 py-1.5 font-mono text-primary focus:outline-none focus:border-cyan"
              />
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-dim">Prio</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={extraPriority}
                  onChange={(e) => setExtraPriority(Number(e.target.value))}
                  className="w-full bg-panel border border-border rounded-lg px-2 py-1 font-mono text-primary"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-dim">PF</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={extraPref}
                  onChange={(e) => setExtraPref(Number(e.target.value))}
                  className="w-full bg-panel border border-border rounded-lg px-2 py-1 font-mono text-primary"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={addExtraTrain}
              className="w-full py-1.5 rounded-lg bg-cyan/15 border border-cyan/40 text-cyan hover:bg-cyan/25 text-xs font-mono font-semibold cursor-pointer"
            >
              + Add Special Train
            </button>

            {extraVisits.length > 0 && (
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {extraVisits.map((ex, i) => (
                  <div
                    key={`${ex.train_id}-${i}`}
                    className="flex items-center justify-between px-2 py-1 rounded bg-panel border border-cyan/30 text-[11px] font-mono"
                  >
                    <span className="truncate text-primary">
                      {ex.train_id} @ {ex.station_id} ({ex.scheduled_arrival})
                    </span>
                    <button
                      type="button"
                      onClick={() => setExtraVisits((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-dim hover:text-red cursor-pointer ml-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={clearScenario}
            className="px-3.5 py-2 rounded-lg border border-border bg-deep text-secondary hover:text-primary text-xs font-medium cursor-pointer"
          >
            Clear Scenario
          </button>

          <button
            type="button"
            disabled={running}
            onClick={() => runSimulation()}
            className="px-5 py-2.5 rounded-lg bg-cyan hover:bg-cyan-glow text-deep font-semibold text-xs uppercase tracking-wider shadow-md shadow-cyan/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {running ? "Running Simulation..." : `Run What-If Simulation (${algorithm.toUpperCase()})`}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg border border-red/30 bg-red/10 text-xs text-red font-mono">
            {error}
          </div>
        )}
      </div>

      {/* Simulation Results */}
      {simResult && (
        <div className="space-y-5">
          {/* Baseline vs Simulated KPI Delta Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-border bg-panel/70">
              <div className="text-[11px] uppercase tracking-wider text-dim">Simulated Total Delay</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-mono text-2xl font-bold text-primary">
                  {simResult.simulated_metrics.total_delay_minutes}m
                </span>
                <span
                  className={`font-mono text-xs ${
                    simResult.simulated_metrics.total_delay_minutes >
                    simResult.baseline_metrics.total_delay_minutes
                      ? "text-amber"
                      : "text-emerald-400"
                  }`}
                >
                  ({simResult.simulated_metrics.total_delay_minutes -
                    simResult.baseline_metrics.total_delay_minutes >= 0
                    ? "+"
                    : ""}
                  {simResult.simulated_metrics.total_delay_minutes -
                    simResult.baseline_metrics.total_delay_minutes}
                  m vs base)
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-panel/70">
              <div className="text-[11px] uppercase tracking-wider text-dim">Impacted Trains</div>
              <div className="font-mono text-2xl font-bold text-cyan mt-1">
                {simResult.impacted_trains.length}
              </div>
              <div className="text-[11px] text-dim">Changed platform or arrival</div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-panel/70">
              <div className="text-[11px] uppercase tracking-wider text-dim">Simulated On-Time</div>
              <div className="font-mono text-2xl font-bold text-emerald-400 mt-1">
                {simResult.simulated_metrics.on_time_pct}%
              </div>
              <div className="text-[11px] text-dim">
                Baseline: {simResult.baseline_metrics.on_time_pct}%
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-panel/70">
              <div className="text-[11px] uppercase tracking-wider text-dim">Simulated Conflicts</div>
              <div className="font-mono text-2xl font-bold text-amber mt-1">
                {simResult.simulated_metrics.conflict_count}
              </div>
              <div className="text-[11px] text-dim">
                Baseline: {simResult.baseline_metrics.conflict_count}
              </div>
            </div>
          </div>

          {/* Greedy vs ILP Comparison Under Disruption */}
          <div className="rounded-xl border border-border bg-panel/70 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-dim mb-3">
              Solver Comparison Under This Disruption
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {simResult.comparison.map((m) => (
                <div
                  key={m.algorithm}
                  className="p-3 rounded-lg bg-deep/70 border border-border flex items-center justify-between text-xs font-mono"
                >
                  <div>
                    <div className="font-bold text-primary uppercase">{m.algorithm}</div>
                    <div className="text-[11px] text-dim">Solve: {m.solve_time_ms} ms</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-dim block text-[10px]">DELAY</span>
                      <span className="text-amber font-bold">{m.total_delay_minutes}m</span>
                    </div>
                    <div>
                      <span className="text-dim block text-[10px]">WEIGHTED</span>
                      <span className="text-cyan font-bold">{m.weighted_delay}</span>
                    </div>
                    <div>
                      <span className="text-dim block text-[10px]">ON-TIME</span>
                      <span className="text-emerald-400 font-bold">{m.on_time_pct}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Impacted Trains Diff Table */}
          <div className="rounded-xl border border-border bg-panel/70 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-panel-alt/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-primary">
                Impacted Trains &amp; Cascading Changes
              </h3>
              <span className="text-xs font-mono text-dim">
                {simResult.impacted_trains.length} affected
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-panel-alt/30 text-[10px] uppercase tracking-wider text-dim">
                    <th className="px-4 py-2.5">Train</th>
                    <th className="px-4 py-2.5">Station</th>
                    <th className="px-4 py-2.5">Platform Shift</th>
                    <th className="px-4 py-2.5">Arrival Shift</th>
                    <th className="px-4 py-2.5">Delay Delta</th>
                    <th className="px-4 py-2.5">Resolution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {simResult.impacted_trains.length > 0 ? (
                    simResult.impacted_trains.map((item, idx) => (
                      <tr key={`${item.train_id}-${item.station_id}-${idx}`} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <div className="font-mono font-semibold text-primary">
                            {item.train_id}{" "}
                            {item.is_extra_train && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan/15 text-cyan">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-secondary">{item.name}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-secondary">{item.station_id}</td>
                        <td className="px-4 py-3 font-mono">
                          {item.baseline_platform ? (
                            <span>
                              PF {item.baseline_platform} &rarr;{" "}
                              <span className="text-cyan font-bold">PF {item.simulated_platform}</span>
                            </span>
                          ) : (
                            <span className="text-cyan font-bold">PF {item.simulated_platform}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {item.baseline_arrival ? (
                            <span>
                              {item.baseline_arrival} &rarr;{" "}
                              <span className="text-primary font-semibold">{item.simulated_arrival}</span>
                            </span>
                          ) : (
                            <span>{item.simulated_arrival}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          <span
                            className={`px-2 py-0.5 rounded border ${
                              item.delay_delta > 0
                                ? "bg-amber/10 border-amber/30 text-amber"
                                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            }`}
                          >
                            {item.delay_delta >= 0 ? `+${item.delay_delta}m` : `${item.delay_delta}m`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-secondary max-w-xs">{item.reason}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-dim font-mono">
                        No trains changed platform or arrival time under this scenario.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
