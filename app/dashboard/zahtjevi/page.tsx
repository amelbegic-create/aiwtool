// app/dashboard/zahtjevi/page.tsx – Zahtjevi na čekanju
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { ArrowRight, Palmtree, ClipboardCheck, ChevronLeft, ShieldCheck, Inbox } from "lucide-react";
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
  accent: "emerald" | "blue" | "amber";
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
          status: { in: ["OPEN", "SUBMITTED", "RETURNED"] },
        },
      },
    },
  });

  if (!dbUser) redirect("/login");

  const isAdmin = ADMIN_ROLES.has(dbUser.role as Role);
  const totalPendingAdmin = isAdmin ? await prisma.vacationRequest.count({ where: { status: "PENDING" } }) : 0;

  const pendingMine = dbUser.vacations?.length ?? 0;
  const pdsPending = dbUser.pdsList?.length ?? 0;

  const items: PendingItem[] = [];

  if (pendingMine > 0) {
    items.push({
      id: "vacation",
      title: "Godišnji odmor",
      description: `${pendingMine} zahtjev(a) na čekanju`,
      href: "/tools/vacations",
      count: pendingMine,
      icon: Palmtree,
      accent: "blue",
    });
  }

  if (pdsPending > 0) {
    items.push({
      id: "pds",
      title: "PDS evaluacija",
      description: "Zahtijeva Vašu pažnju",
      href: "/tools/PDS",
      count: pdsPending,
      icon: ClipboardCheck,
      accent: "emerald",
    });
  }

  if (isAdmin && totalPendingAdmin > 0) {
    items.push({
      id: "admin-vacation",
      title: "Zahtjevi na odobrenje",
      description: `${totalPendingAdmin} čeka odobrenje`,
      href: "/tools/vacations",
      count: totalPendingAdmin,
      icon: ShieldCheck,
      accent: "amber",
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
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] font-sans text-slate-800">
      <main className="mx-auto max-w-4xl px-4 py-6 md:py-10">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-[#1a3826]"
        >
          <ChevronLeft size={18} /> Nazad na dashboard
        </Link>

        <div className="mb-10">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
            Zahtjevi na čekanju
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Pregledajte stavke i otvorite odgovarajući modul
          </p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Inbox size={32} />
            </div>
            <p className="text-base font-semibold text-slate-700">Nemate zahtjeva na čekanju</p>
            <p className="mt-1 text-sm text-slate-500">Sve je u redu. Pristupite modulima na dashboardu.</p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1a3826] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0c1f15]"
            >
              Povratak na dashboard <ArrowRight size={16} />
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
                  className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl hover:border-slate-300"
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
                      {item.count} {item.count === 1 ? "zahtjev" : "zahtjeva"}
                    </span>
                  </div>
                  <h2 className="mt-5 text-lg font-black text-slate-900 group-hover:text-[#1a3826] transition-colors">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-600">{item.description}</p>
                  <div className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#1a3826]">
                    Otvori modul
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
