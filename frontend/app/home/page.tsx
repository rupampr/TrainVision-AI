"use client";

import { useState, useEffect, FormEvent } from "react";
import TopNav, { ConsoleViewMode } from "../components/TopNav";
import ScheduleView from "../components/ScheduleView";
import ControlPanel from "../components/ControlPanel";
import AIAssistant from "../components/AIAssistant";
import LiveRadar from "../components/LiveRadar";
import AnalyticsView from "../components/AnalyticsView";
import SimulationView from "../components/SimulationView";
import AuditLogModal from "../components/AuditLogModal";
import { Station, ScheduleEntry, Conflict, DataSourceInfo } from "../types";
import { fetchBackend } from "../utils/api";

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
    const [scheduleVersion, setScheduleVersion] = useState<string>("");
    const [dataSource, setDataSource] = useState<DataSourceInfo | null>(null);
    const [isRefreshingTrains, setIsRefreshingTrains] = useState<boolean>(false);

    const [currentStation, setCurrentStation] = useState<string>("ALL");
    const [overrideVisit, setOverrideVisit] = useState<string>("");
    const [overridePlatform, setOverridePlatform] = useState<string>("1");
    const [isAIOpen, setIsAIOpen] = useState<boolean>(false);
    const [isAuditOpen, setIsAuditOpen] = useState<boolean>(false);
    const [aiInitialQuery, setAiInitialQuery] = useState<string>("");
    const [viewMode, setViewMode] = useState<ConsoleViewMode>("schedule");

    const fetchDataSource = async () => {
        try {
            const res = await fetchBackend("/data-source");
            if (res.ok) {
                const info: DataSourceInfo = await res.json();
                setDataSource(info);
            }
        } catch (err) {
            console.warn("Could not load data source status:", err);
        }
    };

    // Load Stations & Data Source status
    useEffect(() => {
        fetchBackend("/stations")
            .then((res) => {
                if (!res.ok) throw new Error(`Status ${res.status}`);
                return res.json();
            })
            .then((data) => {
                if (Array.isArray(data) && data.length > 0) {
                    setStations(data);
                }
            })
            .catch((err) => console.warn("Could not refresh stations, keeping defaults:", err));

        fetchBackend("/data-source")
            .then((res) => (res.ok ? res.json() : null))
            .then((info: DataSourceInfo | null) => {
                if (info) setDataSource(info);
            })
            .catch((err) => console.warn("Could not load data source status:", err));
    }, []);

    // Load Schedule (re-runs when `algorithm` changes, polls every 15s)
    useEffect(() => {
        let cancelled = false;

        const fetchSchedule = async () => {
            try {
                const res = await fetchBackend(`/schedule?algorithm=${algorithm}`);
                if (!res.ok) {
                    console.warn(`Backend returned status ${res.status} for /schedule`);
                    return;
                }
                const data = await res.json();
                if (!cancelled && data && Array.isArray(data.schedule)) {
                    setSchedule(data.schedule);
                    setConflicts(data.conflicts || []);
                    setScheduleVersion(data.generated_at || "");

                    if (data.schedule.length > 0) {
                        const firstKey = `${data.schedule[0].train_id}|${data.schedule[0].station_id}`;
                        setOverrideVisit((prev) => prev || firstKey);
                    }
                }
            } catch (err) {
                console.warn("fetchSchedule connection warning:", err);
            }
        };

        fetchSchedule();
        const interval = setInterval(fetchSchedule, 15000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [algorithm]);

    const applyScheduleResponse = (data: {
        schedule?: ScheduleEntry[];
        conflicts?: Conflict[];
        generated_at?: string;
    }) => {
        if (data && Array.isArray(data.schedule)) {
            setSchedule(data.schedule);
            setConflicts(data.conflicts || []);
            setScheduleVersion(data.generated_at || "");
        }
    };

    const handleOverrideSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!overrideVisit) return;
        const [trainId, stationId] = overrideVisit.split("|");
        if (!trainId || !stationId) return;

        try {
            const res = await fetchBackend(`/override?algorithm=${algorithm}`, {
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
                applyScheduleResponse(data);
            }
        } catch (err) {
            console.error("Failed to apply override:", err);
        }
    };

    const handleDeleteOverride = async (trainId: string, stationId: string) => {
        try {
            const res = await fetchBackend(
                `/override/${encodeURIComponent(trainId)}/${encodeURIComponent(stationId)}?algorithm=${algorithm}`,
                { method: "DELETE" }
            );
            if (res.ok) {
                const data = await res.json();
                applyScheduleResponse(data);
            }
        } catch (err) {
            console.error("Failed to clear override:", err);
        }
    };

    const handleReset = async () => {
        try {
            const res = await fetchBackend(`/reset?algorithm=${algorithm}`, { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                applyScheduleResponse(data);
            }
        } catch (err) {
            console.error("Failed to reset overrides:", err);
        }
    };

    const handleRefreshTrains = async () => {
        if (isRefreshingTrains) return;
        setIsRefreshingTrains(true);
        try {
            await fetchBackend("/trains/refresh", { method: "POST" });
            await fetchDataSource();
            const schedRes = await fetchBackend(`/schedule?algorithm=${algorithm}`);
            if (schedRes.ok) {
                const data = await schedRes.json();
                applyScheduleResponse(data);
            }
        } catch (err) {
            console.error("Failed to refresh live trains:", err);
        } finally {
            setIsRefreshingTrains(false);
        }
    };

    // Filter data based on selected station
    const filteredSchedule = schedule.filter((e) => currentStation === "ALL" || e.station_id === currentStation);
    const filteredConflicts = conflicts.filter((c) => currentStation === "ALL" || c.station_id === currentStation);

    const viewLabel =
        viewMode === "radar"
            ? "Live Track Radar (WS)"
            : viewMode === "analytics"
            ? "Analytics & Platform Gantt"
            : viewMode === "simulation"
            ? "What-If Disruption Simulator"
            : "Timetable & Conflicts";

    return (
        <div className="min-h-screen bg-deep text-primary font-sans flex flex-col antialiased">
            <TopNav
                algorithm={algorithm}
                setAlgorithm={setAlgorithm}
                onToggleAI={() => setIsAIOpen((prev) => !prev)}
                isAIOpen={isAIOpen}
                viewMode={viewMode}
                setViewMode={setViewMode}
                dataSource={dataSource}
                onRefreshTrains={handleRefreshTrains}
                isRefreshingTrains={isRefreshingTrains}
                onOpenAuditLog={() => setIsAuditOpen(true)}
            />

            {/* Station Navigation Tab Strip */}
            <nav
                aria-label="Station Filter Navigation"
                className="flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-2.5 bg-panel-alt/60 border-b border-border overflow-x-auto backdrop-blur-sm"
            >
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-dim mr-1 hidden sm:inline-flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polygon points="3 11 22 2 13 21 11 13 3 11" />
                        </svg>
                        Sector:
                    </span>

                    <button
                        type="button"
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 border ${currentStation === "ALL"
                            ? "bg-cyan/15 border-cyan/40 text-cyan shadow-sm shadow-cyan/20 font-semibold"
                            : "bg-panel/60 border-border text-secondary hover:text-primary hover:bg-panel hover:border-slate-700"
                            }`}
                        onClick={() => setCurrentStation("ALL")}
                    >
                        <span>All Stations</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${currentStation === "ALL" ? "bg-cyan/20 text-cyan font-bold" : "bg-deep text-dim"
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
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 border whitespace-nowrap ${isSelected
                                    ? "bg-cyan/15 border-cyan/40 text-cyan shadow-sm shadow-cyan/20 font-semibold"
                                    : "bg-panel/60 border-border text-secondary hover:text-primary hover:bg-panel hover:border-slate-700"
                                    }`}
                                onClick={() => setCurrentStation(s.id)}
                            >
                                <span className="font-mono font-semibold">{s.id}</span>
                                <span className="opacity-70">&middot;</span>
                                <span>{s.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isSelected ? "bg-cyan/20 text-cyan font-bold" : "bg-deep text-dim"
                                    }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Console View Indicator */}
                <div className="hidden md:flex items-center gap-2 text-xs font-mono text-dim">
                    <span>Active View:</span>
                    <span className="text-cyan font-semibold uppercase">{viewLabel}</span>
                </div>
            </nav>

            {/* Main Control Console Dashboard */}
            <main className="flex-1 w-full max-w-[1760px] mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">
                {viewMode === "radar" ? (
                    <LiveRadar
                        schedule={schedule}
                        onSelectTrain={(trainId, stationId) => setOverrideVisit(`${trainId}|${stationId}`)}
                        onOpenAIWithQuery={(query) => {
                            setAiInitialQuery(query);
                            setIsAIOpen(true);
                        }}
                    />
                ) : viewMode === "analytics" ? (
                    <AnalyticsView
                        algorithm={algorithm}
                        setAlgorithm={setAlgorithm}
                        currentStation={currentStation}
                        stations={stations}
                        scheduleVersion={scheduleVersion}
                        onSelectTrain={(trainId, stationId) => setOverrideVisit(`${trainId}|${stationId}`)}
                    />
                ) : viewMode === "simulation" ? (
                    <SimulationView
                        algorithm={algorithm}
                        stations={stations}
                        schedule={schedule}
                    />
                ) : (
                    <ScheduleView schedule={filteredSchedule} />
                )}

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
                    onDeleteOverride={handleDeleteOverride}
                    onOpenAuditLog={() => setIsAuditOpen(true)}
                />
            </main>

            <AIAssistant
                isOpen={isAIOpen}
                onClose={() => setIsAIOpen(false)}
                algorithm={algorithm}
                onSelectTrain={(trainId, stationId) => setOverrideVisit(`${trainId}|${stationId}`)}
                initialQuery={aiInitialQuery}
            />

            <AuditLogModal
                isOpen={isAuditOpen}
                onClose={() => setIsAuditOpen(false)}
            />
        </div>
    );
}
