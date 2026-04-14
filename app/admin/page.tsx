import { tryRequirePermission } from "@/lib/access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { canEditDashboardChangelog } from "@/lib/permissions";
import {
  Users,
  Building2,
  ShieldCheck,
  BookOpen,
  ClipboardList,
  FileText,
  FileCheck,
  CalendarDays,
  Lightbulb,
  FolderOpen,
  Map,
  UserRound,
  Store,
  Wallet,
  Layers,
  Newspaper,
  GraduationCap,
  TrendingUp,
  Info,
} from "lucide-react";
import { getUnreadIdeasCount } from "@/app/actions/ideaActions";
import { AdminHomeCategories } from "@/components/admin/AdminHomeCategories";
import type { AdminCard, AdminCategoryBlock } from "@/components/admin/adminHomeTypes";

export default async function AdminHome() {
  const usersAccess = await tryRequirePermission("users:access");
  const restaurantsAccess = usersAccess.ok ? usersAccess : await tryRequirePermission("restaurants:access");
  const rulesAccess = await tryRequirePermission("rules:access");
  const pdsAccess = await tryRequirePermission("pds:access");
  const partnersAccess = await tryRequirePermission("partners:manage");
  const holidaysAccess = await tryRequirePermission("holidays:manage");
  const ideenboxAccess = await tryRequirePermission("ideenbox:access");
  const vorlagenAccess = await tryRequirePermission("vorlagen:manage");
  const informationAccess = await tryRequirePermission("information:manage");
  const besuchsberichteAccess = await tryRequirePermission("besuchsberichte:manage");
  const dashboardNewsAccess = await tryRequirePermission("dashboard_news:manage");
  const dashboardEventsAccess = await tryRequirePermission("dashboard_events:manage");
  const dashboardDocsAccess = await tryRequirePermission("dashboard_docs:manage");
  const trainingManageAccess = await tryRequirePermission("training:manage");
  const clAnalyseAccess = await tryRequirePermission("labor:access");

  const session = await getServerSession(authOptions);
  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  const sessionPerms = (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];
  const showDashboardChangelogCard = canEditDashboardChangelog(sessionRole, sessionPerms);

  const ideenboxUnreadCount = ideenboxAccess.ok ? await getUnreadIdeasCount() : 0;

  const personalCards: AdminCard[] = [
    ...(usersAccess.ok
      ? [
          {
            title: "Benutzer & Teams",
            desc: "Benutzerliste, Anlegen, Zuweisung von Restaurants und Berechtigungen, Rollenkonfiguration.",
            href: "/admin/users",
            icon: Users,
            tag: "Users & RBAC",
          } satisfies AdminCard,
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
          } satisfies AdminCard,
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
          } satisfies AdminCard,
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
          } satisfies AdminCard,
        ]
      : []),
  ];

  const restaurantCards: AdminCard[] = [
    ...(restaurantsAccess.ok
      ? [
          {
            title: "Standortverwaltung",
            desc: "Standorte anlegen, bearbeiten und Status (aktiv/inaktiv).",
            href: "/admin/restaurants",
            icon: Building2,
            tag: "Locations",
          } satisfies AdminCard,
          {
            title: "Sitzplan",
            desc: "PDF-Layouts (Pläne) pro Restaurant hochladen und verwalten.",
            href: "/admin/sitzplan",
            icon: Map,
            tag: "Locations",
          } satisfies AdminCard,
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
          } satisfies AdminCard,
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
          } satisfies AdminCard,
        ]
      : []),
    ...(vorlagenAccess.ok
      ? [
          {
            title: "Vorlagen",
            desc: "Offizielle Dokumente und Formulare hochladen und verwalten.",
            href: "/admin/vorlagen",
            icon: FolderOpen,
            tag: "Vorlagen",
          } satisfies AdminCard,
        ]
      : []),
    ...(informationAccess.ok
      ? [
          {
            title: "Informationen",
            desc: "Interne Informationsdokumente (Dresscode, Richtlinien) hochladen und verwalten.",
            href: "/admin/informationen",
            icon: Info,
            tag: "Informationen",
          } satisfies AdminCard,
        ]
      : []),
    ...(besuchsberichteAccess.ok
      ? [
          {
            title: "Besuchsberichte",
            desc: "Kategorien und Dokumente pro Standort, nach Jahr.",
            href: "/admin/besuchsberichte",
            icon: FileCheck,
            tag: "Besuchsberichte",
          } satisfies AdminCard,
        ]
      : []),
  ];

  const otherCards: AdminCard[] = [
    ...(showDashboardChangelogCard
      ? [
          {
            title: "Aktuelle Änderungen",
            desc: "Text für die Startseite: Was wurde umgesetzt? Bearbeitbar durch Admin, Super Admin und System Architect.",
            href: "/admin/dashboard-text",
            icon: FileText,
            tag: "Dashboard",
          } satisfies AdminCard,
        ]
      : []),
    ...(dashboardNewsAccess.ok
      ? [
          {
            title: "Dashboard-News",
            desc: "News-Slider auf der Startseite: Titelbild, PDF oder Bild-Anhang, Reihenfolge und Sichtbarkeit.",
            href: "/admin/dashboard-news",
            icon: Newspaper,
            tag: "Dashboard",
          } satisfies AdminCard,
        ]
      : []),
    ...(dashboardEventsAccess.ok
      ? [
          {
            title: "Dashboard-Events",
            desc: "Events & Highlights: Cover, Galerie (bis zu 200 Bilder), Reihenfolge und Sichtbarkeit.",
            href: "/admin/dashboard-events",
            icon: CalendarDays,
            tag: "Dashboard",
          } satisfies AdminCard,
        ]
      : []),
    ...(dashboardDocsAccess.ok
      ? [
          {
            title: "Dashboard-Dokumente",
            desc: "Zwei globale PDFs („Biblija AIW“) für alle Nutzer auf dem Dashboard verwalten.",
            href: "/admin/dashboard-docs",
            icon: BookOpen,
            tag: "Dashboard",
          } satisfies AdminCard,
        ]
      : []),
    ...(trainingManageAccess.ok
      ? [
          {
            title: "Training",
            desc: "Trainingsprogramme, Termine und Teilnehmer verwalten (öffentliche Übersicht unter /training).",
            href: "/admin/training",
            icon: GraduationCap,
            tag: "Training",
          } satisfies AdminCard,
        ]
      : []),
  ];

  const categoryBlocks: AdminCategoryBlock[] = [
    {
      id: "personal",
      title: "Personal",
      description: "Benutzer, Feedback, Bewertungen und globale Kalenderdaten.",
      icon: UserRound,
      cards: personalCards,
      alwaysShow: false,
    },
    {
      id: "restaurant",
      title: "Restaurant",
      description: "Standorte, Pläne, Anleitungen, Partner und standortbezogene Dokumente.",
      icon: Store,
      cards: restaurantCards,
      alwaysShow: false,
    },
    {
      id: "finance",
      title: "Finanzen",
      description: "Auswertungen und Einstellungen rund um Finanzen und Controlling.",
      icon: Wallet,
      cards: [
        ...(clAnalyseAccess.ok
          ? [
              {
                title: "CL Analyse",
                desc: "Budget vs. Ist CL: Monats- und Jahresvergleich für alle Restaurants. Grafiken, Tabelle und Restaurantvergleich.",
                href: "/admin/finanz/cl-analyse",
                icon: TrendingUp,
                tag: "Controlling",
              } satisfies AdminCard,
            ]
          : []),
      ],
      alwaysShow: true,
    },
    {
      id: "other",
      title: "Sonstiges",
      description: "Dashboard, Startseite und weitere plattformweite Einstellungen.",
      icon: Layers,
      cards: otherCards,
      alwaysShow: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4 font-sans text-foreground md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-6">
          <div>
            <h1 className="mb-2 text-4xl font-black uppercase tracking-tighter text-[#1a3826] dark:text-[#FFC72C]">
              ADMIN <span className="text-[#FFC72C]">PANEL</span>
            </h1>
            <p className="text-sm font-medium text-muted-foreground">
              Benutzer, Standorte und Zugriffsrechte verwalten.
            </p>
          </div>

          <div className="hidden items-center gap-2 text-[10px] font-black uppercase text-muted-foreground md:flex">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5">
              <ShieldCheck size={14} className="text-[#1a3826] dark:text-[#FFC72C]" aria-hidden />
              Globale Berechtigungen
            </span>
          </div>
        </div>

        <AdminHomeCategories blocks={categoryBlocks} />
      </div>
    </div>
  );
}
