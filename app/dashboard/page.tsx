import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, UsersRound, AlertCircle, RefreshCw } from "lucide-react";
import DashboardChangelogButton from "@/components/dashboard/DashboardChangelogButton";
import DeineIdeeButton from "@/components/dashboard/DeineIdeeButton";
import DashboardCalendarCard from "@/components/dashboard/DashboardCalendarCard";
import DashboardNewsSlider from "@/components/dashboard/DashboardNewsSlider";
import EventSlider from "@/components/restaurant/EventSlider";
import { hasPermission } from "@/lib/access";
import { getDashboardChangelog } from "@/app/actions/dashboardChangelogActions";
import { getCalendarEvents } from "@/app/actions/calendarActions";
import { getTodos } from "@/app/actions/todoActions";
import { dict } from "@/translations";
import DashboardTodoCard from "@/components/dashboard/DashboardTodoCard";
import DashboardVacationCard from "@/components/dashboard/DashboardVacationCard";
import { getUserVacationYearSnapshot, getVacationReportForUser } from "@/app/actions/vacationActions";
import { getActiveDashboardNews } from "@/app/actions/dashboardNewsActions";
import { getActiveDashboardEvents } from "@/app/actions/dashboardEventActions";
import { getPinnedDocs } from "@/app/actions/dashboardPinnedDocsActions";
import QualitaetsfuehrerLauncher from "@/components/dashboard/QualitaetsfuehrerLauncher";

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

