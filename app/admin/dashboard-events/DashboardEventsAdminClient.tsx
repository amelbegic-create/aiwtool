"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, Images, BarChart3 } from "lucide-react";
import {
  deleteDashboardEventItem,
  setDashboardEventActive,
  getDashboardEventStats,
  getDashboardEventStatsSummary,
} from "@/app/actions/dashboardEventActions";
import DashboardStatsModal from "@/app/admin/_components/DashboardStatsModal";

export type DashboardEventAdminRow = {
  id: string;
  title: string;
  subtitle: string | null;
  sortOrder: number;
  isActive: boolean;
  coverImageUrl: string;
  imageCount: number;
};

export default function DashboardEventsAdminClient({ items }: { items: DashboardEventAdminRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsItem, setStatsItem] = useState<{ id: string; title: string } | null>(null);
  const [statsSummary, setStatsSummary] = useState<Record<string, { readCount: number; totalCount: number }>>({});

  function toggle(id: string, current: boolean) {
    startTransition(async () => {
      await setDashboardEventActive(id, !current);
      router.refresh();
    });
  }

  function del(id: string) {
    if (!confirm("Dieses Event wirklich löschen?")) return;
    startTransition(async () => {
      const r = await deleteDashboardEventItem(id);
      if (!r.ok) alert(r.error ?? "Löschen fehlgeschlagen.");
      router.refresh();
    });
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      items.map(async (r) => {
        const summary = await getDashboardEventStatsSummary(r.id);
        return { id: r.id, ...summary };
      })
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, { readCount: number; totalCount: number }> = {};
      results.forEach(({ id, readCount, totalCount }) => {
        map[id] = { readCount, totalCount };
      });
      setStatsSummary(map);
    });
    return () => {
      cancelled = true;
    };
  }, [items]);

  const openStats = (id: string, title: string) => {
    setStatsItem({ id, title });
    setStatsOpen(true);
  };

  if (items.length === 0) {
    return <p className="rounded-xl border border-border bg-card p-6 text-sm font-medium text-muted-foreground">Noch keine Events. Legen Sie ein neues an.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs font-black uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Cover</th>
            <th className="px-4 py-3">Titel</th>
            <th className="px-4 py-3">Bilder</th>
            <th className="px-4 py-3">Reihenfolge</th>
            <th className="px-4 py-3">Aktiv</th>
            <th className="px-4 py-3">Lesestatus</th>
            <th className="px-4 py-3 text-right">Aktionen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((row) => (
            <tr key={row.id} className="align-middle">
              <td className="px-4 py-2">
                <div className="relative h-14 w-24 overflow-hidden rounded-md border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.coverImageUrl} alt="" className="h-full w-full object-cover" />
                </div>
              </td>
              <td className="px-4 py-2 font-semibold text-foreground">
                <div>{row.title}</div>
                {row.subtitle ? <div className="mt-0.5 text-xs font-normal text-muted-foreground">{row.subtitle}</div> : null}
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Images size={14} /> {row.imageCount}</span>
              </td>
              <td className="px-4 py-2 tabular-nums text-muted-foreground">{row.sortOrder}</td>
              <td className="px-4 py-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggle(row.id, row.isActive)}
                  className={`rounded-lg border px-3 py-1 text-xs font-bold uppercase tracking-wide transition-colors ${row.isActive ? "border-[#1a3826] bg-[#1a3826] text-[#FFC72C]" : "border-border bg-muted text-muted-foreground"}`}
                >
                  {row.isActive ? "Ja" : "Nein"}
                </button>
              </td>
              <td className="px-4 py-2">
                {(() => {
                  const s = statsSummary[row.id];
                  const total = s?.totalCount ?? 0;
                  const read = s?.readCount ?? 0;
                  const pct = total > 0 ? Math.round((read / total) * 100) : 0;
                  return (
                    <div className="min-w-[220px]">
                      <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground mb-1">
                        <span>{read}/{total}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-[#1a3826]" style={{ width: `${pct}%` }} />
                      </div>
                      <button
                        type="button"
                        onClick={() => openStats(row.id, row.title)}
                        className="mt-2 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-black text-[#1a3826] hover:bg-muted/70"
                      >
                        <BarChart3 size={14} /> Details
                      </button>
                    </div>
                  );
                })()}
              </td>
              <td className="px-4 py-2 text-right">
                <div className="flex justify-end gap-2">
                  <Link href={`/admin/dashboard-events/${row.id}/edit`} className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-[#1a3826] hover:bg-muted dark:text-[#FFC72C]" title="Bearbeiten">
                    <Pencil size={18} aria-hidden />
                  </Link>
                  <button type="button" disabled={pending} onClick={() => del(row.id)} className="inline-flex items-center justify-center rounded-lg border border-destructive/40 p-2 text-destructive hover:bg-destructive/10" title="Löschen">
                    <Trash2 size={18} aria-hidden />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <DashboardStatsModal
      open={statsOpen}
      title={statsItem?.title ?? ""}
      subtitle="Dashboard-Events"
      load={async () => {
        if (!statsItem?.id) return { read: [], unread: [] };
        return getDashboardEventStats(statsItem.id);
      }}
      onClose={() => setStatsOpen(false)}
    />
    </>
  );
}

