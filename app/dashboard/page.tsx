import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Bell, ChevronRight, FileText, Sparkles, CalendarDays } from "lucide-react";
import { formatDateDDMMGGGG } from "@/lib/dateUtils";
import QuickActionsCard from "@/components/dashboard/QuickActionsCard";
import LiveStatusCard from "@/components/dashboard/LiveStatusCard";
import DashboardModuleIcons from "@/components/dashboard/DashboardModuleIcons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllowedQuickActions } from "@/lib/dashboard";
import { getDashboardHighlights } from "@/app/actions/dashboardHighlightActions";

export const dynamic = "force-dynamic";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Dobro jutro";
  if (h >= 12 && h < 18) return "Dobro dan";
  return "Willkommen zurück"; // austrijski njemački: Dobro došli nazad
}

async function getRecentRules(): Promise<{ id: string; title: string; createdAt: Date }[]> {
  try {
    const rules = await prisma.rule.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, title: true, createdAt: true },
    });
    return rules;
  } catch {
    return [];
  }
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

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, role: true, permissions: true },
  });
  if (!dbUser) redirect("/login");

  const [recentRules, highlights, vacationSummary] = await Promise.all([
    getRecentRules(),
    getDashboardHighlights(),
    getVacationDaysSummary(dbUser.id),
  ]);

  const quickActions = getAllowedQuickActions(
    String(dbUser.role),
    dbUser.permissions ?? []
  );
  const greeting = getGreeting();
  const firstName = (dbUser.name || (session.user as { name?: string }).name || "Korisnik").split(" ")[0];
  const roleLabel = String(dbUser.role || "CREW");

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-800">
      <header className="bg-[#1a3826] text-white">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
          <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-[#1a3826]">
            <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full blur-3xl -mr-24 -mt-24" />
            <div className="absolute bottom-0 left-0 w-56 h-56 bg-[#FFC72C]/10 rounded-full blur-3xl -ml-20 -mb-20" />
            <div className="relative z-10 flex flex-col gap-4 pr-2">
              <div className="min-w-0 pl-1">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
                  {greeting},{" "}
                  <span className="text-[#FFC72C]">{firstName}</span>
                  <span className="ml-3 inline-flex items-center align-middle">
                    <span className="rounded-lg bg-[#FFC72C] px-3 py-1 text-sm font-bold text-[#1a3826] shadow-sm">
                      {roleLabel}
                    </span>
                  </span>
                </h1>
                <p className="mt-3 text-base font-medium text-emerald-100/90 pl-4 md:pl-5">
                  Operativni pregled i brzi pristup modulima.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Godišnji odmor – gore, prva kartica */}
          <div className="lg:col-span-4">
            <Card className="border-slate-200 bg-white shadow-sm rounded-xl overflow-hidden h-full">
              <CardHeader className="pb-2 px-6">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CalendarDays size={18} className="text-[#1a3826]" />
                  Godišnji odmor
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-0">
                {vacationSummary ? (
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="text-2xl font-black text-[#1a3826] tabular-nums">
                      {vacationSummary.remaining} <span className="text-sm font-semibold text-slate-600">dana preostalo</span>
                    </span>
                    <span className="text-sm text-slate-500">
                      (ukupno {vacationSummary.total}, iskorišteno {vacationSummary.used})
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Podaci nisu dostupni.</p>
                )}
                <Link
                  href="/tools/vacations"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#1a3826] hover:underline"
                >
                  Otvori godišnje <ChevronRight size={14} />
                </Link>
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-8">
            <QuickActionsCard actions={quickActions} />
          </div>
          <div className="lg:col-span-4">
            <LiveStatusCard />
          </div>
          {/* Moduli dodani iz admin panela – kao ikonice (mjesto gdje su bili zahtjevi) */}
          <div className="lg:col-span-8">
            <Card className="border-slate-200 bg-white shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="pb-2 px-6">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles size={18} className="text-[#FFC72C]" />
                  Moduli na stranici
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-0">
                {highlights.length > 0 ? (
                  <DashboardModuleIcons highlights={highlights} />
                ) : (
                  <p className="text-sm text-slate-500 py-2">Nema dodanih modula. Admin ih može dodati u Admin panelu.</p>
                )}
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-12">
            <Card className="border-slate-200 bg-white shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="pb-2 px-6">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Bell size={18} className="text-[#1a3826]" />
                  Obavijesti / Pravila
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-0">
                {recentRules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                    <FileText size={40} className="text-slate-300 mb-3" />
                    <p className="text-sm font-semibold text-slate-500">Nema novih obavijesti</p>
                    <p className="text-xs text-slate-400 mt-1">Ovdje će se prikazivati zadnja pravila i obavijesti.</p>
                    <Link
                      href="/tools/rules"
                      className="mt-4 text-sm font-bold text-[#1a3826] hover:underline inline-flex items-center gap-1"
                    >
                      Otvori Pravila <ChevronRight size={14} />
                    </Link>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {recentRules.map((rule) => (
                      <li key={rule.id}>
                        <Link
                          href={`/tools/rules/${rule.id}`}
                          className="flex items-center justify-between gap-4 p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-[#1a3826]/5 hover:border-[#1a3826]/20 transition-colors group"
                        >
                          <span className="text-sm font-semibold text-slate-800 group-hover:text-[#1a3826] truncate">
                            {rule.title}
                          </span>
                          <span className="text-xs font-medium text-slate-500 shrink-0">
                            {formatDateDDMMGGGG(rule.createdAt)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
