import { tryRequirePermission } from "@/lib/access";
import Link from "next/link";
import {
  Users,
  Building2,
  ShieldCheck,
  BookOpen,
  LayoutDashboard,
  ClipboardList,
  FileText,
  CalendarDays,
  Lightbulb,
  LucideIcon,
} from "lucide-react";
import NoPermission from "@/components/NoPermission";
import { getUnreadIdeasCount } from "@/app/actions/ideaActions";

type AdminCard = {
  title: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  tag: string;
  badge?: number;
};

const TAG_STYLES: Record<string, string> = {
  "Users & RBAC":
    "from-emerald-500/18 via-emerald-500/8 to-emerald-500/8 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-500/40",
  Locations:
    "from-sky-500/18 via-sky-500/8 to-sky-500/8 text-sky-700 dark:text-sky-300 border-sky-200/60 dark:border-sky-500/40",
  Dashboard:
    "from-indigo-500/18 via-indigo-500/8 to-indigo-500/8 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-500/40",
  Bedienungsanleitungen:
    "from-amber-500/18 via-amber-500/8 to-amber-500/8 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-500/40",
  PDS:
    "from-violet-500/18 via-violet-500/8 to-violet-500/8 text-violet-700 dark:text-violet-300 border-violet-200/60 dark:border-violet-500/40",
  Partner:
    "from-rose-500/18 via-rose-500/8 to-rose-500/8 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-500/40",
  Feiertage:
    "from-orange-500/18 via-orange-500/8 to-orange-500/8 text-orange-700 dark:text-orange-300 border-orange-200/60 dark:border-orange-500/40",
  Ideenbox:
    "from-yellow-500/20 via-yellow-500/10 to-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-200/70 dark:border-yellow-500/40",
};

export default async function AdminHome() {
  const usersAccess = await tryRequirePermission("users:access");
  const restaurantsAccess = usersAccess.ok ? usersAccess : await tryRequirePermission("restaurants:access");
  const rulesAccess = await tryRequirePermission("rules:access");
  const pdsAccess = await tryRequirePermission("pds:access");
  const partnersAccess = await tryRequirePermission("partners:manage");
  const holidaysAccess = await tryRequirePermission("holidays:manage");
  const ideenboxAccess = await tryRequirePermission("ideenbox:access");

  const hasAnyAdminAccess = usersAccess.ok || restaurantsAccess.ok || rulesAccess.ok || pdsAccess.ok || partnersAccess.ok || holidaysAccess.ok || ideenboxAccess.ok;
  if (!hasAnyAdminAccess) {
    return <NoPermission moduleName="Verwaltung" />;
  }

  const ideenboxUnreadCount = ideenboxAccess.ok ? await getUnreadIdeasCount() : 0;

  const cards: AdminCard[] = [
    {
      title: "Benutzer & Teams",
      desc: "Benutzerliste, Anlegen, Zuweisung von Restaurants und Berechtigungen, Rollenkonfiguration.",
      href: "/admin/users",
      icon: Users,
      tag: "Users & RBAC",
    },
    {
      title: "Standortverwaltung",
      desc: "Standorte anlegen, bearbeiten und Status (aktiv/inaktiv).",
      href: "/admin/restaurants",
      icon: Building2,
      tag: "Locations",
    },
    ...(usersAccess.ok
      ? [
          {
            title: "Dashboard-Module",
            desc: "Festlegen, welche Module Nutzern auf der Startseite angezeigt werden.",
            href: "/admin/dashboard-modules",
            icon: LayoutDashboard,
            tag: "Dashboard",
          },
          {
            title: "Aktuelle Änderungen",
            desc: "Text für die Startseite: Was wurde umgesetzt? Nur Sie (System Architect) können bearbeiten.",
            href: "/admin/dashboard-text",
            icon: FileText,
            tag: "Dashboard",
          },
        ]
      : []),
    ...(rulesAccess.ok
      ? [
          {
            title: "Bedienungsanleitungen",
            desc: "Verwaltung von Bedienungsanleitungen, Kategorien, Lese-Statistik, Bearbeiten und Löschen.",
            href: "/admin/rules",
            icon: BookOpen,
            tag: "Bedienungsanleitungen",
          },
        ]
      : []),
    ...(pdsAccess.ok
      ? [
          {
            title: "Beurteilungsvorlagen",
            desc: "PDS-Vorlagen für ein, mehrere oder alle Restaurants erstellen und verwalten.",
            href: "/admin/pds",
            icon: ClipboardList,
            tag: "PDS",
          },
        ]
      : []),
    ...(partnersAccess.ok
      ? [
          {
            title: "Firmen und Partner",
            desc: "Verwaltung von Partnerunternehmen und wichtigen Kontakten.",
            href: "/admin/partners",
            icon: Building2,
            tag: "Partner",
          },
        ]
      : []),
    ...(holidaysAccess.ok
      ? [
          {
            title: "Feiertage",
            desc: "Globale Feiertage für Arbeitsplaner und andere Module verwalten.",
            href: "/admin/holidays",
            icon: CalendarDays,
            tag: "Feiertage",
          },
        ]
      : []),
    ...(ideenboxAccess.ok
      ? [
          {
            title: "Ideenbox",
            desc: "Vorschläge von Mitarbeitern lesen und als gelesen markieren.",
            href: "/admin/ideenbox",
            icon: Lightbulb,
            tag: "Ideenbox",
            badge: ideenboxUnreadCount,
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8 font-sans text-foreground">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* HEADER – unificirani layout */}
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-6">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter mb-2">
              ADMIN <span className="text-[#FFC72C]">PANEL</span>
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              Benutzer, Standorte und Zugriffsrechte verwalten.
            </p>
          </div>

          <div className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card border border-border">
              <ShieldCheck size={14} className="text-[#1a3826] dark:text-[#FFC72C]" />
              Globale Berechtigungen
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
          {cards.map((c) => {
            const Icon = c.icon;
            const badge = typeof c.badge === "number" ? c.badge : 0;
            const style =
              TAG_STYLES[c.tag] ??
              "from-[#1a3826]/12 via-[#1a3826]/8 to-[#1a3826]/5 text-[#1a3826] dark:text-[#FFC72C] border-border";

            return (
              <Link
                key={c.href}
                href={c.href}
                className="group relative flex flex-col items-stretch justify-between gap-4 p-5 rounded-2xl border border-border bg-card shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-300"
              >
                {badge > 0 && (
                  <span className="absolute top-3 right-3 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-sm">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <div
                    className={`h-12 w-12 rounded-2xl border bg-gradient-to-br flex items-center justify-center ${style}`}
                  >
                    <Icon size={24} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-bold text-card-foreground group-hover:text-[#1a3826] dark:group-hover:text-[#FFC72C] transition-colors truncate">
                        {c.title}
                      </h2>
                      <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground bg-muted/80 border border-border px-2 py-0.5 rounded-md shrink-0">
                        {c.tag}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-snug line-clamp-2">
                      {c.desc}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Öffnen</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
