import { tryRequirePermission } from "@/lib/access";
import Link from "next/link";
import { Users, Building2, ShieldCheck, BookOpen, LayoutDashboard, ClipboardList, FileText, CalendarDays, Lightbulb } from "lucide-react";
import NoPermission from "@/components/NoPermission";
import { getUnreadIdeasCount } from "@/app/actions/ideaActions";

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

  const cards = [
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
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter">
              VERWALTUNG
            </h1>
            <p className="text-muted-foreground text-xs font-semibold mt-0.5">
              Benutzer, Standorte und Zugriffsrechte verwalten
            </p>
          </div>

          <div className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card border border-border">
              <ShieldCheck size={14} className="text-[#1a3826] dark:text-[#FFC72C]" />
              Globale Berechtigungen
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {cards.map((c) => {
            const Icon = c.icon;
            const badge = "badge" in c && typeof (c as { badge?: number }).badge === "number" ? (c as { badge: number }).badge : 0;
            return (
              <Link
                key={c.href}
                href={c.href}
                className="group relative bg-card rounded-xl border border-border shadow-sm hover:shadow-md hover:border-[#1a3826]/30 dark:hover:border-[#FFC72C]/30 transition-all p-4"
              >
                {badge > 0 && (
                  <span className="absolute top-3 right-3 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-black flex items-center justify-center">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="h-9 w-9 rounded-lg bg-[#1a3826]/10 dark:bg-[#FFC72C]/20 text-[#1a3826] dark:text-[#FFC72C] flex items-center justify-center shrink-0">
                    <Icon size={18} />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground bg-muted/80 border border-border px-2 py-1 rounded-md truncate max-w-[100px]">
                    {c.tag}
                  </span>
                </div>

                <div className="mt-3">
                  <h2 className="text-base font-bold text-card-foreground group-hover:text-[#1a3826] dark:group-hover:text-[#FFC72C] transition-colors line-clamp-1">
                    {c.title}
                  </h2>
                  <p className="text-xs text-muted-foreground font-medium mt-1 leading-snug line-clamp-2">
                    {c.desc}
                  </p>
                </div>

                <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[#1a3826] dark:text-[#FFC72C]">
                  Öffnen →
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
