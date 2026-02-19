import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import Link from "next/link";
import { ChevronRight, Sparkles, CalendarDays, UsersRound } from "lucide-react";
import DashboardChangelogCard from "@/components/dashboard/DashboardChangelogCard";
import DashboardModuleIcons from "@/components/dashboard/DashboardModuleIcons";
import { getDashboardHighlights } from "@/app/actions/dashboardHighlightActions";
import { getDashboardChangelog } from "@/app/actions/dashboardChangelogActions";
import { dict } from "@/translations";

export const dynamic = "force-dynamic";

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
    where: {
      userId,
      status: "APPROVED",
      start: { gte: `${year}-01-01`, lte: `${year}-12-31` },
    },
    select: { days: true },
  });
  const used = approved.reduce((s, r) => s + r.days, 0);
  return { total, used, remaining: Math.max(0, total - used) };
}

async function getTeamCount(userId: string, role: string): Promise<number> {
  const godRoles = [Role.SYSTEM_ARCHITECT, Role.SUPER_ADMIN, Role.ADMIN];
  if (godRoles.includes(role as Role)) {
    return prisma.user.count({
      where: { isActive: true, role: { not: Role.SYSTEM_ARCHITECT } },
    });
  }
  return prisma.user.count({
    where: { supervisorId: userId, isActive: true },
  });
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, role: true, permissions: true },
  });
  if (!dbUser) redirect("/login");

  const [highlights, vacationSummary, teamCount, changelog] = await Promise.all([
    getDashboardHighlights(),
    getVacationDaysSummary(dbUser.id),
    getTeamCount(dbUser.id, String(dbUser.role)),
    getDashboardChangelog(),
  ]);

  const greeting = getGreeting();
  const firstName = (dbUser.name || (session.user as { name?: string }).name || "Benutzer").split(" ")[0];
  const roleLabel = String(dbUser.role || "CREW");

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="bg-[#1a3826] text-white">
        <div className="mx-auto max-w-6xl px-4 py-5 md:py-8 md:px-8 md:py-10">
          <div className="relative overflow-hidden rounded-xl md:rounded-3xl bg-[#1a3826]">
            <div className="absolute top-0 right-0 w-48 h-48 md:w-72 md:h-72 bg-white/5 rounded-full blur-3xl -mr-16 md:-mr-24 -mt-16 md:-mt-24" />
            <div className="absolute bottom-0 left-0 w-40 h-40 md:w-56 md:h-56 bg-[#FFC72C]/10 rounded-full blur-3xl -ml-16 md:-ml-20 -mb-16 md:-mb-20" />
            <div className="relative z-10 flex flex-col gap-2 md:gap-4 pr-2">
              <div className="min-w-0 pl-1">
                <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white leading-tight">
                  {greeting},{" "}
                  <span className="text-[#FFC72C]">{firstName}</span>
                  <span className="ml-2 md:ml-3 inline-flex items-center align-middle">
                    <span className="rounded-lg bg-[#FFC72C] px-2.5 py-0.5 md:px-3 md:py-1 text-xs md:text-sm font-bold text-[#1a3826] shadow-sm">
                      {roleLabel}
                    </span>
                  </span>
                </h1>
                <p className="mt-2 md:mt-3 text-sm md:text-base font-medium text-emerald-100/90 pl-0 md:pl-5">
                  {dict.dashboard_hero_subtitle}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:px-8 md:py-10 safe-area-l safe-area-r">
        <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-12">
          {/* Hero: Urlaubsstatus – veliki broj, gradijent, jak CTA */}
          <div className="lg:col-span-5">
            <Link
              href="/tools/vacations"
              className="group block h-full rounded-2xl md:rounded-3xl overflow-hidden border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-gradient-to-br from-emerald-50 via-white to-[#1a3826]/5 dark:from-[#1a3826]/20 dark:via-background dark:to-[#1a3826]/10 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="relative p-6 md:p-8 min-h-[200px] flex flex-col justify-between">
                <div className="absolute top-4 right-4 md:top-6 md:right-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <CalendarDays className="h-24 w-24 md:h-32 md:w-32 text-[#1a3826] dark:text-[#FFC72C]" />
                </div>
                <div className="relative">
                  <p className="text-sm font-bold uppercase tracking-wider text-[#1a3826]/70 dark:text-[#FFC72C]/80">
                    {dict.dashboard_vacation_status_label}
                  </p>
                  {vacationSummary ? (
                    <>
                      <p className="mt-2 text-4xl md:text-5xl lg:text-6xl font-black tabular-nums text-[#1a3826] dark:text-[#FFC72C]">
                        {vacationSummary.remaining}
                      </p>
                      <p className="mt-1 text-base font-semibold text-muted-foreground">
                        {dict.dashboard_vacation_status_rest}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        von {vacationSummary.total} · Verbraucht {vacationSummary.used}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-lg text-muted-foreground">
                      {dict.dashboard_vacation_status_not_available}
                    </p>
                  )}
                </div>
                <div className="relative mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#1a3826] dark:text-[#FFC72C] group-hover:gap-3 transition-all">
                  {dict.dashboard_vacation_status_open_cta}{" "}
                  <ChevronRight size={18} className="group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          </div>
          <div className="lg:col-span-7">
            <DashboardChangelogCard initial={changelog} />
          </div>
          {/* Mein Team – velika naglašena kartica s brojem */}
          <div className="lg:col-span-4">
            <Link
              href="/team"
              className="group block h-full rounded-2xl md:rounded-3xl overflow-hidden border border-amber-200/60 dark:border-amber-500/30 bg-gradient-to-br from-amber-50 via-yellow-50/50 to-amber-100/80 dark:from-amber-950/50 dark:via-yellow-950/30 dark:to-amber-900/40 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 p-6 md:p-8 min-h-[180px]"
            >
              <div className="flex flex-col h-full justify-between">
                <div className="flex items-start justify-between">
                  <div className="h-14 w-14 md:h-16 md:w-16 rounded-2xl bg-gradient-to-br from-[#FFC72C] to-amber-400 text-[#1a3826] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-300">
                    <UsersRound size={28} strokeWidth={2} className="md:w-8 md:h-8" />
                  </div>
                  {teamCount > 0 && (
                    <span className="rounded-full bg-[#1a3826]/10 dark:bg-[#FFC72C]/20 px-3 py-1 text-sm font-bold text-[#1a3826] dark:text-[#FFC72C]">
                      {teamCount} {teamCount === 1 ? "Mitarbeiter" : "Mitarbeiter"}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-lg md:text-xl font-black text-[#1a3826] dark:text-amber-100 uppercase tracking-tight">
                    {dict.dashboard_team_card_title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {dict.dashboard_team_card_subtitle}
                  </p>
                </div>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#1a3826] dark:text-amber-300 group-hover:gap-3 transition-all">
                  {dict.dashboard_team_card_link} <ChevronRight size={16} />
                </span>
              </div>
            </Link>
          </div>
          {/* Module auf der Startseite – grid s hover lift */}
          <div className="lg:col-span-8">
            <div className="rounded-2xl md:rounded-3xl border border-border bg-card shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-muted/30">
                <h2 className="text-base font-bold text-card-foreground flex items-center gap-2">
                  <Sparkles size={18} className="text-[#FFC72C]" />
                  Module auf der Startseite
                </h2>
              </div>
              <div className="p-6">
                {highlights.length > 0 ? (
                  <DashboardModuleIcons highlights={highlights} />
                ) : (
                  <p className="text-sm text-muted-foreground py-4">Keine Module hinzugefügt. Admin kann sie im Admin-Bereich hinzufügen.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
