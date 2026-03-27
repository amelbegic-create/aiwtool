"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle2, Circle, Loader2, Users } from "lucide-react";
import { formatDateDDMMGGGG } from "@/lib/dateUtils";

export type DashboardItemStatsResult = {
  read: Array<{ id: string; name: string | null; email: string | null; readAt: string | null }>;
  unread: Array<{ id: string; name: string | null; email: string | null }>;
};

export default function DashboardStatsModal({
  open,
  title,
  subtitle,
  load,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  load: () => Promise<DashboardItemStatsResult>;
  onClose: () => void;
}) {
  const [data, setData] = useState<DashboardItemStatsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    load()
      .then(setData)
      .catch((e) => setError(e?.message || "Fehler beim Laden."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const total = data ? data.read.length + data.unread.length : 0;
  const readCount = data ? data.read.length : 0;
  const progressPct = total > 0 ? Math.round((readCount / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-modal-title"
      >
        <div className="flex items-center justify-between gap-4 p-5 border-b border-slate-200 bg-[#1a3826]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Users size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 id="stats-modal-title" className="text-lg font-black text-white">
                Lese-Statistik
              </h2>
              <p className="text-sm text-white/80 truncate">{title}</p>
              <p className="text-xs text-white/60 truncate">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:bg-white/20 hover:text-white transition"
            aria-label="Schließen"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-[#1a3826]" />
              <p className="mt-3 text-sm font-medium text-slate-500">Laden…</p>
            </div>
          )}

          {error && (
            <div className="py-8 text-center">
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          )}

          {!loading && !error && data && (
            <>
              <div className="mb-6">
                <div className="flex justify-between text-sm font-bold text-slate-700 mb-2">
                  <span>Gelesen</span>
                  <span>
                    {readCount} / {total} ({progressPct}%)
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1a3826] transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-emerald-700 mb-3">
                    <CheckCircle2 size={16} />
                    Gelesen ({data.read.length})
                  </h3>
                  <ul className="space-y-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                    {data.read.length === 0 ? (
                      <li className="text-sm text-slate-500 italic">Noch niemand hat geöffnet.</li>
                    ) : (
                      data.read.map((u) => (
                        <li
                          key={u.id}
                          className="flex items-center justify-between gap-2 text-sm bg-white rounded-lg px-3 py-2 border border-slate-100"
                        >
                          <span className="font-medium text-slate-800 truncate">
                            {u.name || u.email || u.id}
                          </span>
                          {u.readAt ? (
                            <span className="text-xs text-slate-500 shrink-0">
                              {formatDateDDMMGGGG(u.readAt)}
                            </span>
                          ) : null}
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-600 mb-3">
                    <Circle size={16} />
                    Nicht gelesen ({data.unread.length})
                  </h3>
                  <ul className="space-y-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                    {data.unread.length === 0 ? (
                      <li className="text-sm text-emerald-600 font-medium">Alle haben gelesen.</li>
                    ) : (
                      data.unread.map((u) => (
                        <li
                          key={u.id}
                          className="flex items-center justify-between gap-2 text-sm bg-white rounded-lg px-3 py-2 border border-slate-100"
                        >
                          <span className="font-medium text-slate-800 truncate">
                            {u.name || u.email || u.id}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

