\"use client\";

import Link from "next/link";
import { useMemo, useState } from "react";
import { dict } from "@/translations";
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
  Scale,
  BarChart3,
} from "lucide-react";

type ToolCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  accent: "emerald" | "blue" | "admin" | "slate";
  badgeText?: string; // npr "2026 Ready" / "12 Dana" / "3 Pending"
  icon: "pds" | "vacations" | "admin" | "profile" | "rules" | "productivity" | "labor";
};

type VacationItem = {
  id: string;
  start: string;
  status: string;
};

export type DashboardClientProps = {
  appName: string;
  userFirstName: string;
  tools: ToolCard[];
  // hero stats
  vacationLeft: number;
  pdsScore: number;
  pdsStatus: string;
  pendingMine: number;
  pendingAdmin: number; // 0 ako nema admin uvid
  showAdminHeroTile: boolean;

  // activity
  recentVacations: VacationItem[];
  lastSeenLabel?: string;

  // notifications
  notificationsCount: number;

  // helpers
  formatDate: (iso: string) => string;
};

function cardIcon(icon: ToolCard["icon"]) {
  switch (icon) {
    case "pds":
      return <ClipboardCheck size={28} strokeWidth={2.5} />;
    case "vacations":
      return <Palmtree size={28} strokeWidth={2.5} />;
    case "admin":
      return <ShieldCheck size={28} strokeWidth={2.5} />;
    case "profile":
      return <UserCog size={28} strokeWidth={2.5} />;
    case "rules":
      return <Scale size={28} strokeWidth={2.5} />;
    case "productivity":
      return <BarChart3 size={28} strokeWidth={2.5} />;
    case "labor":
      return <TrendingUp size={28} strokeWidth={2.5} />;
    default:
      return <ArrowRight size={28} strokeWidth={2.5} />;
  }
}

function accentClasses(accent: ToolCard["accent"]) {
  if (accent === "admin") {
    return {
      outer: "bg-[#1a3826] p-1 rounded-[2rem] shadow-lg shadow-emerald-900/20 hover:shadow-xl hover:-translate-y-1 transition-all duration-300",
      inner: "bg-[#1a3826] rounded-[1.8rem] p-6 h-full flex flex-col justify-between border border-white/10 relative overflow-hidden",
      iconWrap: "h-14 w-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-[#FFC72C] shadow-inner group-hover:scale-110 transition-transform duration-300",
      badge: "px-3 py-1 bg-white/20 text-white text-[10px] font-black uppercase rounded-full",
      title: "text-white",
      desc: "text-emerald-100/60",
      link: "text-[#FFC72C]",
    };
  }

  if (accent === "blue") {
    return {
      outer: "group bg-white p-1 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300",
      inner: "bg-slate-50 rounded-[1.8rem] p-6 h-full flex flex-col justify-between group-hover:bg-white transition-colors border border-transparent group-hover:border-slate-100",
      iconWrap:
        "h-14 w-14 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-110 transition-transform duration-300",
      badge: "px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-black uppercase rounded-full",
      title: "text-slate-800 group-hover:text-blue-600 transition-colors",
      desc: "text-slate-400",
      link: "text-blue-600",
    };
  }

  if (accent === "emerald") {
    return {
      outer: "group bg-white p-1 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300",
      inner: "bg-slate-50 rounded-[1.8rem] p-6 h-full flex flex-col justify-between group-hover:bg-white transition-colors border border-transparent group-hover:border-slate-100",
      iconWrap:
        "h-14 w-14 bg-white rounded-2xl flex items-center justify-center text-[#1a3826] shadow-sm group-hover:scale-110 transition-transform duration-300",
      badge: "px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-full",
      title: "text-slate-800 group-hover:text-[#1a3826] transition-colors",
      desc: "text-slate-400",
      link: "text-[#1a3826]",
    };
  }

  // slate
  return {
    outer: "group bg-white p-1 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300",
    inner: "bg-slate-50 rounded-[1.8rem] p-6 h-full flex flex-col justify-between group-hover:bg-white transition-colors border border-transparent group-hover:border-slate-100",
    iconWrap:
      "h-14 w-14 bg-white rounded-2xl flex items-center justify-center text-slate-600 shadow-sm group-hover:scale-110 transition-transform duration-300",
    badge: "px-3 py-1 bg-slate-100 text-slate-700 text-[10px] font-black uppercase rounded-full",
    title: "text-slate-800 group-hover:text-slate-600 transition-colors",
    desc: "text-slate-400",
    link: "text-slate-600",
  };
}

