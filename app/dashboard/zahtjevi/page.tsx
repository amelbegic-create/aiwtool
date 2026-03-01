// app/dashboard/zahtjevi/page.tsx – Offene Anfragen
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { ArrowRight, Palmtree, ClipboardCheck, ChevronLeft, ShieldCheck, Inbox, Undo2 } from "lucide-react";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set<Role>([Role.SUPER_ADMIN, Role.ADMIN, Role.SYSTEM_ARCHITECT, Role.MANAGER]);

type PendingItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  count: number;
  icon: typeof Palmtree;
  accent: "emerald" | "blue" | "amber" | "red";
  vacationRows?: { restaurantName: string; userName: string }[];
  vacationRowLabel?: string;
};

export default async function ZahtjeviPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as { id?: string }).id;
  if (!userId) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      vacations: { where: { status: "PENDING" } },
      pdsList: {
        where: {
          year: new Date().getFullYear(),
          status: { in: ["DRAFT", "OPEN", "IN_PROGRESS", "RETURNED"] },
        },
      },
    },
  });

  if (!dbUser) redirect("/login");

  const isAdmin = ADMIN_ROLES.has(dbUser.role as Role);
  const totalPendingAdmin = isAdmin ? await prisma.vacationRequest.count({ where: { status: "PENDING" } }) : 0;

  const cancelPendingForSystemArchitect =
    isAdmin && dbUser.role === Role.SYSTEM_ARCHITECT
      ? await prisma.vacationRequest.count({ where: { status: "CANCEL_PENDING" } })
      : 0;
  const cancelPendingAsSupervisor =
    isAdmin
      ? await prisma.vacationRequest.count({
          where: { status: "CANCEL_PENDING", user: { supervisorId: userId } },
        })
      : 0;
  const cancelPendingCount =
    dbUser.role === Role.SYSTEM_ARCHITECT
      ? cancelPendingForSystemArchitect
      : cancelPendingAsSupervisor;

  const pendingVacationRequests =
    isAdmin && totalPendingAdmin > 0
      ? await prisma.vacationRequest.findMany({
          where: { status: "PENDING" },
          include: {
            user: { select: { name: true } },
            restaurant: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : [];

  const cancelPendingRequests =
    isAdmin && cancelPendingCount > 0
      ? await prisma.vacationRequest.findMany({
          where:
            dbUser.role === Role.SYSTEM_ARCHITECT
              ? { status: "CANCEL_PENDING" }
              : { status: "CANCEL_PENDING", user: { supervisorId: userId } },
          include: {
            user: { select: { name: true } },
            restaurant: { select: { name: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 20,
        })
      : [];

  const pdsPending = dbUser.pdsList?.length ?? 0;

  const since = new Date();
  since.setDate(since.getDate() - 7);
  const vacationProcessedCount = isAdmin
    ? 0
    : await prisma.vacationRequest.count({
        where: {
          userId,
          status: { in: ["APPROVED", "REJECTED"] },
          updatedAt: { gte: since },
        },
      });

  const items: PendingItem[] = [];

  if (!isAdmin && vacationProcessedCount > 0) {
    items.push({
      id: "vacation-processed",
      title: "Urlaubsanträge bearbeitet",
      description: `${vacationProcessedCount} Antrag/Anträge wurden bearbeitet`,
      href: "/tools/vacations",
      count: vacationProcessedCount,
      icon: Palmtree,
      accent: "blue",
    });
  }

  if (pdsPending > 0) {
    items.push({
      id: "pds",
      title: "PDS-Bewertung",
      description: "Erfordert Ihre Aufmerksamkeit",
      href: "/tools/PDS",
      count: pdsPending,
      icon: ClipboardCheck,
      accent: "emerald",
    });
  }

  if (isAdmin && totalPendingAdmin > 0) {
    items.push({
      id: "admin-vacation",
      title: "Anträge zur Genehmigung",
      description: `${totalPendingAdmin} warten auf Genehmigung`,
      href: "/tools/vacations",
      count: totalPendingAdmin,
      icon: ShieldCheck,
      accent: "amber",
      vacationRows: pendingVacationRequests.map((r) => ({
        restaurantName: r.restaurant?.name ?? "N/A",
        userName: r.user?.name ?? "N/A",
      })),
    });
  }

  if (isAdmin && cancelPendingCount > 0) {
    items.push({
      id: "admin-vacation-storno",
      title: "Stornierungen beantragt",
      description: `${cancelPendingCount} Urlaubs-Stornierung(en) warten auf Freigabe`,
      href: "/tools/vacations",
      count: cancelPendingCount,
      icon: Undo2,
      accent: "red",
      vacationRowLabel: "Stornierung",
      vacationRows: cancelPendingRequests.map((r) => ({
        restaurantName: r.restaurant?.name ?? "N/A",
        userName: r.user?.name ?? "N/A",
      })),
    });
  }

  const accentClasses = {
    emerald: {
      iconBg: "bg-[#1a3826]/10 text-[#1a3826] group-hover:bg-[#1a3826] group-hover:text-white",
      badge: "bg-emerald-100 text-emerald-700",
      border: "border-emerald-200",
    },
    blue: {
      iconBg: "bg-blue-500/10 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",
      badge: "bg-blue-100 text-blue-700",
      border: "border-blue-200",
    },
    amber: {
      iconBg: "bg-amber-500/10 text-amber-700 group-hover:bg-[#FFC72C] group-hover:text-[#1a3826]",
      badge: "bg-amber-100 text-amber-800",
      border: "border-amber-200",
    },
    red: {
      iconBg: "bg-red-500/10 text-red-600 group-hover:bg-red-600 group-hover:text-white",
      badge: "bg-red-100 text-red-700",
      border: "border-red-200",
    },
  };

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
          <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
            Offene Anfragen
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Prüfen Sie die Einträge und öffnen Sie das passende Modul.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Inbox size={32} />
            </div>
            <p className="text-base font-semibold text-slate-700">Sie haben keine offenen Anfragen.</p>
            <p className="mt-1 text-sm text-slate-500">Alles in Ordnung. Nutzen Sie die Module im Dashboard.</p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-[#1a3826] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#0c1f15] active:scale-[0.98] touch-manipulation"
            >
              Zurück zum Dashboard <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const Icon = item.icon;
              const accent = accentClasses[item.accent];
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group flex flex-col rounded-xl md:rounded-2xl border border-slate-200 dark:border-border bg-white dark:bg-card p-5 sm:p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl hover:border-slate-300 active:scale-[0.99] touch-manipulation min-h-[120px]"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-colors ${accent.iconBg}`}
                    >
                      <Icon size={26} strokeWidth={2} />
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${accent.badge}`}
                    >
                      {item.count} {item.count === 1 ? "Anfrage" : "Anfragen"}
                    </span>
                  </div>
                  <h2 className="mt-5 text-lg font-black text-slate-900 group-hover:text-[#1a3826] transition-colors">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-600">{item.description}</p>
                  {item.vacationRows && item.vacationRows.length > 0 && (
                    <ul className="mt-3 space-y-1.5 max-h-32 overflow-y-auto">
                      {item.vacationRows.map((row, i) => (
                        <li key={i} className="text-xs font-semibold text-slate-700 truncate" title={`${row.restaurantName} – ${row.userName} – ${item.vacationRowLabel ?? "Neue Anfrage"}`}>
                          <span className="text-[#1a3826]">{row.restaurantName}</span>
                          <span className="text-slate-400 mx-1">–</span>
                          <span>{row.userName}</span>
                          <span className="text-slate-400 ml-1">– {item.vacationRowLabel ?? "Neue Anfrage"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#1a3826]">
                    Modul öffnen
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 transition-colors group-hover:bg-[#1a3826]/10">
                      <ArrowRight size={14} className="text-slate-500 group-hover:text-[#1a3826]" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
