import { FormEvent } from "react";
import { Conflict, ScheduleEntry, Station } from "../types";

interface Props {
  conflicts: Conflict[];
  schedule: ScheduleEntry[];
  stations: Station[];
  overrideVisit: string;
  setOverrideVisit: (val: string) => void;
  overridePlatform: string;
  setOverridePlatform: (val: string) => void;
  onSubmit: (e: FormEvent) => void;
  onReset: () => void;
}

export default function ControlPanel({
  conflicts, schedule, stations, overrideVisit, setOverrideVisit, 
  overridePlatform, setOverridePlatform, onSubmit, onReset
}: Props) {
  
  const selectedStationId = overrideVisit ? overrideVisit.split("|")[1] : "";
  const stationObj = stations.find((s) => s.id === selectedStationId);
  const platformCount = stationObj ? stationObj.platforms : 1;
  const platformOptions = Array.from({ length: platformCount }, (_, i) => i + 1);

  const renderSeverityBadge = (severity: Conflict["severity"]) => {
    switch (severity) {
      case "critical":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-red/10 text-red border border-red/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red animate-ping" />
            Critical
          </span>
        );
      case "high":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-amber/10 text-amber border border-amber/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber" />
            High
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-cyan/10 text-cyan border border-cyan/30">
            Medium
          </span>
        );
    }
  };

  return (
    <aside aria-label="Control and Conflict Center" className="flex flex-col gap-6">
      {/* Conflicts Section */}
      <div className="rounded-xl border border-border bg-panel/70 backdrop-blur-sm shadow-md shadow-black/20 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber/10 border border-amber/20 flex items-center justify-center text-amber">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold tracking-wide text-primary">
              Conflicts & Resolutions
            </h2>
          </div>
          <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${
            conflicts.length > 0 
              ? "bg-amber/10 border-amber/30 text-amber font-semibold" 
              : "bg-deep border-border text-dim"
          }`}>
            {conflicts.length}
          </span>
        </div>

        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
          {conflicts.length > 0 ? (
            conflicts.map((c, idx) => (
              <div 
                key={idx} 
                className={`p-3.5 rounded-lg border transition-all duration-150 ${
                  c.severity === "critical"
                    ? "bg-red/5 border-red/30 hover:border-red/50"
                    : c.severity === "high"
                    ? "bg-amber/5 border-amber/30 hover:border-amber/50"
                    : "bg-deep/60 border-border hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  {renderSeverityBadge(c.severity)}
                  <span className="text-[11px] font-mono text-dim">
                    {c.station_id} &middot; PF {c.platform}
                  </span>
                </div>

                <div className="text-xs font-mono font-semibold text-primary mb-1">
                  {c.trains_involved.join("  vs  ")}
                </div>

                <div className="text-xs text-secondary mb-2 leading-relaxed">
                  {c.root_cause}
                </div>

                <div className="flex items-start gap-2 p-2 rounded bg-cyan/10 border border-cyan/20 text-xs text-cyan font-mono">
                  <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  <span className="break-words">Fix: {c.resolution}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center rounded-lg border border-dashed border-border/80 bg-deep/40">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-xs font-medium text-primary">No conflicts detected</p>
              <p className="text-[11px] text-dim mt-0.5">All station platforms are optimal for this sector view.</p>
            </div>
          )}
        </div>
      </div>

      {/* Manual Override Form Section */}
      <div className="rounded-xl border border-border bg-panel/70 backdrop-blur-sm shadow-md shadow-black/20 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-cyan/10 border border-cyan/20 flex items-center justify-center text-cyan">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-primary">
              Controller Override
            </h2>
            <p className="text-[11px] text-dim">Manually assign platform & re-optimize</p>
          </div>
        </div>

        <form className="flex flex-col gap-3.5" onSubmit={onSubmit}>
          <div>
            <label htmlFor="train-visit-select" className="text-xs font-medium text-secondary block mb-1.5">
              Train Visit
            </label>
            <div className="relative">
              <select 
                id="train-visit-select"
                required 
                value={overrideVisit} 
                onChange={(e) => setOverrideVisit(e.target.value)} 
                className="w-full appearance-none bg-deep border border-border hover:border-slate-700 text-primary rounded-lg px-3 py-2 pr-8 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-cyan/40 focus:border-cyan transition-all cursor-pointer"
              >
                {schedule.map((e, idx) => (
                  <option key={idx} value={`${e.train_id}|${e.station_id}`}>
                    {e.train_id} — {e.name} @ {e.station_id}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-secondary">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="platform-select" className="text-xs font-medium text-secondary block mb-1.5">
              Assign Platform
            </label>
            <div className="relative">
              <select 
                id="platform-select"
                required 
                value={overridePlatform} 
                onChange={(e) => setOverridePlatform(e.target.value)} 
                className="w-full appearance-none bg-deep border border-border hover:border-slate-700 text-primary rounded-lg px-3 py-2 pr-8 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-cyan/40 focus:border-cyan transition-all cursor-pointer"
              >
                {platformOptions.map((p) => (
                  <option key={p} value={p}>
                    Platform {p}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-secondary">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full mt-1.5 py-2.5 px-4 rounded-lg bg-cyan hover:bg-cyan-glow text-deep font-semibold text-xs tracking-wider uppercase transition-all duration-150 shadow-md shadow-cyan/20 hover:shadow-cyan/30 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            Apply & Re-optimize
          </button>
        </form>

        <button 
          type="button"
          onClick={onReset}
          className="w-full mt-3 py-2 px-3 rounded-lg border border-border hover:border-red/40 bg-deep/50 hover:bg-red/10 text-secondary hover:text-red text-xs font-medium transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
          Reset All Overrides
        </button>
      </div>
    </aside>
  );
}