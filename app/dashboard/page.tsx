import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronRight,
  CalendarDays,
  UsersRound,
  Building2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Inbox,
  Award,
  TrendingUp,
  Clock,
} from "lucide-react";
import DashboardChangelogButton from "@/components/dashboard/DashboardChangelogButton";
import DeineIdeeButton from "@/components/dashboard/DeineIdeeButton";
import CertificatesWidget from "@/components/dashboard/CertificatesWidget";
import EventSlider from "@/components/restaurant/EventSlider";
import { getDashboardChangelog } from "@/app/actions/dashboardChangelogActions";
import { dict } from "@/translations";

export const dynamic = "force-dynamic";

function isDbUnreachable(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: string }).code === "P1001"
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return dict.dashboard_greeting_morning;
  if (h >= 12 && h < 18) return dict.dashboard_greeting_day;
  return dict.dashboard_greeting_default;
}

async function getVacationDaysSummary(userId: string) {
  const year = new Date().getFullYear();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      vacationEntitlement: true,
      vacationCarryover: true,
      vacationAllowances: { where: { year }, select: { days: true } },
    },
  });
  if (!user) return null;
  const allowance = user.vacationAllowances?.[0]?.days ?? user.vacationEntitlement ?? 20;
  const total = Math.max(0, allowance) + Math.max(0, user.vacationCarryover ?? 0);
  const approved = await prisma.vacationRequest.findMany({
    where: { userId, status: "APPROVED", start: { gte: `${year}-01-01`, lte: `${year}-12-31` } },
    select: { days: true },
  });
  const used = approved.reduce((s, r) => s + r.days, 0);
  return { total, used, remaining: Math.max(0, total - used) };
}

async function getTeamCount(userId: string, role: string): Promise<number> {
  const godRoles = [Role.SYSTEM_ARCHITECT, Role.SUPER_ADMIN, Role.ADMIN];
  if (godRoles.includes(role as Role)) {
    return prisma.user.count({ where: { isActive: true, role: { not: Role.SYSTEM_ARCHITECT } } });
  }
  return prisma.user.count({ where: { supervisorId: userId, isActive: true } });
}

async function getTeamMembers(userId: string, role: string) {
  const godRoles = [Role.SYSTEM_ARCHITECT, Role.SUPER_ADMIN, Role.ADMIN];
  if (godRoles.includes(role as Role)) {
    return prisma.user.findMany({
      where: { isActive: true, role: { not: Role.SYSTEM_ARCHITECT } },
      select: { id: true, name: true, image: true },
      take: 6,
      orderBy: { name: "asc" },
    });
  }
  return prisma.user.findMany({
    where: { supervisorId: userId, isActive: true },
    select: { id: true, name: true, image: true },
    take: 6,
    orderBy: { name: "asc" },
  });
}

async function getPendingVacationCount(userId: string, role: string): Promise<number> {
  const godRoles = [Role.SYSTEM_ARCHITECT, Role.SUPER_ADMIN, Role.ADMIN];
  if (godRoles.includes(role as Role)) {
    return prisma.vacationRequest.count({ where: { status: "PENDING" } });
  }
  return prisma.vacationRequest.count({ where: { status: "PENDING", supervisorId: userId } });
}

async function getCertificates(userId: string) {
  try {
    return await prisma.userCertificate.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        pdfUrl: true,
        pdfName: true,
        createdAt: true,
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    });
  } catch {
    // Tabela još ne postoji na live bazi — vrati prazan niz
    return [];
  }
}

