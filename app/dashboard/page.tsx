// app/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import Link from "next/link";
import {
  Search,
  Bell,
  ArrowRight,
  ClipboardCheck,
  Palmtree,
  ShieldCheck,
  UserCog,
  LayoutDashboard,
  TrendingUp,
  Calendar,
  LogOut,
  Users,
  Settings2,
  Shapes,
  BookOpenCheck,
  Sparkles,
} from "lucide-react";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat("bs-BA", { day: "numeric", month: "short" }).format(date);
};

const ADMIN_ROLES = new Set<Role>([
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.SYSTEM_ARCHITECT,
  Role.MANAGER,
]);

function statusDotClass(status: string) {
  if (status === "APPROVED") return "bg-green-500";
  if (status === "REJECTED") return "bg-red-500";
  return "bg-orange-400";
}

function statusTextClass(status: string) {
  if (status === "APPROVED") return "text-green-600";
  if (status === "REJECTED") return "text-red-500";
  return "text-orange-500";
}

// Small util: permission OR admin
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
  permissionKey?: string; // npr "vacation:access"
  badge?: (ctx: {
    isAdmin: boolean;
    vacationLeft: number;
    pendingMine: number;
    totalPendingAdmin: number;
    pdsScore: number;
    pdsStatus: string;
  }) => string | null;
  icon: any;
  accent:
    | "emerald"
    | "blue"
    | "slate"
    | "yellow"
    | "neutral";
  variant?: "default" | "admin";
};

// ✅ Centralna lista modula (jedno mjesto, sve ostalo se računa)
const TOOLS: ToolDef[] = [
  {
    id: "rules",
    title: "Pravila",
    href: "/tools/rules",
    category: "operations",
    permissionKey: "rules:access",
    icon: BookOpenCheck,
    accent: "emerald",
    badge: () => "CMS",
  },
  {
    id: "pds",
    title: "PDS Sistem",
    href: "/tools/PDS",
    category: "staff",
    // ako nemaš pds:access u listi permisija, ostavi undefined pa će biti dostupno svima
    // ili ubaci u permissions.ts pa ovdje stavi "pds:access"
    permissionKey: "pds:access",
    icon: ClipboardCheck,
    accent: "emerald",
    badge: ({ pdsScore }) => `${pdsScore} bod`,
  },
  {
    id: "vacations",
    title: "Godišnji odmori",
    href: "/tools/vacations",
    category: "staff",
    permissionKey: "vacation:access",
    icon: Palmtree,
    accent: "blue",
    badge: ({ vacationLeft }) => `${vacationLeft} dana`,
  },
  {
    id: "admin",
    title: "Admin panel",
    href: "/admin",
    category: "other",
    // admin pristup je preko role ili preko users/restaurants access — ti već imaš te permisije
    permissionKey: "users:access",
    icon: ShieldCheck,
    accent: "yellow",
    variant: "admin",
    badge: ({ isAdmin, totalPendingAdmin }) => (isAdmin ? `${totalPendingAdmin} pending` : null),
  },
  {
    id: "profile",
    title: "Moj profil",
    href: "/profile",
    category: "other",
    icon: UserCog,
    accent: "slate",
  },

  // 🔥 Dodaj kasnije ovdje nove module: productivity, labor planner, file manager…
  // samo ubaci permissionKey + href + category i automatski će se pojaviti tamo gdje treba.
];

function accentClasses(accent: ToolDef["accent"]) {
  switch (accent) {
    case "emerald":
      return {
        iconText: "text-[#1a3826]",
        badgeBg: "bg-emerald-100 text-emerald-700",
        linkText: "text-[#1a3826]",
        hoverTitle: "group-hover:text-[#1a3826]",
      };
    case "blue":
      return {
        iconText: "text-blue-600",
        badgeBg: "bg-blue-100 text-blue-700",
        linkText: "text-blue-600",
        hoverTitle: "group-hover:text-blue-600",
      };
    case "yellow":
      return {
        iconText: "text-[#FFC72C]",
        badgeBg: "bg-white/20 text-white",
        linkText: "text-[#FFC72C]",
        hoverTitle: "group-hover:text-white",
      };
    case "slate":
      return {
        iconText: "text-slate-600",
        badgeBg: "bg-slate-100 text-slate-700",
        linkText: "text-slate-600",
        hoverTitle: "group-hover:text-slate-600",
      };
    default:
      return {
        iconText: "text-slate-700",
        badgeBg: "bg-slate-100 text-slate-700",
        linkText: "text-slate-700",
        hoverTitle: "group-hover:text-slate-700",
      };
  }
}

