// app/dashboard/page.tsx
import type React from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Palmtree,
  ShieldCheck,
  UserCog,
  BookOpenCheck,
  Clock,
  Gift,
  BarChart3,
  LayoutGrid,
  Activity,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Role } from "@prisma/client";
import { formatDateDDMMGGGG } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";

const formatDate = (date: Date) => formatDateDDMMGGGG(date);

const ADMIN_ROLES = new Set<Role>([
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.SYSTEM_ARCHITECT,
  Role.MANAGER,
]);

function canAccess(isAdmin: boolean, permissions: string[], required?: string) {
  if (isAdmin) return true;
  if (!required) return true;
  return Array.isArray(permissions) && permissions.includes(required);
}

type ToolCategory = "staff" | "operations" | "other";

type ToolDef = {
  id: string;
  title: string;
  href: string;
  category: ToolCategory;
  permissionKey?: string;
  badge?: (ctx: DashboardContext) => string | null;
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
  adminOnly?: boolean;
};

type DashboardContext = {
  isAdmin: boolean;
  vacationLeft: number;
  pendingMine: number;
  totalPendingAdmin: number;
  pdsScore: number;
  pdsStatus: string;
};

const TOOLS: ToolDef[] = [
  { id: "vacations", title: "Godišnji odmori", href: "/tools/vacations", category: "staff", permissionKey: "vacation:access", icon: Palmtree, badge: (c) => `${c.vacationLeft} dana` },
  { id: "pds", title: "PDS sistem", href: "/tools/PDS", category: "staff", permissionKey: "pds:access", icon: ClipboardCheck, badge: (c) => `${c.pdsScore} bod` },
  { id: "bonusi", title: "Bonusi", href: "/tools/bonusi", category: "staff", icon: Gift, adminOnly: true },
  { id: "rules", title: "Pravila & procedure", href: "/tools/rules", category: "staff", permissionKey: "rules:access", icon: BookOpenCheck, badge: () => "CMS" },
  { id: "productivity", title: "Produktivnost", href: "/tools/productivity", category: "operations", icon: BarChart3 },
  { id: "labor", title: "Labor planner", href: "/tools/labor-planner", category: "operations", icon: Clock },
  { id: "admin", title: "Admin panel", href: "/admin", category: "other", permissionKey: "users:access", icon: ShieldCheck, badge: (c) => (c.isAdmin && c.totalPendingAdmin > 0 ? `${c.totalPendingAdmin} pending` : null) },
  { id: "profile", title: "Moj profil", href: "/profile", category: "other", icon: UserCog },
];

// Kockica – stat pločica unutar zelenog heroja (kao na slici)
function Kockica({
  label,
  value,
  sub,
  valueYellow,
  fullHighlight,
  href,
}: {
  label: string;
  value: string | number;
  sub: string;
  valueYellow?: boolean;
  fullHighlight?: boolean;
  href?: string;
}) {
  const box = (
    <div
      className={`flex min-w-[130px] flex-col items-center justify-center rounded-2xl px-5 py-4 text-center
        ${href ? "cursor-pointer transition-all hover:bg-white/20" : ""}
        ${fullHighlight ? "bg-[#FFC72C] text-[#1a3826] shadow-lg shadow-amber-500/20" : "bg-white/10 backdrop-blur-sm border border-white/10"}`}
    >
      <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${fullHighlight ? "opacity-70" : "text-emerald-100/70"}`}>
        {label}
      </span>
      <span className={`text-2xl font-black ${valueYellow && !fullHighlight ? "text-[#FFC72C]" : fullHighlight ? "" : "text-white"}`}>
        {value}
      </span>
      <span className={`text-xs font-bold mt-0.5 ${fullHighlight ? "opacity-80" : "text-emerald-200/90"}`}>{sub}</span>
    </div>
  );

  if (href) {
    return <Link href={href}>{box}</Link>;
  }
  return box;
}

// Modul kartica – u stilu projekta (Admin, categories)
function ToolCard({ tool, ctx }: { tool: ToolDef; ctx: DashboardContext }) {
  const Icon = tool.icon;
  const badgeText = tool.badge?.(ctx) ?? null;
  const isAdminTool = tool.id === "admin";

  return (
    <Link
      href={tool.href}
      className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${
            isAdminTool ? "bg-[#1a3826]/10 text-[#1a3826]" : "bg-[#1a3826]/10 text-[#1a3826]"
          } group-hover:bg-[#1a3826] group-hover:text-white`}
        >
          <Icon size={22} strokeWidth={2} />
        </div>
        {badgeText && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
            {badgeText}
          </span>
        )}
      </div>
      <h3 className="mt-5 text-lg font-black text-slate-900 group-hover:text-[#1a3826] transition-colors">
        {tool.title}
      </h3>
      <div className="mt-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#1a3826]">
        Otvori
        <span className="h-8 w-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:bg-[#1a3826]/5 group-hover:border-[#1a3826]/20 transition-colors">
          <ArrowRight size={14} className="text-slate-400 group-hover:text-[#1a3826]" />
        </span>
      </div>
    </Link>
  );
}

