"use client";

import Link from "next/link";
import { Umbrella, ExternalLink, TrendingUp, Clock, Check } from "lucide-react";

type Props = {
  vacation: {
    carryover: number;
    allowance: number;
    total: number;
    used: number;
    remaining: number;
  } | null;
  currentYear: number;
};

export default function VacationTab({ vacation, currentYear }: Props) {
  const usedPct = vacation
    ? Math.min(100, Math.round((vacation.used / Math.max(1, vacation.total)) * 100))
    : 0;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-xl font-black text-foreground">Urlaub {currentYear}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Anspruch, Verbrauch und verbleibende Tage</p>
      </div>

      {vacation ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={<TrendingUp size={16} />}
              label="Anspruch"
              value={vacation.allowance}
              sub={vacation.carryover > 0 ? `+${vacation.carryover} Übertrag` : `Jahr ${currentYear}`}
            />
            <StatCard
              icon={<Check size={16} />}
              label="Verbraucht"
              value={vacation.used}
              color="text-amber-600 dark:text-amber-400"
            />
            <StatCard
              icon={<Umbrella size={16} />}
              label="Verbleibend"
              value={vacation.remaining}
              color="text-emerald-600 dark:text-emerald-400"
              highlight
            />
          </div>

          {/* Progress bar */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-muted-foreground">Jahresverbrauch</span>
              <span className="text-foreground">{usedPct}%</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#1a3826] to-[#2d6644] transition-all"
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground/70">
              <span>0</span>
              <span>{vacation.total} Tage gesamt</span>
            </div>
          </div>

          {vacation.carryover > 0 && (
            <div className="rounded-xl border border-amber-300/40 bg-amber-50/50 dark:bg-amber-900/10 px-4 py-3 flex items-center gap-2.5">
              <Clock size={14} className="text-amber-600 shrink-0" />
              <span className="text-xs text-amber-800 dark:text-amber-300">
                <strong>{vacation.carryover} Tage</strong> aus dem Vorjahr werden angerechnet.
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Umbrella size={28} className="mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Keine Urlaubsdaten verfügbar.</p>
        </div>
      )}

      <Link
        href="/tools/vacations"
        className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 hover:bg-muted/50 transition shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#1a3826]/10 text-[#1a3826] dark:bg-[#FFC72C]/10 dark:text-[#FFC72C]">
            <Umbrella size={16} />
          </div>
          <div>
            <p className="text-sm font-black text-foreground">Urlaubsmodul</p>
            <p className="text-xs text-muted-foreground">Anträge stellen und verwalten</p>
          </div>
        </div>
        <ExternalLink size={14} className="text-muted-foreground" />
      </Link>
    </div>
  );
}

function StatCard({
  icon, label, value, sub, color = "text-[#1a3826] dark:text-[#FFC72C]", highlight,
}: { icon: React.ReactNode; label: string; value: number; sub?: string; color?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 text-center space-y-1.5 ${highlight ? "border-emerald-300/50 bg-emerald-50/50 dark:bg-emerald-900/10 dark:border-emerald-700/30" : "border-border bg-card"}`}>
      <div className={`flex justify-center ${color}`}>{icon}</div>
      <div className={`text-2xl font-black ${color}`}>{value}</div>
      <div className="text-[9px] font-black text-muted-foreground uppercase tracking-wide">{label}</div>
      {sub && <div className="text-[9px] text-muted-foreground/60">{sub}</div>}
    </div>
  );
}