function CategoryCard({
  href,
  title,
  subtitle,
  count,
  icon: Icon,
  accent,
}: {
  href: string;
  title: string;
  subtitle: string;
  count: number;
  icon: any;
  accent: "emerald" | "blue" | "amber";
}) {
  const glow =
    accent === "emerald"
      ? "bg-emerald-500/10"
      : accent === "blue"
      ? "bg-blue-500/10"
      : "bg-amber-500/10";

  const iconText =
    accent === "emerald"
      ? "text-emerald-700"
      : accent === "blue"
      ? "text-blue-600"
      : "text-amber-700";

  const badgeBg =
    accent === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : accent === "blue"
      ? "bg-blue-100 text-blue-700"
      : "bg-amber-100 text-amber-800";

  const titleHover =
    accent === "emerald"
      ? "group-hover:text-emerald-700"
      : accent === "blue"
      ? "group-hover:text-blue-600"
      : "group-hover:text-amber-700";

  return (
    <Link
      href={href}
      className="group bg-white p-1 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
    >
      <div className="bg-slate-50 rounded-[1.8rem] p-6 h-full border border-transparent group-hover:border-slate-100 group-hover:bg-white transition-colors relative overflow-hidden">
        <div className={`absolute -right-10 -top-10 w-40 h-40 ${glow} rounded-full blur-3xl`} />
        <div className="flex items-start justify-between mb-6 relative z-10">
          <div
            className={`h-14 w-14 bg-white rounded-2xl flex items-center justify-center ${iconText} shadow-sm group-hover:scale-110 transition-transform duration-300`}
          >
            <Icon size={28} strokeWidth={2.5} />
          </div>
          <span className={`px-3 py-1 ${badgeBg} text-[10px] font-black uppercase rounded-full`}>
            {count} modula
          </span>
        </div>

        <h4 className={`text-xl font-black text-slate-800 mb-2 transition-colors relative z-10 ${titleHover}`}>
          {title}
        </h4>
        <p className="text-xs font-medium text-slate-400 leading-relaxed mb-4 relative z-10">{subtitle}</p>
        <div className={`flex items-center gap-2 text-xs font-bold ${iconText} group-hover:underline decoration-2 underline-offset-4 relative z-10`}>
          Otvori <ArrowRight size={14} />
        </div>
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userSession = session.user as any;
  const userId = userSession.id as string | undefined;
  if (!userId) redirect("/login");

  const userRole = (userSession.role as Role | undefined) ?? undefined;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      vacations: { orderBy: { createdAt: "desc" }, take: 3 },
      pdsList: { where: { year: new Date().getFullYear() + 1 }, take: 1 },
    },
  });

  if (!dbUser) redirect("/login");

  const effectiveRole: Role = (userRole ?? dbUser.role) as Role;
  const isAdmin = ADMIN_ROLES.has(effectiveRole);

  const totalPendingAdmin = isAdmin
    ? await prisma.vacationRequest.count({ where: { status: "PENDING" } })
    : 0;

  const perms = dbUser.permissions || [];

  const currentPDS = dbUser.pdsList?.[0];
  const pdsScore = currentPDS ? currentPDS.totalScore : 0;
  const pdsStatus = currentPDS ? currentPDS.status : "Nije započeto";

  const totalVacation = (dbUser.vacationEntitlement || 0) + (dbUser.vacationCarryover || 0);
  const usedVacation = (dbUser.vacations || [])
    .filter((v) => v.status === "APPROVED")
    .reduce((acc, v) => acc + v.days, 0);
  const vacationLeft = totalVacation - usedVacation;

  const pendingMine = (dbUser.vacations || []).filter((v) => v.status === "PENDING").length;

  const ctx = { isAdmin, vacationLeft, pendingMine, totalPendingAdmin, pdsScore, pdsStatus };

  // ✅ Tools visible to this user
  const visibleTools = TOOLS.filter((t) => canAccess(isAdmin, perms, t.permissionKey));

  // ✅ Category counts (only what user can actually access)
  const staffCount = visibleTools.filter((t) => t.category === "staff").length;
  const operationsCount = visibleTools.filter((t) => t.category === "operations").length;
  const otherCount = visibleTools.filter((t) => t.category === "other").length;

  const userFirstName = (dbUser.name || "Korisnik").split(" ")[0];

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 flex flex-col relative z-0">
      {/* HEADER */}
      <header className="h-20 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-[#1a3826] p-2.5 rounded-xl text-white shadow-lg shadow-emerald-900/20">
            <LayoutDashboard size={22} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">AIW Service</h2>
            <h1 className="text-lg font-black text-[#1a3826] leading-none tracking-tight">DASHBOARD</h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center bg-slate-100 rounded-xl px-4 py-2.5 border border-transparent focus-within:border-[#1a3826] focus-within:bg-white transition-all w-80">
            <Search className="w-4 h-4 text-slate-400 mr-3" />
            <input
              type="text"
              placeholder="Pretraži..."
              className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 w-full placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-3">
            <button className="h-11 w-11 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>

            <Link
              href="/api/auth/signout"
              className="h-11 w-11 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all"
              title="Odjava"
            >
              <LogOut className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 p-6 md:p-10 max-w-[1600px] mx-auto w-full space-y-10 relative z-0">
        {/* HERO */}
        <div className="relative overflow-hidden bg-[#1a3826] rounded-[2.5rem] p-10 md:p-12 shadow-2xl shadow-emerald-900/30 text-white flex flex-col md:flex-row justify-between items-center gap-8 z-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none z-[-1]" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#FFC72C]/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none z-[-1]" />

          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-[#FFC72C] mb-4 border border-white/10">
              <Sparkles className="w-4 h-4" />
              Sistem aktivan
            </div>

            <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 leading-tight">
              Dobrodošao, <span className="text-[#FFC72C]">{userFirstName}</span>.
            </h1>

            <p className="text-emerald-100/80 text-lg font-medium max-w-lg leading-relaxed">
              Imate <strong className="text-white">{pendingMine}</strong> zahtjeva na čekanju i trenutni PDS skor{" "}
              <strong className="text-white">{pdsScore}</strong>.
            </p>
          </div>

          <div className="flex gap-4 relative z-10 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl min-w-[140px] flex flex-col items-center text-center hover:bg-white/20 transition-all cursor-default">
              <span className="text-emerald-100/60 text-[10px] font-black uppercase tracking-widest mb-1">Godišnji</span>
              <span className="text-3xl font-black text-white">{vacationLeft}</span>
              <span className="text-xs font-bold text-emerald-200">Dana ostalo</span>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl min-w-[140px] flex flex-col items-center text-center hover:bg-white/20 transition-all cursor-default">
              <span className="text-emerald-100/60 text-[10px] font-black uppercase tracking-widest mb-1">PDS Skor</span>
              <span className="text-3xl font-black text-[#FFC72C]">{pdsScore}</span>
              <span className="text-xs font-bold text-emerald-200">{pdsStatus}</span>
            </div>

            {isAdmin && (
              <div className="bg-[#FFC72C] text-[#1a3826] p-5 rounded-2xl min-w-[140px] flex flex-col items-center text-center shadow-lg shadow-yellow-500/20">
                <span className="opacity-60 text-[10px] font-black uppercase tracking-widest mb-1">Zahtjevi</span>
                <span className="text-3xl font-black">{totalPendingAdmin}</span>
                <span className="text-xs font-bold opacity-80">Na čekanju</span>
              </div>
            )}
          </div>
        </div>

        {/* TOOLS + ACTIVITY */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* LEFT */}
          <div className="xl:col-span-3 space-y-6">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <LayoutDashboard className="text-[#1a3826]" size={20} /> MOJI ALATI
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleTools.map((tool) => {
                const Icon = tool.icon;
                const a = accentClasses(tool.accent);
                const badgeText = tool.badge ? tool.badge(ctx) : null;

                // Admin kartica ima poseban “wow” skin
                if (tool.variant === "admin") {
                  return (
                    <Link
                      key={tool.id}
                      href={tool.href}
                      className="group bg-[#1a3826] p-1 rounded-[2rem] shadow-lg shadow-emerald-900/20 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                    >
                      <div className="bg-[#1a3826] rounded-[1.8rem] p-6 h-full flex flex-col justify-between border border-white/10 relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#FFC72C] rounded-full blur-[50px] opacity-20 group-hover:opacity-30 transition-opacity" />
                        <div className="flex justify-between items-start mb-6 relative z-10">
                          <div className="h-14 w-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-[#FFC72C] shadow-inner group-hover:scale-110 transition-transform duration-300">
                            <Icon size={28} strokeWidth={2.5} />
                          </div>
                          {badgeText && (
                            <div className="px-3 py-1 bg-white/20 text-white text-[10px] font-black uppercase rounded-full">
                              {badgeText}
                            </div>
                          )}
                        </div>
                        <div className="relative z-10">
                          <h4 className="text-xl font-black text-white mb-2">{tool.title}</h4>
                          <div className="flex items-center gap-2 text-xs font-bold text-[#FFC72C] group-hover:underline decoration-2 underline-offset-4">
                            Upravljaj <ArrowRight size={14} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                }

                return (
                  <Link
                    key={tool.id}
                    href={tool.href}
                    className="group bg-white p-1 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="bg-slate-50 rounded-[1.8rem] p-6 h-full flex flex-col justify-between group-hover:bg-white transition-colors border border-transparent group-hover:border-slate-100">
                      <div className="flex justify-between items-start mb-6">
                        <div className={`h-14 w-14 bg-white rounded-2xl flex items-center justify-center ${a.iconText} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                          <Icon size={28} strokeWidth={2.5} />
                        </div>
                        {badgeText && (
                          <div className={`px-3 py-1 ${a.badgeBg} text-[10px] font-black uppercase rounded-full`}>
                            {badgeText}
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className={`text-xl font-black text-slate-800 mb-2 transition-colors ${a.hoverTitle}`}>
                          {tool.title}
                        </h4>
                        <div className={`flex items-center gap-2 text-xs font-bold ${a.linkText} group-hover:underline decoration-2 underline-offset-4`}>
                          Otvori <ArrowRight size={14} />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* KATEGORIJE (sa brojem dostupnih modula) */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Shapes className="text-[#1a3826]" size={20} /> KATEGORIJE
                </h3>
                <div className="text-xs font-semibold text-slate-400">Tools</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <CategoryCard
                  href="/tools/categories/staff"
                  title="Staff"
                  subtitle="People & HR"
                  count={staffCount}
                  icon={Users}
                  accent="emerald"
                />
                <CategoryCard
                  href="/tools/categories/operations"
                  title="Operations"
                  subtitle="Daily ops"
                  count={operationsCount}
                  icon={Settings2}
                  accent="blue"
                />
                <CategoryCard
                  href="/tools/categories/other"
                  title="Other"
                  subtitle="Utilities"
                  count={otherCount}
                  icon={Shapes}
                  accent="amber"
                />
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="xl:col-span-1 space-y-6">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <TrendingUp className="text-blue-500" size={20} /> AKTIVNOSTI
            </h3>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 h-fit">
              <div className="space-y-6">
                <div className="flex gap-4 relative">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-[#1a3826]" />
                    <div className="w-px h-full bg-slate-100 my-1" />
                  </div>
                  <div className="pb-2">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">PDS</p>
                    <p className="text-sm font-bold text-slate-800">{pdsStatus}</p>
                    <span className="text-[10px] font-bold text-[#1a3826] bg-emerald-50 px-2 py-0.5 rounded mt-2 inline-block">
                      {pdsScore} bodova
                    </span>
                  </div>
                </div>

                {(dbUser.vacations || []).map((vac) => (
                  <div key={vac.id} className="flex gap-4 relative">
                    <div className="flex flex-col items-center">
                      <div className={`h-2 w-2 rounded-full ${statusDotClass(vac.status)}`} />
                      <div className="w-px h-full bg-slate-100 my-1 last:hidden" />
                    </div>

                    <div className="pb-2">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">Zahtjev za odmor</p>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar size={12} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-600">{formatDate(new Date(vac.start))}</span>
                      </div>
                      <p className={`text-xs font-black uppercase ${statusTextClass(vac.status)}`}>{vac.status}</p>
                    </div>
                  </div>
                ))}

                {(dbUser.vacations || []).length === 0 && (
                  <div className="text-xs font-semibold text-slate-400">Nema aktivnosti.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
