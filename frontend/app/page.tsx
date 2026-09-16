"use client";

import { useState, useEffect, FormEvent } from "react";

const API_URL = "http://127.0.0.1:8000";

// --- TypeScript Interfaces ---
interface Station {
  id: string;
  name: string;
  platforms: number;
}

interface ScheduleEntry {
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

interface Conflict {
  severity: "critical" | "high" | "medium";
  trains_involved: string[];
  station_id: string;
  platform: number;
  root_cause: string;
  resolution: string;
}

export default function ControlCenter() {
  const [time, setTime] = useState<string>("--:--:--");
  const [stations, setStations] = useState<Station[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  // UI State
  const [currentStation, setCurrentStation] = useState<string>("ALL");
  const [overrideVisit, setOverrideVisit] = useState<string>("");
  const [overridePlatform, setOverridePlatform] = useState<string>("");

  // 1. Clock Effect
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString());
    tick(); // Initial set
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Initial Data Fetch
  useEffect(() => {
    const fetchStations = async () => {
      try {
        const res = await fetch(`${API_URL}/stations`);
        const data: Station[] = await res.json();
        setStations(data);
      } catch (err) {
        console.error("Failed to load stations:", err);
      }
    };
    fetchStations();
  }, []);

  // 3. Periodic Schedule Fetch
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const res = await fetch(`${API_URL}/schedule`);
        const data = await res.json();
        setSchedule(data.schedule);
        setConflicts(data.conflicts);

        // Auto-select first visit for the override form if not set
        if (!overrideVisit && data.schedule.length > 0) {
          setOverrideVisit(`${data.schedule[0].train_id}|${data.schedule[0].station_id}`);
        }
      } catch (err) {
        console.error("Failed to load schedule:", err);
      }
    };

    fetchSchedule();
    const interval = setInterval(fetchSchedule, 15000);
    return () => clearInterval(interval);
  }, [overrideVisit]);

  // Derived state for the UI
  const filteredSchedule = schedule.filter(
    (e) => currentStation === "ALL" || e.station_id === currentStation
  );

  const filteredConflicts = conflicts.filter(
    (c) => currentStation === "ALL" || c.station_id === currentStation
  );

  const totalTrains = filteredSchedule.length;
  const delayedTrains = filteredSchedule.filter((e) => e.delay_minutes > 0).length;
  const onTimePct = totalTrains ? Math.round(((totalTrains - delayedTrains) / totalTrains) * 100) : 100;

  // Derive available platforms for the currently selected override station
  const selectedStationId = overrideVisit.split("|")[1];
  const stationObj = stations.find((s) => s.id === selectedStationId);
  const platformCount = stationObj ? stationObj.platforms : 1;
  const platformOptions = Array.from({ length: platformCount }, (_, i) => i + 1);

  // Auto-select platform 1 when the station changes if the current platform is invalid
  useEffect(() => {
    if (!overridePlatform || Number(overridePlatform) > platformCount) {
      setOverridePlatform("1");
    }
  }, [overrideVisit, platformCount, overridePlatform]);

  // Handlers
  const handleOverrideSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!overrideVisit || !overridePlatform) return;

    const [trainId, stationId] = overrideVisit.split("|");
    const platform = parseInt(overridePlatform, 10);

    try {
      const res = await fetch(`${API_URL}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ train_id: trainId, station_id: stationId, platform }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Override rejected: ${err.detail}`);
        return;
      }

      const data = await res.json();
      setSchedule(data.schedule);
      setConflicts(data.conflicts);
    } catch (err) {
      console.error(err);
      alert("Failed to apply override.");
    }
  };

  const handleReset = async () => {
    try {
      const res = await fetch(`${API_URL}/reset`, { method: "POST" });
      const data = await res.json();
      setSchedule(data.schedule);
      setConflicts(data.conflicts);
    } catch (err) {
      console.error("Failed to reset overrides:", err);
    }
  };

  // Helper for badges
  const renderStatusBadge = (entry: ScheduleEntry) => {
    if (entry.is_override) {
      return <span className="inline-block text-[11px] px-2 py-0.5 border border-cyan text-cyan bg-cyan-dim font-sans">Override</span>;
    }
    if (entry.reason.includes("review")) {
      return <span className="inline-block text-[11px] px-2 py-0.5 border border-red text-red bg-red-dim font-sans">Needs review</span>;
    }
    if (entry.delay_minutes > 0) {
      return <span className="inline-block text-[11px] px-2 py-0.5 border border-amber text-amber bg-amber-dim font-sans">+{entry.delay_minutes} min</span>;
    }
    return <span className="inline-block text-[11px] px-2 py-0.5 border border-green text-green font-sans">On time</span>;
  };

  return (
    <div className="min-h-screen bg-deep text-primary font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-7 py-4 border-b border-border bg-panel-alt">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-medium m-0 tracking-wide">TrainVision AI</h1>
          <span className="text-secondary text-[13px]">Control Center — HYB · SC · KCG</span>
        </div>
        <div className="font-mono text-cyan text-[15px]">{time}</div>
      </header>

      {/* Navigation */}
      <nav className="flex gap-1.5 px-7 py-3 bg-panel-alt border-b border-border">
        <button
          className={`bg-transparent border px-4 py-1.5 font-sans text-[13px] cursor-pointer ${
            currentStation === "ALL"
              ? "border-cyan text-cyan bg-cyan-dim"
              : "border-border text-secondary"
          }`}
          onClick={() => setCurrentStation("ALL")}
        >
          All stations
        </button>
        {stations.map((s) => (
          <button
            key={s.id}
            className={`bg-transparent border px-4 py-1.5 font-sans text-[13px] cursor-pointer ${
              currentStation === s.id
                ? "border-cyan text-cyan bg-cyan-dim"
                : "border-border text-secondary"
            }`}
            onClick={() => setCurrentStation(s.id)}
          >
            {s.id} — {s.name}
          </button>
        ))}
      </nav>

      {/* Main Content Layout */}
      <main className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-[1px] bg-border">
        
        {/* Left Panel: Schedule */}
        <section className="bg-deep px-7 py-5">
          {/* Stats Row */}
          <div className="flex flex-wrap gap-4 mt-1.5 mb-4">
            <div className="border border-border p-2.5 px-4 bg-panel min-w-[110px]">
              <div className="font-mono text-xl text-cyan">{totalTrains}</div>
              <div className="text-[11px] text-secondary">Trains scheduled</div>
            </div>
            <div className="border border-border p-2.5 px-4 bg-panel min-w-[110px]">
              <div className="font-mono text-xl text-cyan">{delayedTrains}</div>
              <div className="text-[11px] text-secondary">Delayed / reassigned</div>
            </div>
            <div className="border border-border p-2.5 px-4 bg-panel min-w-[110px]">
              <div className="font-mono text-xl text-cyan">{onTimePct}%</div>
              <div className="text-[11px] text-secondary">On-time rate</div>
            </div>
          </div>

          <h2 className="text-[13px] text-secondary font-medium m-0 mb-3 normal-case">
            Live schedule
          </h2>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="text-left text-dim font-medium text-[11px] px-2.5 py-1.5 border-b border-border">Train</th>
                <th className="text-left text-dim font-medium text-[11px] px-2.5 py-1.5 border-b border-border">Station</th>
                <th className="text-left text-dim font-medium text-[11px] px-2.5 py-1.5 border-b border-border">Platform</th>
                <th className="text-left text-dim font-medium text-[11px] px-2.5 py-1.5 border-b border-border">Arrival</th>
                <th className="text-left text-dim font-medium text-[11px] px-2.5 py-1.5 border-b border-border">Departure</th>
                <th className="text-left text-dim font-medium text-[11px] px-2.5 py-1.5 border-b border-border">Status</th>
                <th className="text-left text-dim font-medium text-[11px] px-2.5 py-1.5 border-b border-border">Reason</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchedule.length > 0 ? (
                filteredSchedule.map((e, idx) => (
                  <tr key={`${e.train_id}-${e.station_id}-${idx}`} className="hover:bg-row-hover">
                    <td className="px-2.5 py-2 border-b border-panel text-primary font-sans">
                      {e.train_id}
                      <span className="block font-sans text-[10px] text-dim">{e.name}</span>
                    </td>
                    <td className="px-2.5 py-2 border-b border-panel font-mono text-primary">{e.station_id}</td>
                    <td className="px-2.5 py-2 border-b border-panel font-mono text-primary">{e.assigned_platform}</td>
                    <td className="px-2.5 py-2 border-b border-panel font-mono text-primary">{e.actual_arrival}</td>
                    <td className="px-2.5 py-2 border-b border-panel font-mono text-primary">{e.actual_departure}</td>
                    <td className="px-2.5 py-2 border-b border-panel font-mono text-primary">{renderStatusBadge(e)}</td>
                    <td className="px-2.5 py-2 border-b border-panel font-sans text-[12px] text-secondary">{e.reason}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-dim text-[12px] py-2 text-center">
                    No trains scheduled for this station.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Right Panel: Conflicts & Overrides */}
        <section className="bg-deep px-7 py-5">
          <h2 className="text-[13px] text-secondary font-medium m-0 mb-3 normal-case">
            Conflicts detected &amp; resolved
          </h2>
          <div>
            {filteredConflicts.length > 0 ? (
              filteredConflicts.map((c, idx) => {
                const sevColor = 
                  c.severity === "critical" ? "text-red border-red" :
                  c.severity === "high" ? "text-amber border-amber" :
                  "text-secondary border-border";

                return (
                  <div className="border border-border p-3 mb-2.5 bg-panel" key={idx}>
                    <span className={`text-[10px] font-sans px-1.5 py-[1px] inline-block mb-1.5 border uppercase ${sevColor}`}>
                      {c.severity}
                    </span>
                    <div className="text-[12px] text-primary my-1">
                      {c.trains_involved.join(" vs ")} — platform {c.platform}, {c.station_id}
                    </div>
                    <div className="text-secondary font-sans text-[12px]">{c.root_cause}</div>
                    <div className="text-[12px] text-cyan mt-1">Fix: {c.resolution}</div>
                  </div>
                );
              })
            ) : (
              <div className="text-dim text-[12px] py-2">
                No conflicts for this view — all clashes were resolved automatically.
              </div>
            )}
          </div>

          <h2 className="text-[13px] text-secondary font-medium m-0 mb-3 mt-6 normal-case">
            Controller override
          </h2>
          <form className="flex flex-col gap-2.5 mt-1.5" onSubmit={handleOverrideSubmit}>
            <div>
              <label className="text-[11px] text-secondary block mb-1">Train visit</label>
              <select
                required
                value={overrideVisit}
                onChange={(e) => setOverrideVisit(e.target.value)}
                className="w-full bg-panel border border-border text-primary p-2 font-sans text-[13px]"
              >
                {schedule.map((e, idx) => (
                  <option key={idx} value={`${e.train_id}|${e.station_id}`}>
                    {e.train_id} — {e.name} @ {e.station_id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-secondary block mb-1">Assign platform</label>
              <select
                required
                value={overridePlatform}
                onChange={(e) => setOverridePlatform(e.target.value)}
                className="w-full bg-panel border border-border text-primary p-2 font-sans text-[13px]"
              >
                {platformOptions.map((p) => (
                  <option key={p} value={p}>
                    Platform {p}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="bg-panel border border-cyan text-cyan p-2 font-sans text-[13px] cursor-pointer hover:bg-cyan-dim transition-colors"
            >
              Apply override &amp; re-optimize
            </button>
          </form>

          <button
            className="mt-2.5 bg-transparent border border-border text-secondary text-[12px] px-3 py-1 cursor-pointer font-sans hover:text-red hover:border-red transition-colors"
            onClick={handleReset}
          >
            Reset all overrides
          </button>
        </section>
      </main>
    </div>
  );
}