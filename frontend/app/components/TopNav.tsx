
"use client";

import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { DataSourceInfo } from "../types";

export type ConsoleViewMode = "schedule" | "radar" | "analytics" | "simulation";

interface Props {
  algorithm: "greedy" | "ilp";
  setAlgorithm: Dispatch<SetStateAction<"greedy" | "ilp">>;
  onToggleAI?: () => void;
  isAIOpen?: boolean;
  viewMode?: ConsoleViewMode;
  setViewMode?: (mode: ConsoleViewMode) => void;
  dataSource?: DataSourceInfo | null;
  onRefreshTrains?: () => void;
  isRefreshingTrains?: boolean;
  onOpenAuditLog?: () => void;
}

export default function TopNav({
  algorithm,
  setAlgorithm,
  onToggleAI,
  isAIOpen,
  viewMode = "schedule",
  setViewMode,
  dataSource,
  onRefreshTrains,
  isRefreshingTrains = false,
  onOpenAuditLog,
}: Props) {
  const { isLoaded, isSignedIn } = useUser();
  const [time, setTime] = useState<string>("--:--:--");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour12: false }));
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-3.5 border-b border-border bg-panel-alt/90 backdrop-blur-md shadow-md shadow-black/20">
      {/* Brand, System Status and Algorithm Selector */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-cyan/10 border border-cyan/30 text-cyan shadow-sm shadow-cyan/20">
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="4" y="3" width="16" height="16" rx="2" />
            <path d="M4 11h16" />
            <path d="M12 3v8" />
            <path d="m8 19-2 3" />
            <path d="m16 19 2 3" />
            <circle cx="8" cy="15" r="1" fill="currentColor" />
            <circle cx="16" cy="15" r="1" fill="currentColor" />
          </svg>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-primary leading-tight">
              TrainVision <span className="text-cyan font-bold">AI</span>
            </h1>

            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-wide uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>

          <p className="text-[11px] text-secondary font-medium tracking-wide hidden sm:block">
            Railway Operations Control Center &middot; HWH &middot; SRC &middot; KGP
          </p>
        </div>

        {/* Algorithm Toggle */}
        <div
          role="group"
          aria-label="Optimization Algorithm Selector"
          className="ml-2 sm:ml-4 flex items-center p-0.5 rounded-lg bg-deep/90 border border-border text-xs font-sans shadow-inner"
        >
          <button
            type="button"
            aria-pressed={algorithm === "greedy"}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer ${algorithm === "greedy"
                ? "bg-cyan text-deep font-semibold shadow-sm shadow-cyan/30"
                : "text-secondary hover:text-primary hover:bg-panel"
              }`}
            onClick={() => setAlgorithm("greedy")}
          >
            Greedy <span className="hidden md:inline text-[10px] opacity-80">(Fast)</span>
          </button>

          <button
            type="button"
            aria-pressed={algorithm === "ilp"}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer ${algorithm === "ilp"
                ? "bg-cyan text-deep font-semibold shadow-sm shadow-cyan/30"
                : "text-secondary hover:text-primary hover:bg-panel"
              }`}
            onClick={() => setAlgorithm("ilp")}
          >
            ILP <span className="hidden md:inline text-[10px] opacity-80">(Optimal)</span>
          </button>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Console View Mode Switcher */}
        {setViewMode && (
          <div
            role="group"
            aria-label="Console View Mode"
            className="flex items-center p-0.5 rounded-lg bg-deep/90 border border-border text-xs shadow-inner"
          >
            <button
              type="button"
              onClick={() => setViewMode("schedule")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${viewMode === "schedule"
                  ? "bg-cyan text-deep font-semibold shadow-xs"
                  : "text-secondary hover:text-primary hover:bg-panel"
                }`}
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="10" y1="4" x2="10" y2="20" />
              </svg>
              <span className="hidden sm:inline">Schedule</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("radar")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${viewMode === "radar"
                  ? "bg-cyan text-deep font-semibold shadow-xs"
                  : "text-secondary hover:text-primary hover:bg-panel"
                }`}
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="2" fill="currentColor" />
                <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49" />
              </svg>
              <span className="hidden md:inline">Radar</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            </button>

            <button
              type="button"
              onClick={() => setViewMode("analytics")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${viewMode === "analytics"
                  ? "bg-cyan text-deep font-semibold shadow-xs"
                  : "text-secondary hover:text-primary hover:bg-panel"
                }`}
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <span className="hidden md:inline">Analytics</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("simulation")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${viewMode === "simulation"
                  ? "bg-cyan text-deep font-semibold shadow-xs"
                  : "text-secondary hover:text-primary hover:bg-panel"
                }`}
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span className="hidden md:inline">Simulator</span>
            </button>
          </div>
        )}

        {/* Data Source Indicator & Manual Refresh */}
        {dataSource && (
          <div
            title={dataSource.last_error || `Source: ${dataSource.source}`}
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-deep/80 border border-border text-[11px] font-mono"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                dataSource.source === "railradar" ? "bg-emerald-400" : "bg-amber"
              }`}
            />
            <span className="text-secondary">
              {dataSource.source === "railradar" ? "RailRadar Live" : "Static Fallback"}
            </span>
            {onRefreshTrains && (
              <button
                type="button"
                onClick={onRefreshTrains}
                disabled={isRefreshingTrains}
                title="Force refresh RailRadar live board (uses API quota)"
                className="ml-1 text-cyan hover:text-cyan-glow disabled:opacity-50 cursor-pointer"
              >
                {isRefreshingTrains ? "..." : "↻"}
              </button>
            )}
          </div>
        )}

        {/* Audit Log Drawer Button */}
        {onOpenAuditLog && (
          <button
            type="button"
            onClick={onOpenAuditLog}
            title="View persistent audit log"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-panel border border-border text-secondary hover:text-primary hover:border-slate-700 text-xs font-medium cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="hidden lg:inline">Audit Log</span>
          </button>
        )}

        {/* AI Copilot */}
        {onToggleAI && (
          <button
            type="button"
            onClick={onToggleAI}
            aria-label="Toggle TrainVision AI Copilot"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer border ${isAIOpen
                ? "bg-cyan text-deep font-semibold border-cyan shadow-md shadow-cyan/30"
                : "bg-panel border-border text-secondary hover:text-cyan hover:border-cyan/40 hover:bg-deep shadow-sm"
              }`}
          >
            <svg
              className={`w-3.5 h-3.5 ${isAIOpen ? "text-deep" : "text-cyan"}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2v4" />
              <path d="m4.93 4.93 2.83 2.83" />
              <path d="M2 12h4" />
              <path d="m4.93 19.07 2.83-2.83" />
              <path d="M12 22v-4" />
              <path d="m19.07 19.07-2.83-2.83" />
              <path d="M22 12h-4" />
              <path d="m19.07 4.93-2.83 2.83" />
            </svg>

            <span className="font-semibold tracking-tight">AI Copilot</span>

            <span
              className={`w-1.5 h-1.5 rounded-full ${isAIOpen ? "bg-deep animate-ping" : "bg-cyan animate-pulse"
                }`}
            />
          </button>
        )}

        {/* Real-time Clock */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-deep/80 border border-border shadow-inner">
          <svg
            className="w-3.5 h-3.5 text-cyan"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>

          <span className="font-mono text-xs sm:text-sm font-semibold tracking-wider text-cyan">
            {time}
          </span>

          <span className="text-[10px] font-mono text-dim tracking-tight hidden sm:inline">
            IST
          </span>
        </div>

        {/* Clerk User Profile and Sign Out */}
        {isLoaded && isSignedIn && (
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "w-9 h-9",
              },
            }}
          />
        )}
      </div>
    </header>
  );
}