export default function DashboardClient(props: DashboardClientProps) {
  const [toolQuery, setToolQuery] = useState("");

  const filteredTools = useMemo(() => {
    const q = toolQuery.trim().toLowerCase();
    if (!q) return props.tools;
    return props.tools.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
    );
  }, [props.tools, toolQuery]);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground flex flex-col relative z-0">
      {/* HEADER */}
      <header className="h-20 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-[#1a3826] p-2.5 rounded-xl text-white shadow-lg shadow-emerald-900/20">
            <LayoutDashboard size={22} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">{props.appName}</h2>
            <h1 className="text-lg font-black text-[#1a3826] leading-none tracking-tight">DASHBOARD</h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center bg-slate-100 rounded-xl px-4 py-2.5 border border-transparent focus-within:border-[#1a3826] focus-within:bg-white transition-all w-80">
            <Search className="w-4 h-4 text-slate-400 mr-3" />
            <input
              value={toolQuery}
              onChange={(e) => setToolQuery(e.target.value)}
              type="text"
              placeholder="Pretraži module..."
              className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 w-full placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              className="h-11 w-11 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all relative"
              title="Notifikacije"
            >
              <Bell className="w-5 h-5" />
              {props.notificationsCount > 0 && (
                <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>

            {/* signout: ostavljam istu ideju, samo dodam callbackUrl da uvijek završi na /login */}
            <Link
              href="/api/auth/signout?callbackUrl=/login"
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
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none z-[-1]"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#FFC72C]/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none z-[-1]"></div>

          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-[#FFC72C] mb-4 border border-white/10">
              <span className="w-2 h-2 rounded-full bg-[#FFC72C] animate-pulse"></span>
              {dict.dashboard_hero_chip}
            </div>

            <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 leading-tight">
              Willkommen, <span className="text-[#FFC72C]">{props.userFirstName}</span>.
            </h1>

            <p className="text-emerald-100/80 text-lg font-medium max-w-lg leading-relaxed">
              {dict.dashboard_hero_subtitle}
            </p>
          </div>

          <div className="flex gap-4 relative z-10 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl min-w-[140px] flex flex-col items-center text-center hover:bg-white/20 transition-all cursor-default">
              <span className="text-emerald-100/60 text-[10px] font-black uppercase tracking-widest mb-1">
                {dict.dashboard_tile_vacation_label}
              </span>
              <span className="text-3xl font-black text-white">{props.vacationLeft}</span>
              <span className="text-xs font-bold text-emerald-200">
                {dict.dashboard_tile_vacation_sub}
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl min-w-[140px] flex flex-col items-center text-center hover:bg-white/20 transition-all cursor-default">
              <span className="text-emerald-100/60 text-[10px] font-black uppercase tracking-widest mb-1">
                {dict.dashboard_tile_pds_label}
              </span>
              <span className="text-3xl font-black text-[#FFC72C]">{props.pdsScore}</span>
              <span className="text-xs font-bold text-emerald-200">{props.pdsStatus}</span>
            </div>

            {props.showAdminHeroTile && (
              <div className="bg-[#FFC72C] text-[#1a3826] p-5 rounded-2xl min-w-[140px] flex flex-col items-center text-center shadow-lg shadow-yellow-500/20">
                <span className="opacity-60 text-[10px] font-black uppercase tracking-widest mb-1">
                  {dict.dashboard_tile_requests_label}
                </span>
                <span className="text-3xl font-black">{props.pendingAdmin}</span>
                <span className="text-xs font-bold opacity-80">
                  {dict.dashboard_tile_requests_sub}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          <div className="xl:col-span-3 space-y-6">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <LayoutDashboard className="text-[#1a3826]" size={20} /> {dict.dashboard_section_my_tools}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTools.map((tool) => {
                const cls = accentClasses(tool.accent);

                if (tool.accent === "admin") {
                  return (
                    <Link key={tool.id} href={tool.href} className={`group ${cls.outer}`}>
                      <div className={cls.inner}>
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#FFC72C] rounded-full blur-[50px] opacity-20 group-hover:opacity-30 transition-opacity"></div>

                        <div className="flex justify-between items-start mb-6 relative z-10">
                          <div className={cls.iconWrap}>{cardIcon(tool.icon)}</div>
                          <div className={cls.badge}>{tool.badgeText || "Admin"}</div>
                        </div>

                        <div className="relative z-10">
                          <h4 className={`text-xl font-black mb-2 ${cls.title}`}>{tool.title}</h4>
                          <p className={`text-xs font-medium leading-relaxed mb-4 ${cls.desc}`}>{tool.description}</p>
                          <div className={`flex items-center gap-2 text-xs font-bold ${cls.link} group-hover:underline decoration-2 underline-offset-4`}>
                            Upravljaj <ArrowRight size={14} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                }

                return (
                  <Link key={tool.id} href={tool.href} className={`group ${cls.outer}`}>
                    <div className={cls.inner}>
                      <div className="flex justify-between items-start mb-6">
                        <div className={cls.iconWrap}>{cardIcon(tool.icon)}</div>
                        {tool.badgeText ? <div className={cls.badge}>{tool.badgeText}</div> : <div />}
                      </div>

                      <div>
                        <h4 className={`text-xl font-black mb-2 ${cls.title}`}>{tool.title}</h4>
                        <p className={`text-xs font-medium leading-relaxed mb-4 ${cls.desc}`}>{tool.description}</p>
                        <div className={`flex items-center gap-2 text-xs font-bold ${cls.link} group-hover:underline decoration-2 underline-offset-4`}>
                          Otvori alat <ArrowRight size={14} />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* ACTIVITY */}
          <div className="xl:col-span-1 space-y-6">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <TrendingUp className="text-blue-500" size={20} /> AKTIVNOSTI
            </h3>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 h-fit">
              <div className="space-y-6">
                {/* PDS */}
                <div className="flex gap-4 relative">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-[#1a3826]"></div>
                    <div className="w-px h-full bg-slate-100 my-1"></div>
                  </div>
                  <div className="pb-2">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">PDS Evaluacija</p>
                    <p className="text-sm font-bold text-slate-800">{props.pdsStatus}</p>
                    <span className="text-[10px] font-bold text-[#1a3826] bg-emerald-50 px-2 py-0.5 rounded mt-2 inline-block">
                      {props.pdsScore} Bodova
                    </span>
                  </div>
                </div>

                {/* Last seen (iz baze) */}
                {props.lastSeenLabel && (
                  <div className="flex gap-4 relative">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-slate-300"></div>
                      <div className="w-px h-full bg-slate-100 my-1"></div>
                    </div>
                    <div className="pb-2">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">Profil</p>
                      <p className="text-sm font-bold text-slate-800">Zadnja aktivnost</p>
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded mt-2 inline-block">
                        {props.lastSeenLabel}
                      </span>
                    </div>
                  </div>
                )}

                {/* Vacations */}
                {props.recentVacations.map((vac, idx) => (
                  <div key={vac.id} className="flex gap-4 relative">
                    <div className="flex flex-col items-center">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          vac.status === "APPROVED" ? "bg-green-500" : vac.status === "REJECTED" ? "bg-red-500" : "bg-orange-400"
                        }`}
                      ></div>
                      <div className={`w-px h-full bg-slate-100 my-1 ${idx === props.recentVacations.length - 1 ? "hidden" : ""}`}></div>
                    </div>

                    <div className="pb-2">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">Zahtjev za odmor</p>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar size={12} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-600">{props.formatDate(vac.start)}</span>
                      </div>
                      <p
                        className={`text-xs font-black uppercase ${
                          vac.status === "APPROVED" ? "text-green-600" : vac.status === "REJECTED" ? "text-red-500" : "text-orange-500"
                        }`}
                      >
                        {vac.status}
                      </p>
                    </div>
                  </div>
                ))}

                {props.recentVacations.length === 0 && (
                  <div className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                    Derzeit keine Aktivitäten für Jahresurlaub.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
