"use client";

import { useState, useEffect, FormEvent } from "react";
import TopNav from "./components/TopNav";
import ScheduleView from "./components/ScheduleView";
import ControlPanel from "./components/ControlPanel";
import { Station, ScheduleEntry, Conflict } from "./types";

const API_URL = "http://127.0.0.1:8000";

const INITIAL_STATIONS: Station[] = [
  { id: "HWH", name: "Howrah Junction", platforms: 8 },
  { id: "SRC", name: "Santragachi Junction", platforms: 4 },
  { id: "KGP", name: "Kharagpur Junction", platforms: 6 },
];

export default function ControlCenter() {
  const [algorithm, setAlgorithm] = useState<"greedy" | "ilp">("greedy");
  const [stations, setStations] = useState<Station[]>(INITIAL_STATIONS);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  const [currentStation, setCurrentStation] = useState<string>("ALL");
  const [overrideVisit, setOverrideVisit] = useState<string>("");
  const [overridePlatform, setOverridePlatform] = useState<string>("1");

  // Load Stations
  useEffect(() => {
    fetch(`${API_URL}/stations`)
      .then((res) => res.json())
      .then(setStations)
      .catch(console.error);
  }, []);

  // Load Schedule (Re-runs automatically when `algorithm` state changes)
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const res = await fetch(`${API_URL}/schedule?algorithm=${algorithm}`);
        const data = await res.json();
        setSchedule(data.schedule);
        setConflicts(data.conflicts);

        if (!overrideVisit && data.schedule && data.schedule.length > 0) {
          setOverrideVisit(`${data.schedule[0].train_id}|${data.schedule[0].station_id}`);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchSchedule();
    const interval = setInterval(fetchSchedule, 15000);
    return () => clearInterval(interval);
  }, [overrideVisit, algorithm]); 

  const handleOverrideSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!overrideVisit) return;
    const [trainId, stationId] = overrideVisit.split("|");
    if (!trainId || !stationId) return;

    try {
      const res = await fetch(`${API_URL}/override?algorithm=${algorithm}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          train_id: trainId,
          station_id: stationId,
          platform: parseInt(overridePlatform, 10),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSchedule(data.schedule);
        setConflicts(data.conflicts);
      }
    } catch (err) {
      console.error("Failed to apply override:", err);
    }
  };

  const handleReset = async () => {
    try {
      const res = await fetch(`${API_URL}/reset?algorithm=${algorithm}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSchedule(data.schedule);
        setConflicts(data.conflicts);
      }
    } catch (err) {
      console.error("Failed to reset overrides:", err);
    }
  };

  // Filter data based on selected station
  const filteredSchedule = schedule.filter((e) => currentStation === "ALL" || e.station_id === currentStation);
  const filteredConflicts = conflicts.filter((c) => currentStation === "ALL" || c.station_id === currentStation);

  return (
    <div className="min-h-screen bg-deep text-primary font-sans flex flex-col antialiased">
      <TopNav algorithm={algorithm} setAlgorithm={setAlgorithm} />

      {/* Station Navigation Tab Strip */}
      <nav 
        aria-label="Station Filter Navigation" 
        className="flex items-center gap-2 px-4 sm:px-6 lg:px-8 py-2.5 bg-panel-alt/60 border-b border-border overflow-x-auto backdrop-blur-sm"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-dim mr-1 hidden sm:inline-flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="3 11 22 2 13 21 11 13 3 11" />
          </svg>
          Stations:
        </span>

        <button
          type="button"
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 border ${
            currentStation === "ALL"
              ? "bg-cyan/15 border-cyan/40 text-cyan shadow-sm shadow-cyan/20 font-semibold"
              : "bg-panel/60 border-border text-secondary hover:text-primary hover:bg-panel hover:border-slate-700"
          }`}
          onClick={() => setCurrentStation("ALL")}
        >
          <span>All Stations</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            currentStation === "ALL" ? "bg-cyan/20 text-cyan font-bold" : "bg-deep text-dim"
          }`}>
            {schedule.length}
          </span>
        </button>

        {stations.map((s) => {
          const count = schedule.filter((e) => e.station_id === s.id).length;
          const isSelected = currentStation === s.id;
          return (
            <button
              key={s.id}
              type="button"
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 border whitespace-nowrap ${
                isSelected
                  ? "bg-cyan/15 border-cyan/40 text-cyan shadow-sm shadow-cyan/20 font-semibold"
                  : "bg-panel/60 border-border text-secondary hover:text-primary hover:bg-panel hover:border-slate-700"
              }`}
              onClick={() => setCurrentStation(s.id)}
            >
              <span className="font-mono font-semibold">{s.id}</span>
              <span className="opacity-70">&middot;</span>
              <span>{s.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isSelected ? "bg-cyan/20 text-cyan font-bold" : "bg-deep text-dim"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Main Control Console Dashboard */}
      <main className="flex-1 w-full max-w-[1760px] mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">
        <ScheduleView schedule={filteredSchedule} />
        <ControlPanel
          conflicts={filteredConflicts}
          schedule={schedule}
          stations={stations}
          overrideVisit={overrideVisit}
          setOverrideVisit={setOverrideVisit}
          overridePlatform={overridePlatform}
          setOverridePlatform={setOverridePlatform}
          onSubmit={handleOverrideSubmit}
          onReset={handleReset}
        />
      </main>
    </div>
  );
}