function ActivityItem({ label, date, status, dotColor }: { label: string; date?: string; status?: string; dotColor: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
        <div className="my-1 w-px flex-1 bg-slate-200 min-h-[20px]" />
      </div>
      <div className="pb-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        {date && <p className="text-sm font-semibold text-slate-800">{date}</p>}
        {status && (
          <p
            className={`text-xs font-black uppercase ${
              status === "APPROVED" ? "text-green-600" : status === "REJECTED" ? "text-red-600" : "text-amber-600"
            }`}
          >
            {status}
          </p>
        )}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userSession = session.user as { id?: string; role?: Role };
  const userId = userSession.id;
  if (!userId) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      vacations: { orderBy: { createdAt: "desc" }, take: 5 },
      pdsList: { where: { year: new Date().getFullYear() + 1 }, take: 1 },
    },
  });

  if (!dbUser) redirect("/login");

  const effectiveRole = (userSession.role ?? dbUser.role) as Role;
  const isAdmin = ADMIN_ROLES.has(effectiveRole);
  const totalPendingAdmin = isAdmin ? await prisma.vacationRequest.count({ where: { status: "PENDING" } }) : 0;
  const perms = dbUser.permissions || [];

  const currentPDS = dbUser.pdsList?.[0];
  const pdsScore = currentPDS?.totalScore ?? 0;
  const pdsStatus = currentPDS?.status ?? "Nije započeto";

  const totalVacation = (dbUser.vacationEntitlement || 0) + (dbUser.vacationCarryover || 0);
  const usedVacation = (dbUser.vacations || []).filter((v) => v.status === "APPROVED").reduce((acc, v) => acc + v.days, 0);
  const vacationLeft = totalVacation - usedVacation;
  const pendingMine = (dbUser.vacations || []).filter((v) => v.status === "PENDING").length;

  const ctx: DashboardContext = { isAdmin, vacationLeft, pendingMine, totalPendingAdmin, pdsScore, pdsStatus };

  const visibleTools = TOOLS.filter((t) => {
    if (t.adminOnly && !isAdmin) return false;
    return canAccess(isAdmin, perms, t.permissionKey);
  });

  const userFirstName = (dbUser.name || "Korisnik").split(" ")[0];
  const vacations = dbUser.vacations || [];
  const hasPending = (isAdmin ? totalPendingAdmin : pendingMine) > 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] font-sans text-slate-800">
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
        {/* Hero – zelena kartica sa kockicama */}
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-[#1a3826] p-5 md:p-10 shadow-2xl shadow-emerald-900/20">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#FFC72C]/10 rounded-full blur-3xl -ml-20 -mb-20" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-bold text-[#FFC72C] mb-4">
                <Sparkles size={14} />
                Sistem aktivan
              </div>

              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
                Dobrodošao, <span className="text-[#FFC72C]">{userFirstName}</span>.
              </h1>

              <p className="mt-4 text-lg font-medium text-emerald-100/90">
                Imate <strong className="text-white">{pendingMine}</strong> zahtjeva na čekanju i trenutni PDS skor{" "}
                <strong className="text-white">{pdsScore}</strong>.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Kockica label="Godišnji" value={vacationLeft} sub="Dana ostalo" />
              <Kockica label="PDS Skor" value={pdsScore} sub={pdsStatus} valueYellow />
              {isAdmin && (
                <Kockica
                  label="Zahtjevi"
                  value={totalPendingAdmin}
                  sub="Na čekanju"
                  fullHighlight={totalPendingAdmin > 0}
                  href="/dashboard/zahtjevi"
                />
              )}
              {!isAdmin && hasPending && (
                <Kockica label="Zahtjevi" value={pendingMine} sub="Na čekanju" href="/dashboard/zahtjevi" />
              )}
            </div>
          </div>

          {hasPending && (
            <Link
              href="/dashboard/zahtjevi"
              className="relative z-10 mt-6 flex items-center justify-between rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-white/20"
            >
              <span>Pregledaj zahtjeve na čekanju</span>
              <ChevronRight size={18} />
            </Link>
          )}
        </div>

        {/* Moduli + Aktivnost */}
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_300px]">
          <div>
            <h2 className="mb-5 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-600">
              <LayoutGrid size={18} className="text-[#1a3826]" />
              Moduli
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visibleTools.map((t) => (
                <ToolCard key={t.id} tool={t} ctx={ctx} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-5 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-600">
              <Activity size={18} className="text-[#1a3826]" />
              Nedavna aktivnost
            </h2>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <ActivityItem label="PDS" date={pdsStatus} dotColor="bg-[#1a3826]" />
              {vacations.map((v) => (
                <ActivityItem
                  key={v.id}
                  label="Zahtjev za odmor"
                  date={formatDate(new Date(v.start))}
                  status={v.status}
                  dotColor={
                    v.status === "APPROVED" ? "bg-green-500" : v.status === "REJECTED" ? "bg-red-500" : "bg-amber-500"
                  }
                />
              ))}
              {vacations.length === 0 && <p className="text-xs font-semibold text-slate-500">Nema nedavne aktivnosti.</p>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
