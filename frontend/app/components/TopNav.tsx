import { Dispatch, SetStateAction, useEffect, useState } from "react";

interface Props {
  algorithm: "greedy" | "ilp";
  setAlgorithm: Dispatch<SetStateAction<"greedy" | "ilp">>;
}

export default function TopNav({ algorithm, setAlgorithm }: Props) {
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
      {/* Brand & System Status */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-cyan/10 border border-cyan/30 text-cyan shadow-sm shadow-cyan/20">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

        {/* Algorithm Toggle Switch */}
        <div 
          role="group" 
          aria-label="Optimization Algorithm Selector"
          className="ml-2 sm:ml-4 flex items-center p-0.5 rounded-lg bg-deep/90 border border-border text-xs font-sans shadow-inner"
        >
          <button
            type="button"
            aria-pressed={algorithm === "greedy"}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer ${
              algorithm === "greedy"
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
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer ${
              algorithm === "ilp"
                ? "bg-cyan text-deep font-semibold shadow-sm shadow-cyan/30"
                : "text-secondary hover:text-primary hover:bg-panel"
            }`}
            onClick={() => setAlgorithm("ilp")}
          >
            ILP <span className="hidden md:inline text-[10px] opacity-80">(Optimal)</span>
          </button>
        </div>
      </div>

      {/* Real-time Clock & System Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-deep/80 border border-border shadow-inner">
          <svg className="w-3.5 h-3.5 text-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="font-mono text-xs sm:text-sm font-semibold tracking-wider text-cyan">
            {time}
          </span>
          <span className="text-[10px] font-mono text-dim tracking-tight hidden sm:inline">IST</span>
        </div>
      </div>
    </header>
  );
}