const DB_ERROR_UI = (
  <div className="min-h-screen bg-background font-sans text-foreground flex items-center justify-center p-4">
    <div className="max-w-md w-full rounded-2xl border border-amber-200 dark:border-amber-500/50 bg-amber-50/80 dark:bg-amber-950/30 p-8 text-center shadow-lg">
      <div className="mx-auto w-14 h-14 rounded-full bg-amber-200/80 dark:bg-amber-500/20 flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7 text-amber-700 dark:text-amber-400" />
      </div>
      <h1 className="text-xl font-bold text-foreground mb-2">Baza podataka nije dostupna</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Server baze (Neon) je privremeno nedostupan. Provjerite projekt u Neon dashboardu i pokušajte ponovo.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] px-5 py-2.5 font-bold text-sm hover:opacity-90 transition-opacity"
      >
        <RefreshCw size={18} /> Osvježi stranicu
      </Link>
    </div>
  </div>
);

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  let dbUser: Awaited<ReturnType<typeof prisma.user.findUnique>>;
  try {
    dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, role: true, permissions: true },
    });
  } catch (e) {
    if (isDbUnreachable(e)) return DB_ERROR_UI;
    throw e;
  }
  if (!dbUser) redirect("/login");

  let vacationSummary: Awaited<ReturnType<typeof getVacationDaysSummary>>;
  let teamCount: number;
  let teamMembers: Awaited<ReturnType<typeof getTeamMembers>>;
  let pendingVacationCount: number;
  let certificates: Awaited<ReturnType<typeof getCertificates>>;
  let changelog: Awaited<ReturnType<typeof getDashboardChangelog>>;

  try {
    [vacationSummary, teamCount, teamMembers, pendingVacationCount, certificates, changelog] =
      await Promise.all([
        getVacationDaysSummary(dbUser.id),
        getTeamCount(dbUser.id, String(dbUser.role)),
        getTeamMembers(dbUser.id, String(dbUser.role)),
        getPendingVacationCount(dbUser.id, String(dbUser.role)),
        getCertificates(dbUser.id),
        getDashboardChangelog(),
      ]);
  } catch (e) {
    if (isDbUnreachable(e)) return DB_ERROR_UI;
    throw e;
  }

  // Optional ambient header background from active restaurant photo
  const cookieStore = await cookies();
  const activeRestaurantId = cookieStore.get("activeRestaurantId")?.value;
  let ambientPhotoUrl: string | null = null;
  if (activeRestaurantId && activeRestaurantId !== "all") {
    try {
      const r = await prisma.restaurant.findUnique({
        where: { id: activeRestaurantId },
        select: { photoUrl: true },
      });
      ambientPhotoUrl = r?.photoUrl ?? null;
    } catch { /* non-critical */ }
  }

  const greeting = getGreeting();
  const firstName = (
    dbUser.name || (session.user as { name?: string }).name || "Benutzer"
  ).split(" ")[0];
  const roleLabel = String(dbUser.role || "CREW");

  // Popup für Zertifikate – nur für normale Mitarbeiter (nicht für Admins)
  const godRoles: string[] = [Role.SYSTEM_ARCHITECT, Role.SUPER_ADMIN, Role.ADMIN];
  const certPopupEnabled = !godRoles.includes(String(dbUser.role));

  // Vacation donut ring calculations
  const vacTotal = vacationSummary?.total ?? 0;
  const vacUsed = vacationSummary?.used ?? 0;
  const vacRemaining = vacationSummary?.remaining ?? 0;
  const vacUsedDeg = vacTotal > 0 ? Math.round((vacUsed / vacTotal) * 360) : 0;
  const vacUsedPct = vacTotal > 0 ? Math.round((vacUsed / vacTotal) * 100) : 0;

  const today = new Date().toLocaleDateString("de-AT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">

      {/* ══════════════════════════════════════
          CINEMATIC HEADER
      ══════════════════════════════════════ */}
      <header className="relative bg-[#1a3826]">
        {/* Ambient restaurant photo – čista zelena preko (bez gradijenta/sjena) */}
        {ambientPhotoUrl && (
          <>
            <Image
              src={ambientPhotoUrl}
              alt=""
              fill
              className="object-cover object-center opacity-15"
              aria-hidden
              unoptimized={ambientPhotoUrl.includes("blob.vercel-storage.com")}
            />
            <div className="absolute inset-0 bg-[#1a3826]" />
          </>
        )}

        <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-8 pt-5 md:pt-6 pb-5 md:pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[#FFC72C]/60 text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5">
              {today}
            </p>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white leading-tight">
              {greeting}, <span className="text-[#FFC72C]">{firstName}</span>
            </h1>
            <div className="mt-2">
              <span className="inline-flex items-center rounded-md bg-[#FFC72C]/15 border border-[#FFC72C]/30 px-2.5 py-0.5 text-[11px] font-black text-[#FFC72C] tracking-wider uppercase">
                {roleLabel}
              </span>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <DeineIdeeButton />
            <DashboardChangelogButton changelog={changelog} />
          </div>
        </div>
      </header>

      {/* Wave separator */}
      <div className="-mt-px pointer-events-none select-none" aria-hidden>
        <svg
          viewBox="0 0 1440 48"
          preserveAspectRatio="none"
          className="w-full h-8 md:h-12 fill-[#1a3826]"
        >
          <path d="M0,0 L0,22 C220,50 360,-6 520,22 C680,50 820,-6 1000,20 C1120,36 1270,6 1440,16 L1440,0 Z" />
        </svg>
      </div>

      {/* ══════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════ */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8 pt-2 md:pt-4 pb-10 safe-area-l safe-area-r">

        {/* ── HERO BENTO GRID ── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5 mb-8 md:mb-10">

          {/* ▌ VACATION WIDGET — dark green, donut ring */}
          <Link
            href="/tools/vacations"
            className="md:col-span-5 group relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a3826] to-[#0a1f14] p-6 md:p-8 min-h-[230px] md:min-h-[250px] flex flex-col justify-between shadow-xl shadow-[#1a3826]/20 hover:-translate-y-0.5 hover:shadow-2xl transition-all duration-300"
          >
            {/* Decorative rings in corner */}
            <div className="absolute right-5 bottom-5 w-40 h-40 rounded-full border-[2px] border-[#FFC72C]/10 pointer-events-none" />
            <div className="absolute right-8 bottom-8 w-28 h-28 rounded-full border border-[#FFC72C]/5 pointer-events-none" />

            <div className="relative z-10 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[#FFC72C]/70 text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <CalendarDays size={11} className="text-[#FFC72C]/60" />
                  Jahresurlaub {new Date().getFullYear()}
                </p>
                <div className="flex items-end gap-3 mt-2">
                  <span className="text-6xl md:text-7xl font-black tabular-nums text-white leading-none">
                    {vacRemaining}
                  </span>
                  <div className="mb-2">
                    <p className="text-white/50 text-xs font-bold leading-tight">Tage</p>
                    <p className="text-white/50 text-xs font-bold leading-tight">übrig</p>
                  </div>
                </div>
                {vacTotal > 0 && (
                  <p className="text-white/30 text-xs font-medium mt-2">
                    von {vacTotal} Tagen · {vacUsed} verbraucht
                  </p>
                )}
              </div>

              {/* Donut ring (conic gradient) */}
              {vacTotal > 0 && (
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `conic-gradient(from -90deg, #FFC72C 0deg ${vacUsedDeg}deg, rgba(255,255,255,0.08) ${vacUsedDeg}deg 360deg)`,
                  }}
                >
                  <div className="w-[68px] h-[68px] rounded-full bg-[#0a1f14] flex flex-col items-center justify-center">
                    <span className="text-base font-black text-[#FFC72C] leading-none">{vacUsedPct}%</span>
                    <span className="text-[9px] text-white/40 font-medium mt-0.5">genutzt</span>
                  </div>
                </div>
              )}
            </div>

            <div className="relative z-10 flex items-center gap-2 text-[#FFC72C] text-sm font-bold group-hover:gap-3 transition-all">
              Urlaub planen <ChevronRight size={16} />
            </div>
          </Link>

          {/* ▌ TEAM CARD — McDonald's yellow, avatar stack */}
          <Link
            href="/team"
            className="md:col-span-4 group relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FFC72C] to-[#dfa820] p-6 md:p-8 min-h-[230px] md:min-h-[250px] flex flex-col justify-between shadow-xl shadow-[#FFC72C]/20 hover:-translate-y-0.5 hover:shadow-2xl transition-all duration-300"
          >
            <div className="absolute -right-6 -bottom-6 w-48 h-48 rounded-full bg-[#1a3826]/10 blur-2xl pointer-events-none" />

            <div className="relative z-10">
              <p className="text-[#1a3826]/60 text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                <UsersRound size={11} />
                Mein Team
              </p>
              <p className="text-6xl md:text-7xl font-black tabular-nums text-[#1a3826] leading-none mt-2">
                {teamCount}
              </p>
              <p className="text-[#1a3826]/60 text-sm font-bold mt-1">Mitarbeiter</p>

              {/* Avatar stack */}
              {teamMembers.length > 0 && (
                <div className="flex items-center mt-5">
                  {teamMembers.slice(0, 5).map((member, i) => (
                    <div
                      key={member.id}
                      className="w-9 h-9 rounded-full bg-[#1a3826] border-2 border-[#FFC72C] flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm"
                      style={{ marginLeft: i > 0 ? "-10px" : "0", position: "relative", zIndex: 5 - i }}
                    >
                      {member.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={member.image} alt={member.name ?? ""} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[11px] font-black text-[#FFC72C]">
                          {member.name?.charAt(0)?.toUpperCase() ?? "?"}
                        </span>
                      )}
                    </div>
                  ))}
                  {teamCount > 5 && (
                    <div
                      className="w-9 h-9 rounded-full bg-[#1a3826]/80 border-2 border-[#FFC72C] flex items-center justify-center flex-shrink-0 shadow-sm"
                      style={{ marginLeft: "-10px", position: "relative", zIndex: 0 }}
                    >
                      <span className="text-[10px] font-black text-[#FFC72C]">+{teamCount - 5}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="relative z-10 flex items-center gap-2 text-[#1a3826] text-sm font-bold group-hover:gap-3 transition-all">
              Team öffnen <ChevronRight size={16} />
            </div>
          </Link>

          {/* ▌ PENDING REQUESTS — royal blue, status indicator */}
          <Link
            href={`/tools/vacations?tab=requests&year=${currentYear}`}
            className="md:col-span-3 relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#4169E1] to-[#2a47c4] p-6 md:p-8 min-h-[230px] md:min-h-[250px] flex flex-col justify-between shadow-xl shadow-[#4169E1]/20 hover:-translate-y-0.5 hover:shadow-2xl transition-all duration-300"
          >
            <div className="absolute -right-6 -top-6 w-36 h-36 rounded-full bg-white/5 blur-2xl pointer-events-none" />
            <div className="absolute -left-4 -bottom-4 w-24 h-24 rounded-full border border-white/10 pointer-events-none" />

            <div className="relative z-10">
              <p className="text-white/60 text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                <Inbox size={11} />
                Offene Anträge
              </p>
              <p className="text-6xl md:text-7xl font-black tabular-nums text-white leading-none mt-2">
                {pendingVacationCount}
              </p>
              <p className="text-white/60 text-sm font-bold mt-1">
                {pendingVacationCount === 0
                  ? "Alles erledigt"
                  : pendingVacationCount === 1
                  ? "Antrag wartet"
                  : "Anträge warten"}
              </p>
            </div>

            <div className="relative z-10">
              <span
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${
                  pendingVacationCount > 0
                    ? "bg-white/20 text-white"
                    : "bg-white/10 text-white/50"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    pendingVacationCount > 0 ? "bg-white animate-pulse" : "bg-white/40"
                  }`}
                />
                {pendingVacationCount > 0 ? "Aktion erforderlich" : "Alles in Ordnung"}
              </span>
            </div>
          </Link>
        </div>

        {/* ── MEISTGENUTZTE TOOLS (modern okvir) + rechts: nur Zertifikate ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6 mb-8 md:mb-10">
          {/* Links: Meistgenutzte Tools u modernom okviru */}
          <div className="lg:col-span-8">
            <div className="rounded-2xl md:rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center gap-2">
                <Sparkles size={16} className="text-[#FFC72C]" />
                <h2 className="text-sm font-black text-foreground uppercase tracking-wide">
                  Meistgenutzte Tools
                </h2>
              </div>
              <div className="p-4 md:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Produktivität */}
              <Link
                href="/tools/productivity"
                className="group relative flex flex-col gap-3 p-5 md:p-6 rounded-2xl bg-gradient-to-br from-[#4169E1] to-[#2d4fb8] shadow-lg shadow-[#4169E1]/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 overflow-hidden min-h-[160px] text-white"
              >
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-white/20 transition-all duration-300 group-hover:opacity-90">
                    <TrendingUp size={24} strokeWidth={2} className="text-white/90" />
                  </div>
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white/20 text-white">
                    Ops
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-base font-black leading-tight">Produktivität</p>
                  <p className="mt-1 text-[11px] leading-snug text-white/70 line-clamp-2">
                    Umsatz & Stationsplanung
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-white/80 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200">
                  Öffnen <ChevronRight size={12} />
                </div>
              </Link>
              {/* CL / Personaleinsatzplanung */}
              <Link
                href="/tools/labor-planner"
                className="group relative flex flex-col gap-3 p-5 md:p-6 rounded-2xl bg-gradient-to-br from-[#FFC72C] to-[#e6b328] shadow-lg shadow-[#FFC72C]/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 overflow-hidden min-h-[160px] text-[#1a3826]"
              >
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-[#1a3826]/15 transition-all duration-300 group-hover:opacity-90">
                    <Clock size={24} strokeWidth={2} className="text-[#1a3826]" />
                  </div>
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-[#1a3826]/15 text-[#1a3826]">
                    Ops
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-base font-black leading-tight">CL</p>
                  <p className="mt-1 text-[11px] leading-snug text-[#1a3826]/70 line-clamp-2">
                    Kosten- & Stundeneinsatzplanung
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-[#1a3826]/80 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200">
                  Öffnen <ChevronRight size={12} />
                </div>
              </Link>
              {/* Firmen und Partner */}
              <Link
                href="/tools/partners"
                className="group relative flex flex-col gap-3 p-5 md:p-6 rounded-2xl bg-gradient-to-br from-[#1a3826] to-[#0f2218] shadow-lg shadow-[#1a3826]/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 overflow-hidden min-h-[160px] text-white"
              >
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-white/20 transition-all duration-300 group-hover:opacity-90">
                    <Building2 size={24} strokeWidth={2} className="text-[#FFC72C]" />
                  </div>
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white/20 text-white">
                    Ops
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-base font-black leading-tight">Firmen und Partner</p>
                  <p className="mt-1 text-[11px] leading-snug text-white/70 line-clamp-2">
                    Kontakte & Servicedienstleister
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-[#FFC72C] opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200">
                  Öffnen <ChevronRight size={12} />
                </div>
              </Link>
            </div>
              </div>
            </div>
          </div>

          {/* Rechts: nur Meine Zertifikate (ista visina kao lijevi blok) */}
          <div className="lg:col-span-4 flex">
            <div className="rounded-2xl md:rounded-3xl border border-border bg-card shadow-sm overflow-hidden flex flex-col w-full min-h-0">
              <div className="px-4 py-3 border-b border-border flex items-center bg-muted/20 shrink-0">
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-tight text-foreground">
                  <Award size={16} className="text-[#FFC72C]" />
                  Meine Zertifikate
                </h3>
              </div>
              <div className="p-4 flex-1 flex flex-col min-h-0">
                <CertificatesWidget
                  certificates={certificates}
                  canOpenPopup={certPopupEnabled}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── EVENTS SLIDER (kompaktni) ── */}
        <section className="border-t border-border pt-5">
          <EventSlider />
        </section>
      </main>
    </div>
  );
}
