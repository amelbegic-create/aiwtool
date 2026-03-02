// app/dashboard/zahtjevi/page.tsx – Offene Anfragen
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import Link from "next/link";
import { ArrowRight, ChevronLeft, Inbox } from "lucide-react";
import { getAllNotificationsForUser, NotificationItem } from "@/app/actions/notificationActions";

export const dynamic = "force-dynamic";

export default async function ZahtjeviPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as { id?: string }).id;
  if (!userId) redirect("/login");

  const notifications: NotificationItem[] = await getAllNotificationsForUser(userId);

  const hasItems = notifications.length > 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background font-sans text-foreground">
      <main className="mx-auto max-w-4xl px-4 py-6 md:py-10 safe-area-l safe-area-r">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-2 min-h-[44px] py-2 text-sm font-semibold text-slate-600 transition-colors hover:text-[#1a3826] touch-manipulation"
        >
          <ChevronLeft size={18} /> Zurück zum Dashboard
        </Link>

        <div className="mb-10">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">Offene Anfragen</h1>
          <p className="mt-2 text-sm text-slate-600">
            Übersicht über Benachrichtigungen der letzten Tage. Klicken Sie auf einen Eintrag, um das Modul zu öffnen.
          </p>
        </div>

        {!hasItems ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Inbox size={32} />
            </div>
            <p className="text-base font-semibold text-slate-700">Sie haben keine Benachrichtigungen.</p>
            <p className="mt-1 text-sm text-slate-500">
              Alles in Ordnung. Nutzen Sie die Module im Dashboard oder kehren Sie dorthin zurück.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-[#1a3826] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#0c1f15] active:scale-[0.98] touch-manipulation"
            >
              Zurück zum Dashboard <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                Benachrichtigungen ({notifications.length})
              </div>
            </div>
            <ul className="divide-y divide-slate-100">
              {notifications.map((n) => {
                const created = new Date(n.createdAt);
                const dateLabel = created.toLocaleString("de-AT", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{n.title}</div>
                        <div className="mt-0.5 text-xs text-slate-600 truncate">{n.description}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[11px] font-mono text-slate-400">{dateLabel}</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase text-[#1a3826]">
                          Modul öffnen
                          <ArrowRight size={12} />
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
