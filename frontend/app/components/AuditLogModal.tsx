"use client";

import { useEffect, useState } from "react";
import { AuditLogItem } from "../types";
import { fetchBackend } from "../utils/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuditLogModal({ isOpen, onClose }: Props) {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchBackend("/log");
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.detail || `Server returned ${res.status}`);
      }
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function fetchInitial() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchBackend("/log");
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setLogs(Array.isArray(data) ? data : []);
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

    fetchInitial();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label="Controller Audit Log"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-panel border-l border-border shadow-2xl shadow-black/70 flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-panel-alt/80">
          <div>
            <h2 className="text-sm font-semibold text-primary">Persistent Audit Log</h2>
            <p className="text-[11px] text-dim font-mono">
              PostgreSQL controller actions (OVERRIDE / UNOVERRIDE / RESET)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadLogs}
              disabled={loading}
              className="px-2.5 py-1 rounded-md bg-deep border border-border hover:border-cyan/40 text-xs font-mono text-secondary hover:text-cyan cursor-pointer disabled:opacity-50"
            >
              {loading ? "..." : "Refresh"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close audit log"
              className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-slate-800 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
          {error && (
            <div className="p-3 rounded-lg border border-red/30 bg-red/10 text-xs text-red font-mono">
              {error}
            </div>
          )}

          {loading && logs.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-dim">
              Loading audit trail...
            </div>
          ) : logs.length > 0 ? (
            logs.map((item) => {
              const badgeStyle =
                item.action === "RESET"
                  ? "bg-red/15 border-red/30 text-red"
                  : item.action === "UNOVERRIDE"
                  ? "bg-amber/15 border-amber/30 text-amber"
                  : "bg-cyan/15 border-cyan/30 text-cyan";

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-border bg-deep/60 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${badgeStyle}`}
                    >
                      {item.action}
                    </span>
                    <span className="text-[11px] font-mono text-dim">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-primary">
                    {item.details ||
                      `${item.action} ${item.train_id ?? ""} ${item.station_id ?? ""}`}
                  </div>
                  {(item.train_id || item.station_id) && (
                    <div className="text-[11px] font-mono text-secondary">
                      {item.train_id && `Train ${item.train_id}`}
                      {item.station_id && ` @ ${item.station_id}`}
                      {item.platform ? ` • PF ${item.platform}` : ""}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center rounded-xl border border-dashed border-border bg-deep/30 text-xs text-dim">
              No override or reset actions recorded yet.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
