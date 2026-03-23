"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import {
  deleteDashboardNewsItem,
  setDashboardNewsActive,
} from "@/app/actions/dashboardNewsActions";

export type DashboardNewsAdminRow = {
  id: string;
  title: string;
  subtitle: string | null;
  sortOrder: number;
  isActive: boolean;
  attachmentKind: string;
  coverImageUrl: string;
};

export default function DashboardNewsAdminClient({
  items,
}: {
  items: DashboardNewsAdminRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle(id: string, current: boolean) {
    startTransition(async () => {
      await setDashboardNewsActive(id, !current);
      router.refresh();
    });
  }

  function del(id: string) {
    if (!confirm("Diese Meldung wirklich löschen?")) return;
    startTransition(async () => {
      const r = await deleteDashboardNewsItem(id);
      if (!r.ok) alert(r.error ?? "Löschen fehlgeschlagen.");
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-sm font-medium text-muted-foreground">
        Noch keine Meldungen. Legen Sie eine neue an.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs font-black uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Vorschau</th>
            <th className="px-4 py-3">Titel</th>
            <th className="px-4 py-3">Reihenfolge</th>
            <th className="px-4 py-3">Typ</th>
            <th className="px-4 py-3">Aktiv</th>
            <th className="px-4 py-3 text-right">Aktionen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((row) => (
            <tr key={row.id} className="align-middle">
              <td className="px-4 py-2">
                <div className="relative h-14 w-24 overflow-hidden rounded-md border border-border bg-muted">
                  <Image
                    src={row.coverImageUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="96px"
                    unoptimized
                  />
                </div>
              </td>
              <td className="px-4 py-2 font-semibold text-foreground">
                <div>{row.title}</div>
                {row.subtitle ? (
                  <div className="mt-0.5 text-xs font-normal text-muted-foreground">
                    {row.subtitle}
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-2 tabular-nums text-muted-foreground">{row.sortOrder}</td>
              <td className="px-4 py-2 text-muted-foreground">{row.attachmentKind}</td>
              <td className="px-4 py-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggle(row.id, row.isActive)}
                  className={`rounded-lg border px-3 py-1 text-xs font-bold uppercase tracking-wide transition-colors ${
                    row.isActive
                      ? "border-[#1a3826] bg-[#1a3826] text-[#FFC72C]"
                      : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {row.isActive ? "Ja" : "Nein"}
                </button>
              </td>
              <td className="px-4 py-2 text-right">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/admin/dashboard-news/${row.id}/edit`}
                    className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-[#1a3826] hover:bg-muted dark:text-[#FFC72C]"
                    title="Bearbeiten"
                  >
                    <Pencil size={18} aria-hidden />
                  </Link>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => del(row.id)}
                    className="inline-flex items-center justify-center rounded-lg border border-destructive/40 p-2 text-destructive hover:bg-destructive/10"
                    title="Löschen"
                  >
                    <Trash2 size={18} aria-hidden />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