/** Returns YYYY-MM-DD strings for every day in approved vacation in the given year. Never throws. */
async function getApprovedVacationDates(userId: string, year: number): Promise<string[]> {
  try {
    const approved = await prisma.vacationRequest.findMany({
      where: { userId, status: "APPROVED", start: { gte: `${year}-01-01`, lte: `${year}-12-31` } },
      select: { start: true, end: true },
    });
    const out: string[] = [];
    for (const r of approved) {
      const start = new Date(r.start);
      const end = new Date(r.end);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) continue;
      const d = new Date(start);
      while (d <= end) {
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const day = d.getDate();
        if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(day)) {
          out.push(`${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
        }
        d.setDate(d.getDate() + 1);
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function getTeamCount(userId: string, role: string): Promise<number> {
  const godRoles = [Role.SYSTEM_ARCHITECT, Role.ADMIN];
  if (godRoles.includes(role as Role)) {
    return prisma.user.count({ where: { isActive: true, role: { not: Role.SYSTEM_ARCHITECT } } });
  }
  return prisma.user.count({ where: { supervisorId: userId, isActive: true } });
}

async function getTeamMembers(userId: string, role: string) {
  const godRoles = [Role.SYSTEM_ARCHITECT, Role.ADMIN];
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
  const godRoles = [Role.SYSTEM_ARCHITECT, Role.ADMIN];
  if (godRoles.includes(role as Role)) {
    return prisma.vacationRequest.count({ where: { status: "PENDING" } });
  }
  return prisma.vacationRequest.count({ where: { status: "PENDING", supervisorId: userId } });
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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

  let vacationSnapshot: Awaited<ReturnType<typeof getUserVacationYearSnapshot>>;
  let vacationReport: Awaited<ReturnType<typeof getVacationReportForUser>> | null;
  let teamCount: number;
  let teamMembers: Awaited<ReturnType<typeof getTeamMembers>>;
  let changelog: Awaited<ReturnType<typeof getDashboardChangelog>>;
  let calendarEvents: Awaited<ReturnType<typeof getCalendarEvents>>;
  let initialTodos: Awaited<ReturnType<typeof getTodos>>;

  const now = new Date();
  const currentYearForCalendar = now.getFullYear();
  const currentMonthForCalendar = now.getMonth() + 1;
  const canVacationPdf = hasPermission(
    String(dbUser.role),
    dbUser.permissions ?? [],
    "vacation:access"
  );

  try {
    [vacationSnapshot, vacationReport, teamCount, teamMembers, changelog, calendarEvents, initialTodos] =
      await Promise.all([
        getUserVacationYearSnapshot(dbUser.id, currentYearForCalendar),
        canVacationPdf ? getVacationReportForUser(dbUser.id, currentYearForCalendar) : Promise.resolve(null),
        getTeamCount(dbUser.id, String(dbUser.role)),
        getTeamMembers(dbUser.id, String(dbUser.role)),
        getDashboardChangelog(),
        getCalendarEvents(dbUser.id, currentYearForCalendar, currentMonthForCalendar),
        getTodos(dbUser.id),
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
  const roleLabel = String(dbUser.role || "MITARBEITER");

  let dashboardNews: Awaited<ReturnType<typeof getActiveDashboardNews>> = [];
  try {
    dashboardNews = await getActiveDashboardNews();
  } catch {
    /* Tabelle fehlt bis db push / instrumentation */
  }
  let dashboardEvents: Awaited<ReturnType<typeof getActiveDashboardEvents>> = [];
  try {
    dashboardEvents = await getActiveDashboardEvents();
  } catch {
    /* Tabelle fehlt bis db push / instrumentation */
  }

  let pinnedDocs: Awaited<ReturnType<typeof getPinnedDocs>> = [];
  try {
    pinnedDocs = await getPinnedDocs();
  } catch {
    /* Tabelle fehlt bis db push / instrumentation */
  }

  const sp = await searchParams;
  const openNewsId = typeof sp?.openNews === "string" ? sp.openNews : null;
  const openEventId = typeof sp?.openEvent === "string" ? sp.openEvent : null;

  const vacationPdfPayload =
    canVacationPdf && vacationReport
      ? { userStat: vacationReport.userStat, requests: vacationReport.requests }
      : null;

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

        <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-8 pt-5 md:pt-6 pb-5 md:pb-6 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-4 md:gap-6 md:items-center">
          <div className="min-w-0">
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
          <div className="flex justify-center px-1 md:px-2">
            <QualitaetsfuehrerLauncher docs={pinnedDocs} />
          </div>
          <div className="flex flex-col items-stretch sm:items-end sm:flex-row sm:justify-end gap-2 justify-self-end w-full md:w-auto">
            <div className="flex items-center justify-center sm:justify-end gap-2">
              <DeineIdeeButton />
              <DashboardChangelogButton changelog={changelog} />
            </div>
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

        {/* ── Vier Karten in einer Reihe (lg): Kalender | Team | Aufgaben | Urlaub ── */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 items-stretch min-h-[240px] ${teamCount > 0 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {/* 1. Mein Kalender */}
          <div className="min-h-0 flex flex-col">
            <DashboardCalendarCard
              userId={dbUser.id}
              initialEvents={calendarEvents}
              initialYear={currentYearForCalendar}
              initialMonth={currentMonthForCalendar}
              canWriteCalendar={hasPermission(dbUser.role, dbUser.permissions ?? [], "calendar:write")}
            />
          </div>

          {/* 2. MEIN TEAM — nur sichtbar wenn der Benutzer Mitarbeiter führt */}
          {teamCount > 0 && <div className="min-h-0 flex flex-col">
            <Link
              href="/team"
              className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-[#FFC72C] to-[#dfa820] p-5 flex flex-row justify-between items-stretch gap-4 shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 min-h-[140px] h-full"
            >
              <div className="absolute -right-2 -bottom-2 w-20 h-20 rounded-full bg-[#1a3826]/10 blur-xl pointer-events-none" />
              <div className="absolute right-8 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-[#1a3826]/5 pointer-events-none" />
              <div className="relative z-10 flex flex-col justify-between h-full min-w-0 flex-1">
                <p className="text-[#1a3826] text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 shrink-0">
                  <UsersRound size={12} className="text-[#1a3826]" />
                  MEIN TEAM
                </p>
                <div className="py-1">
                  <p className="text-3xl font-black tabular-nums text-[#1a3826] leading-none">
                    {teamCount}
                  </p>
                  <p className="text-[#1a3826]/70 text-sm font-bold mt-0.5">Mitarbeiter</p>
                  {teamMembers.length > 0 && (
                    <div className="flex items-center mt-2 flex-wrap gap-0.5">
                      {teamMembers.slice(0, 5).map((member, i) => (
                        <div
                          key={member.id}
                          className="w-6 h-6 rounded-full bg-[#1a3826] border-2 border-[#FFC72C] flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm"
                          style={{ marginLeft: i > 0 ? "-5px" : "0", position: "relative", zIndex: 5 - i }}
                        >
                          {member.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={member.image} alt={member.name ?? ""} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-black text-white">
                              {member.name?.charAt(0)?.toUpperCase() ?? "?"}
                            </span>
                          )}
                        </div>
                      ))}
                      {teamCount > 5 && (
                        <div
                          className="w-6 h-6 rounded-full bg-[#1a3826] border-2 border-[#FFC72C] flex items-center justify-center flex-shrink-0 shadow-sm"
                          style={{ marginLeft: "-5px", position: "relative", zIndex: 0 }}
                        >
                          <span className="text-[8px] font-black text-white">+{teamCount - 5}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <span className="flex items-center gap-1.5 text-[#1a3826] text-sm font-bold group-hover:gap-2 transition-all shrink-0">
                  Team öffnen <ChevronRight size={14} />
                </span>
              </div>
              <div className="relative z-10 w-10 shrink-0" aria-hidden />
            </Link>
          </div>}

          {/* 3. Meine Aufgaben */}
          <div className="min-h-0 flex flex-col">
            <DashboardTodoCard userId={dbUser.id} initialTodos={initialTodos} />
          </div>

          {/* 4. JAHRESURLAUB */}
          <div className="min-h-0 flex flex-col">
            <DashboardVacationCard
              year={currentYear}
              carryover={vacationSnapshot.carryover}
              allowance={vacationSnapshot.allowance}
              total={vacationSnapshot.total}
              used={vacationSnapshot.used}
              remaining={vacationSnapshot.remaining}
              pdf={vacationPdfPayload}
            />
          </div>
        </div>

        {/* ── NEWS SLIDER (CMS) ── */}
        <section className="mb-8 md:mb-10 border-t border-border pt-5">
          <DashboardNewsSlider items={dashboardNews} initialOpenId={openNewsId} />
        </section>

        {/* ── EVENTS SLIDER (kompaktni) ── */}
        <section className="border-t border-border pt-5">
          <EventSlider items={dashboardEvents} initialOpenId={openEventId} />
        </section>
      </main>
    </div>
  );
}
