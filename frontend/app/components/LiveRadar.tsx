"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { TrainPositionsMap, TrainPosition, ScheduleEntry } from "../types";
import { fetchBackend, getWebSocketUrl } from "../utils/api";

interface Props {
  schedule?: ScheduleEntry[];
  onSelectTrain?: (trainId: string, stationId: string) => void;
  onOpenAIWithQuery?: (query: string) => void;
}

// Coordinate bounds for the KGP -> SRC -> HWH South Eastern Railway line
const CORRIDOR_STATIONS = [
  { id: "KGP", name: "Kharagpur Jn", platforms: 6, lng: 87.3245, lat: 22.3428, xPct: 12 },
  { id: "SRC", name: "Santragachi Jn", platforms: 4, lng: 88.2789, lat: 22.5821, xPct: 56 },
  { id: "HWH", name: "Howrah Jn", platforms: 8, lng: 88.3424, lat: 22.5833, xPct: 88 },
];

function getCardinalDirection(angle: number = 0): string {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(((angle %= 360) < 0 ? angle + 360 : angle) / 22.5) % 16;
  return directions[index];
}

export default function LiveRadar({ schedule = [], onSelectTrain, onOpenAIWithQuery }: Props) {
  const [positions, setPositions] = useState<TrainPositionsMap>({});
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "disconnected">("connecting");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedTrainId, setSelectedTrainId] = useState<string | null>(null);
  const [sectorFilter, setSectorFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initial HTTP hydration so positions are visible immediately
  const fetchInitialPositions = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetchBackend("/train-positions");
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === "object") {
          setPositions(data);
          setLastUpdated(new Date());
          // Auto-select first active train if none selected
          const firstTrain = Object.keys(data)[0];
          if (firstTrain && !selectedTrainId) {
            setSelectedTrainId(firstTrain);
          }
        }
      }
    } catch (err) {
      console.warn("Initial train-positions hydration warning:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Connect to WebSocket with auto-reconnect & heartbeat
  useEffect(() => {
    fetchInitialPositions();

    const connectWebSocket = () => {
      setConnectionStatus("connecting");
      const url = getWebSocketUrl("/ws");

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnectionStatus("connected");
          // Heartbeat ping every 25s to keep connection alive
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send("ping");
            }
          }, 25000);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === "positions" && message.data) {
              setPositions(message.data);
              setLastUpdated(new Date());
            }
          } catch {
            // Ignore non-json heartbeats
          }
        };

        ws.onerror = (err) => {
          console.warn("WebSocket error:", err);
          ws.close();
        };

        ws.onclose = () => {
          setConnectionStatus("disconnected");
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
          // Reconnect with backoff
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
        };
      } catch (err) {
        console.warn("Failed to initiate WebSocket:", err);
        setConnectionStatus("disconnected");
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 6000);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, []);

  // Compute stats
  const trackedTrains = useMemo(() => {
    return Object.entries(positions).map(([trainId, pos]) => {
      const matchedSchedule = schedule.find((s) => s.train_id === trainId);
      return {
        trainId,
        position: pos,
        name: matchedSchedule?.name || `Train #${trainId}`,
        stationId: pos.station_code || matchedSchedule?.station_id || "HWH",
        platform: matchedSchedule?.assigned_platform,
      };
    });
  }, [positions, schedule]);

  // Filtered train list
  const filteredTrains = useMemo(() => {
    return trackedTrains.filter((item) => {
      const matchesSector = sectorFilter === "ALL" || item.stationId === sectorFilter;
      const matchesQuery =
        !searchQuery.trim() ||
        item.trainId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSector && matchesQuery;
    });
  }, [trackedTrains, sectorFilter, searchQuery]);

  // Selected train details
  const selectedTrainData = useMemo(() => {
    if (!selectedTrainId) return null;
    return trackedTrains.find((t) => t.trainId === selectedTrainId) || null;
  }, [selectedTrainId, trackedTrains]);

  // Normalize train position (LNG 87.32 -> 88.35) into percentage for corridor display
  const getNormalizedX = (pos: TrainPosition, stationCode?: string): number => {
    if (pos.lng !== undefined && pos.lng !== null) {
      const minLng = 87.25;
      const maxLng = 88.42;
      const clamped = Math.max(minLng, Math.min(maxLng, pos.lng));
      return ((clamped - minLng) / (maxLng - minLng)) * 80 + 10;
    }
    // Fallback to station anchor
    if (stationCode === "KGP") return 15;
    if (stationCode === "SRC") return 55;
    return 85;
  };

  return (
    <section aria-labelledby="live-radar-heading" className="flex flex-col gap-5">
      {/* Top Telemetry & Controls Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-border bg-panel-alt/80 backdrop-blur-md shadow-md shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-cyan/10 border border-cyan/30 text-cyan shadow-sm shadow-cyan/20">
            <svg className="w-5 h-5 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="2" fill="currentColor" />
              <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 id="live-radar-heading" className="text-sm font-semibold tracking-tight text-primary">
                Live Track Radar &amp; Telemetry
              </h2>
              {/* WebSocket Status Indicator */}
              {connectionStatus === "connected" && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-wide uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  WS Live (10s)
                </span>
              )}
              {connectionStatus === "connecting" && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-wide uppercase bg-amber/10 border border-amber/20 text-amber">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
                  Connecting...
                </span>
              )}
              {connectionStatus === "disconnected" && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-wide uppercase bg-red/10 border border-red/20 text-red">
                  <span className="w-1.5 h-1.5 rounded-full bg-red" />
                  WS Offline
                </span>
              )}
            </div>
            <p className="text-[11px] text-dim font-mono">
              South Eastern Railway Corridor &middot; Real-time GPS &amp; Speed Extrapolation
              {lastUpdated && (
                <span className="ml-2 text-secondary">
                  &middot; Synced {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Quick Actions & Sector Filters */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-0.5 rounded-lg bg-deep border border-border text-xs">
            {["ALL", "HWH", "SRC", "KGP"].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setSectorFilter(code)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all cursor-pointer ${
                  sectorFilter === code
                    ? "bg-cyan text-deep font-semibold shadow-xs"
                    : "text-secondary hover:text-primary"
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={fetchInitialPositions}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-panel border border-border hover:border-cyan/40 text-secondary hover:text-cyan text-xs font-mono transition-all cursor-pointer disabled:opacity-50"
            title="Force refresh train positions via API"
          >
            <svg className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            <span className="hidden sm:inline">Sync</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Track Radar Canvas */}
      <div className="relative w-full rounded-2xl border border-border bg-gradient-to-b from-panel/90 to-deep/95 p-6 overflow-hidden shadow-xl shadow-black/40">
        {/* Subtle Radar Background Grid & Glow Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#33415515_1px,transparent_1px),linear-gradient(to_bottom,#33415515_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-widest text-cyan flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan animate-ping" />
              Mainline Sector Track Visualizer (KGP &harr; SRC &harr; HWH)
            </span>
            <span className="text-[11px] font-mono text-dim">
              Tracking {trackedTrains.length} trains live
            </span>
          </div>

          {/* Interactive Schematic Track View */}
          <div className="relative py-12 px-4 my-2 select-none">
            {/* Dual Mainline Tracks */}
            <div className="relative h-12 flex flex-col justify-center gap-3">
              {/* Up Line */}
              <div className="relative h-1.5 w-full bg-slate-800 rounded-full border border-slate-700/60 shadow-inner">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan/30 via-cyan/60 to-cyan/30 rounded-full" />
                {/* Track ties / sleepers markings */}
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_14px,#475569_14px,#475569_16px)] opacity-40" />
              </div>

              {/* Down Line */}
              <div className="relative h-1.5 w-full bg-slate-800 rounded-full border border-slate-700/60 shadow-inner">
                <div className="absolute inset-0 bg-gradient-to-r from-slate-700 via-cyan/40 to-slate-700 rounded-full" />
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_14px,#475569_14px,#475569_16px)] opacity-40" />
              </div>
            </div>

            {/* Station Anchors */}
            {CORRIDOR_STATIONS.map((station) => (
              <div
                key={station.id}
                style={{ left: `${station.xPct}%` }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center group cursor-pointer"
                onClick={() => setSectorFilter(station.id)}
              >
                {/* Outer Station Radar Ring */}
                <div className="w-12 h-12 rounded-full border border-cyan/40 bg-deep/90 flex items-center justify-center shadow-lg shadow-cyan/20 group-hover:border-cyan group-hover:scale-110 transition-all duration-200">
                  <div className="w-5 h-5 rounded-full bg-cyan/20 border border-cyan/60 flex items-center justify-center text-cyan">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="4" y="3" width="16" height="16" rx="2" />
                      <path d="M4 11h16" />
                    </svg>
                  </div>
                </div>

                {/* Station Label & Platform count */}
                <div className="mt-3 text-center">
                  <span className="font-mono text-xs font-bold text-slate-100 tracking-wider block group-hover:text-cyan transition-colors">
                    {station.id}
                  </span>
                  <span className="text-[10px] text-dim block whitespace-nowrap">
                    {station.name}
                  </span>
                  <span className="text-[9px] font-mono text-cyan/80 bg-cyan/10 px-1.5 py-0.2 rounded border border-cyan/20 mt-0.5 inline-block">
                    {station.platforms} PFs
                  </span>
                </div>
              </div>
            ))}

            {/* Live Train Blips along Track */}
            {filteredTrains.map((item) => {
              const xPos = getNormalizedX(item.position, item.stationId);
              const isSelected = selectedTrainId === item.trainId;
              const speed = item.position.speed_kmh || 0;
              const bearing = item.position.bearing || 0;
              const delay = item.position.delay_minutes || 0;
              const isHalted = speed === 0;

              return (
                <div
                  key={item.trainId}
                  style={{ left: `${xPos}%`, top: "35%" }}
                  onClick={() => setSelectedTrainId(item.trainId)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group transition-transform duration-300 ${
                    isSelected ? "scale-125 z-30" : "hover:scale-115"
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Train ${item.trainId} status`}
                >
                  {/* Train Marker Ping Circle */}
                  <div className="relative">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center border shadow-lg transition-all ${
                        isSelected
                          ? "bg-cyan text-deep border-white shadow-cyan/60 ring-4 ring-cyan/30"
                          : isHalted
                          ? "bg-panel-alt border-amber text-amber shadow-amber/30"
                          : "bg-deep border-cyan text-cyan shadow-cyan/30"
                      }`}
                    >
                      {/* Directional Bearing Arrow */}
                      <svg
                        className="w-4 h-4 transition-transform duration-500"
                        style={{ transform: `rotate(${bearing}deg)` }}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polygon points="12 2 19 21 12 17 5 21 12 2" fill="currentColor" opacity="0.3" />
                        <line x1="12" y1="2" x2="12" y2="17" />
                      </svg>
                    </div>

                    {/* Speed / Delay Tag floating above train */}
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none">
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-deep/95 border border-border shadow-xs text-[10px] font-mono">
                        <span className="font-bold text-primary">{item.trainId}</span>
                        {speed > 0 ? (
                          <span className="text-emerald-400 font-semibold">{speed}km/h</span>
                        ) : (
                          <span className="text-amber">Halt</span>
                        )}
                      </div>
                    </div>

                    {/* Ping wave animation for active moving train */}
                    {!isHalted && (
                      <span className="absolute -inset-1 rounded-full border border-cyan/40 animate-ping pointer-events-none opacity-40" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/80 text-[11px] font-mono text-dim">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan" /> Moving Train
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber" /> Halted / Signal Wait
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-700 border border-slate-500" /> Junction Station
              </span>
            </div>
            <span className="text-secondary">
              Click any train marker to inspect live telemetry &amp; send overrides
            </span>
          </div>
        </div>
      </div>

      {/* Train Details Inspector & Telemetry Data Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
        {/* Left: Telemetry Data Table */}
        <div className="rounded-xl border border-border bg-panel overflow-hidden shadow-md shadow-black/20">
          <div className="p-4 border-b border-border bg-panel-alt/70 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary">
                Tracked Fleet Telemetry
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan/15 text-cyan font-bold">
                {filteredTrains.length} Active
              </span>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search train # or name..."
                className="w-full bg-deep border border-border text-primary text-xs rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:border-cyan transition-all"
              />
              <svg className="w-3.5 h-3.5 text-dim absolute left-2 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-panel-alt text-[10px] uppercase font-mono tracking-wider text-dim border-b border-border">
                <tr>
                  <th className="px-4 py-3">Train</th>
                  <th className="px-4 py-3">Sector</th>
                  <th className="px-4 py-3">Speed</th>
                  <th className="px-4 py-3">Heading</th>
                  <th className="px-4 py-3">Delay</th>
                  <th className="px-4 py-3">Coordinates</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono">
                {filteredTrains.length > 0 ? (
                  filteredTrains.map((item) => {
                    const isSelected = selectedTrainId === item.trainId;
                    const speed = item.position.speed_kmh || 0;
                    const bearing = item.position.bearing || 0;
                    const delay = item.position.delay_minutes || 0;

                    return (
                      <tr
                        key={item.trainId}
                        onClick={() => setSelectedTrainId(item.trainId)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-cyan/15 hover:bg-cyan/20"
                            : "hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-primary">{item.trainId}</span>
                            <span className="text-[11px] text-secondary font-sans truncate max-w-[140px]">
                              {item.name}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-deep border border-border text-slate-200">
                            {item.stationId}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-semibold ${speed > 0 ? "text-emerald-400" : "text-amber"}`}>
                              {speed} km/h
                            </span>
                            {speed === 0 ? (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber/10 text-amber border border-amber/20 font-sans">
                                Halt
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-sans">
                                Transit
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-slate-300">
                            <svg
                              className="w-3 h-3 text-cyan"
                              style={{ transform: `rotate(${bearing}deg)` }}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polygon points="12 2 19 21 12 17 5 21 12 2" fill="currentColor" />
                            </svg>
                            <span>{bearing}&deg;</span>
                            <span className="text-[10px] text-dim">({getCardinalDirection(bearing)})</span>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {delay > 0 ? (
                            <span className="text-amber font-semibold">+{delay} min</span>
                          ) : (
                            <span className="text-emerald-400">On time</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-[11px] text-dim">
                          {item.position.lat !== undefined && item.position.lng !== undefined
                            ? `${item.position.lat}, ${item.position.lng}`
                            : "Station Halt"}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTrainId(item.trainId);
                              if (onSelectTrain) {
                                onSelectTrain(item.trainId, item.stationId);
                              }
                            }}
                            className="text-[11px] text-cyan hover:text-cyan-glow font-medium inline-flex items-center gap-1 cursor-pointer"
                          >
                            Select &rarr;
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-dim font-sans">
                      No trains currently active in sector {sectorFilter}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Selected Train Telemetry Inspector */}
        <div className="rounded-xl border border-border bg-panel p-5 space-y-4 shadow-md shadow-black/20">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="m4.93 4.93 4.24 4.24" />
                <path d="m14.83 9.17 4.24-4.24" />
                <path d="m14.83 14.83 4.24 4.24" />
                <path d="m9.17 14.83-4.24 4.24" />
                <circle cx="12" cy="12" r="4" />
              </svg>
              Train Telemetry Inspector
            </span>
          </div>

          {selectedTrainData ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-base font-bold font-mono text-primary">
                    {selectedTrainData.trainId}
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan/15 border border-cyan/30 text-cyan uppercase font-semibold">
                    Sector: {selectedTrainData.stationId}
                  </span>
                </div>
                <p className="text-xs text-secondary mt-0.5 font-sans">
                  {selectedTrainData.name}
                </p>
              </div>

              {/* Speedometer Gauge Block */}
              <div className="p-3.5 rounded-xl border border-border bg-deep/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-dim">Current Speed</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg font-bold text-emerald-400">
                      {selectedTrainData.position.speed_kmh || 0}{" "}
                      <span className="text-xs font-normal text-secondary">km/h</span>
                    </span>
                    {selectedTrainData.position.speed_kmh === 0 ? (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber/15 text-amber border border-amber/30 font-sans">
                        Halt
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-sans">
                        Transit
                      </span>
                    )}
                  </div>
                </div>
                {/* Visual meter bar */}
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan to-emerald-400 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (((selectedTrainData.position.speed_kmh || 0) > 0 ? (selectedTrainData.position.speed_kmh || 0) : (selectedTrainData.position.avg_speed_kmh || 0)) / 120) * 100)}%`,
                    }}
                  />
                </div>
                {selectedTrainData.position.avg_speed_kmh && (
                  <div className="flex items-center justify-between text-[11px] font-mono text-dim pt-1 border-t border-border/40">
                    <span>Route Avg Speed</span>
                    <span className="text-secondary font-semibold">{selectedTrainData.position.avg_speed_kmh} km/h</span>
                  </div>
                )}
              </div>

              {/* Heading & GPS Coordinates */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-3 rounded-lg border border-border bg-deep/50 space-y-1">
                  <span className="text-[10px] text-dim block uppercase">Heading</span>
                  <div className="flex items-center gap-1.5 text-primary font-bold">
                    <svg
                      className="w-3.5 h-3.5 text-cyan transition-transform duration-500"
                      style={{ transform: `rotate(${selectedTrainData.position.bearing || 0}deg)` }}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polygon points="12 2 19 21 12 17 5 21 12 2" fill="currentColor" />
                    </svg>
                    <span>{selectedTrainData.position.bearing || 0}&deg;</span>
                    <span className="text-[10px] text-cyan">
                      {getCardinalDirection(selectedTrainData.position.bearing || 0)}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-deep/50 space-y-1">
                  <span className="text-[10px] text-dim block uppercase">Schedule Status</span>
                  <div className="text-primary font-bold">
                    {(selectedTrainData.position.delay_minutes || 0) > 0 ? (
                      <span className="text-amber">+{selectedTrainData.position.delay_minutes}m Late</span>
                    ) : (
                      <span className="text-emerald-400">On Time</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Precise Geo Coordinates */}
              <div className="p-3 rounded-lg border border-border bg-deep/40 text-xs font-mono space-y-1">
                <span className="text-[10px] text-dim uppercase block">Live Coordinates</span>
                <div className="text-slate-200">
                  Lat: <span className="text-cyan font-bold">{selectedTrainData.position.lat ?? "N/A"}</span>
                  {"  "}&middot;{"  "}
                  Lng: <span className="text-cyan font-bold">{selectedTrainData.position.lng ?? "N/A"}</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2 pt-2">
                {onSelectTrain && (
                  <button
                    type="button"
                    onClick={() => onSelectTrain(selectedTrainData.trainId, selectedTrainData.stationId)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan text-deep font-semibold text-xs hover:bg-cyan-glow transition-all cursor-pointer shadow-md shadow-cyan/20"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    Pre-fill in Override Panel
                  </button>
                )}

                {onOpenAIWithQuery && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenAIWithQuery(
                        `What is the live status and conflict risk for train ${selectedTrainData.trainId} currently at ${selectedTrainData.stationId}?`
                      )
                    }
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-deep border border-border text-secondary hover:text-cyan hover:border-cyan/40 text-xs font-medium transition-all cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 text-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2v4" />
                      <path d="M2 12h4" />
                      <path d="M12 22v-4" />
                      <path d="M22 12h-4" />
                    </svg>
                    Ask AI Copilot about this train
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-dim space-y-2">
              <svg className="w-8 h-8 mx-auto text-dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-xs">Select a train on the radar track or telemetry table to inspect.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
