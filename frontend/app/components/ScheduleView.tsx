import { ScheduleEntry } from "../types";

interface Props {
  schedule: ScheduleEntry[];
}

export default function ScheduleView({ schedule }: Props) {
  const totalTrains = schedule.length;
  const delayedTrains = schedule.filter((e) => e.delay_minutes > 0).length;
  const onTimePct = totalTrains ? Math.round(((totalTrains - delayedTrains) / totalTrains) * 100) : 100;

  const renderStatusBadge = (entry: ScheduleEntry) => {
    if (entry.is_override) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-cyan/30 bg-cyan/10 text-cyan text-xs font-mono font-medium">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          Override
        </span>
      );
    }
    if (entry.reason && entry.reason.toLowerCase().includes("review")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-red/30 bg-red/10 text-red text-xs font-mono font-medium">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Review
        </span>
      );
    }
    if (entry.delay_minutes > 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-amber/30 bg-amber/10 text-amber text-xs font-mono font-medium">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 14 14" />
          </svg>
          +{entry.delay_minutes} min
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono font-medium">
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        On time
      </span>
    );
  };

  return (
    <section aria-labelledby="schedule-heading" className="flex flex-col gap-6">
      {/* Telemetry KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Trains */}
        <div className="p-4 rounded-xl border border-border bg-panel/70 backdrop-blur-sm shadow-md shadow-black/20 hover:border-slate-700/80 transition-all duration-200">
          <div className="flex items-center justify-between text-secondary mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-dim">Active Trains</span>
            <div className="w-7 h-7 rounded-lg bg-cyan/10 border border-cyan/20 flex items-center justify-center text-cyan">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="3" width="16" height="16" rx="2" />
                <path d="M4 11h16" />
                <path d="M12 3v8" />
                <path d="m8 19-2 3" />
                <path d="m16 19 2 3" />
              </svg>
            </div>
          </div>
          <div className="font-mono text-3xl font-bold tracking-tight text-primary">{totalTrains}</div>
          <p className="text-[11px] text-dim mt-1">Scheduled in current sector view</p>
        </div>

        {/* Card 2: Delays / Reassigned */}
        <div className="p-4 rounded-xl border border-border bg-panel/70 backdrop-blur-sm shadow-md shadow-black/20 hover:border-slate-700/80 transition-all duration-200">
          <div className="flex items-center justify-between text-secondary mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-dim">Delayed / Conflict</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${delayedTrains > 0 ? "bg-amber/10 border border-amber/30 text-amber" : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"}`}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          </div>
          <div className={`font-mono text-3xl font-bold tracking-tight ${delayedTrains > 0 ? "text-amber" : "text-primary"}`}>
            {delayedTrains}
          </div>
          <p className="text-[11px] text-dim mt-1">
            {delayedTrains > 0 ? "Platform reassignments active" : "Zero delays recorded"}
          </p>
        </div>

        {/* Card 3: On-Time Rate */}
        <div className="p-4 rounded-xl border border-border bg-panel/70 backdrop-blur-sm shadow-md shadow-black/20 hover:border-slate-700/80 transition-all duration-200">
          <div className="flex items-center justify-between text-secondary mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-dim">On-Time Performance</span>
            <div className="w-7 h-7 rounded-lg bg-cyan/10 border border-cyan/20 flex items-center justify-center text-cyan">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold tracking-tight text-cyan">{onTimePct}%</span>
            <span className="text-[11px] text-dim font-medium">efficiency</span>
          </div>
          <div className="w-full bg-deep rounded-full h-1.5 mt-2.5 overflow-hidden border border-border">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                onTimePct >= 90 ? "bg-emerald-400" : onTimePct >= 70 ? "bg-cyan" : "bg-amber"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, onTimePct))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Live Schedule Data Table */}
      <div className="rounded-xl border border-border bg-panel/60 backdrop-blur-sm shadow-md shadow-black/20 overflow-hidden flex flex-col">
        {/* Table Header / Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border bg-panel-alt/50">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
            <h2 id="schedule-heading" className="text-sm font-semibold tracking-wide text-primary">
              Live Platform Allocation Schedule
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-dim font-mono">
            <span>Auto-refresh: 15s</span>
            <span className="text-border-bright">&bull;</span>
            <span>{schedule.length} trains tracked</span>
          </div>
        </div>

        {/* Responsive Table Wrapper */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm" role="table">
            <thead>
              <tr className="border-b border-border bg-panel-alt/40 text-[11px] font-semibold uppercase tracking-wider text-dim">
                <th scope="col" className="px-4 py-3">Train</th>
                <th scope="col" className="px-4 py-3">Station</th>
                <th scope="col" className="px-4 py-3">Platform</th>
                <th scope="col" className="px-4 py-3">Arrival</th>
                <th scope="col" className="px-4 py-3">Departure</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Reason / Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {schedule.length > 0 ? (
                schedule.map((e, idx) => (
                  <tr 
                    key={`${e.train_id}-${e.station_id}-${idx}`}
                    className="hover:bg-slate-800/40 transition-colors duration-150 group"
                  >
                    {/* Train Info */}
                    <td className="px-4 py-3.5">
                      <div className="font-mono text-sm font-semibold text-primary group-hover:text-cyan transition-colors">
                        {e.train_id}
                      </div>
                      <div className="text-xs text-secondary truncate max-w-[200px]">
                        {e.name}
                      </div>
                    </td>

                    {/* Station */}
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs font-semibold px-2 py-1 rounded bg-deep border border-border text-slate-300">
                        {e.station_id}
                      </span>
                    </td>

                    {/* Platform */}
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-cyan/10 border border-cyan/30 text-cyan">
                        PF {e.assigned_platform}
                      </span>
                    </td>

                    {/* Arrival */}
                    <td className="px-4 py-3.5 font-mono text-xs text-primary">
                      {e.actual_arrival || "--:--"}
                    </td>

                    {/* Departure */}
                    <td className="px-4 py-3.5 font-mono text-xs text-primary">
                      {e.actual_departure || "--:--"}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {renderStatusBadge(e)}
                    </td>

                    {/* Reason */}
                    <td className="px-4 py-3.5 text-xs text-secondary max-w-[240px]">
                      <span className="line-clamp-2">
                        {e.reason || "Scheduled per timetable"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-dim">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <svg className="w-8 h-8 text-dim opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="4" y="3" width="16" height="16" rx="2" />
                        <path d="M4 11h16" />
                        <path d="M12 3v8" />
                      </svg>
                      <p className="text-sm font-medium">No trains scheduled for this view.</p>
                      <p className="text-xs text-dim">Select another station or wait for the next telemetry poll.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}