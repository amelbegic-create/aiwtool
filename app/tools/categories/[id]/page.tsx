// app/tools/categories/[id]/page.tsx
import type React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDbUserForAccess } from "@/lib/access";
import { GOD_MODE_ROLES } from "@/lib/permissions";
import {
  ArrowRight,
  Users,
  Settings2,
  Layers,
  Palmtree,
  ClipboardCheck,
  Gift,
  BarChart3,
  CalendarClock,
  BookOpenText,
  ChevronRight,
  Building2,
} from "lucide-react";

export const dynamic = "force-dynamic";

type CategoryId = "staff" | "operations" | "other";

const CATEGORY_META: Record<
  CategoryId,
  { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }
> = {
  staff: {
    title: "Personal",
    subtitle: "Systemmodule / Personal",
    icon: Users,
  },
  operations: {
    title: "Operatives & Betrieb",
    subtitle: "Systemmodule / Operations",
    icon: Settings2,
  },
  other: {
    title: "Sonstiges",
    subtitle: "Systemmodule / Sonstiges",
    icon: Layers,
  },
};

function Card({
  href,
  title,
  description,
  icon: Icon,
  badge,
  iconClassName,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  badge?: string;
  iconClassName?: string;
}) {
  const iconStyle =
    iconClassName ??
    "bg-gradient-to-br from-[#1a3826]/10 to-[#1a3826]/5 text-[#1a3826] dark:text-[#FFC72C] border-[#1a3826]/20 dark:border-[#FFC72C]/30";
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-border shadow-sm hover:shadow-md hover:border-[#1a3826]/30 dark:hover:border-[#FFC72C]/30 active:scale-[0.99] transition-all duration-200 touch-manipulation p-4"
    >
      <div
        className={`h-9 w-9 rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200 group-hover:scale-105 ${iconStyle}`}
      >
        <Icon className="flex-shrink-0" size={16} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#1a3826] dark:group-hover:text-[#FFC72C] transition-colors truncate">
            {title}
          </h3>
          {badge && (
            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 shrink-0">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
          {description}
        </p>
      </div>
      <ArrowRight
        size={16}
        className="text-slate-400 group-hover:text-[#1a3826] dark:group-hover:text-[#FFC72C] shrink-0 transition-all duration-200 group-hover:translate-x-0.5"
        strokeWidth={2.5}
      />
    </Link>
  );
}

export default async function ToolsCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // zaštita: kategorije koje postoje
  if (!["staff", "operations", "other"].includes(id)) notFound();

  // session/db user
  const dbUser = await getDbUserForAccess();
  if (!dbUser?.id) redirect("/login");

  const isAdmin = GOD_MODE_ROLES.has(String(dbUser.role));
  const categoryId = id as CategoryId;
  const meta = CATEGORY_META[categoryId];
  const HeaderIcon = meta.icon;

  // alati po kategorijama (based on tvoje stablo u /app/tools)
  const tools: Array<{
    href: string;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string; size?: number }>;
    badge?: string;
    show?: boolean;
    iconClassName?: string;
  }> = [];

  if (categoryId === "staff") {
    tools.push(
      {
        href: "/tools/vacations",
        title: "Urlaubsplanung",
        description: "Abwesenheits- und Genehmigungsplanung.",
        icon: Palmtree,
        iconClassName:
          "bg-gradient-to-br from-sky-500/20 to-blue-500/20 text-sky-700 dark:text-sky-400 border-sky-200/50 dark:border-sky-500/30",
      },
      {
        href: "/tools/PDS",
        title: "PDS (Beurteilung)",
        description: "Mitarbeiterbeurteilung.",
        icon: ClipboardCheck,
        iconClassName:
          "bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-violet-700 dark:text-violet-400 border-violet-200/50 dark:border-violet-500/30",
      },
      {
        href: "/tools/rules",
        title: "Bedienungsanleitungen",
        description: "Anweisungen und Abläufe.",
        icon: BookOpenText,
        iconClassName:
          "bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/30",
      },
      {
        href: "/tools/bonusi",
        title: "Prämien & Bonus",
        description: "Bonusverwaltung.",
        icon: Gift,
        badge: "ADMIN",
        show: isAdmin,
        iconClassName:
          "bg-gradient-to-br from-amber-500/20 to-yellow-500/20 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-500/30",
      }
    );
  }

  if (categoryId === "operations") {
    tools.push(
      {
        href: "/tools/productivity",
        title: "Produktivität",
        description: "Berichte und Leistungsüberwachung der Restaurants.",
        icon: BarChart3,
        iconClassName:
          "bg-gradient-to-br from-rose-500/20 to-pink-500/20 text-rose-700 dark:text-rose-400 border-rose-200/50 dark:border-rose-500/30",
      },
      {
        href: "/tools/labor-planner",
        title: "Personaleinsatzplanung",
        description: "Arbeits- und Schichtplanung.",
        icon: CalendarClock,
        iconClassName:
          "bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-orange-700 dark:text-orange-400 border-orange-200/50 dark:border-orange-500/30",
      },
      {
        href: "/tools/partners",
        title: "Firmen und Partner",
        description: "Lieferanten und Serviceunternehmen.",
        icon: Building2,
        iconClassName:
          "bg-gradient-to-br from-blue-500/20 to-sky-500/20 text-blue-700 dark:text-blue-400 border-blue-200/50 dark:border-blue-500/30",
      }
    );
  }

  const visibleTools = tools.filter((t) => t.show !== false);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <main className="max-w-[1600px] mx-auto w-full px-4 md:px-10 py-6 md:py-10">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/dashboard" className="hover:text-[#1a3826] dark:hover:text-[#FFC72C] transition-colors">
            Tools
          </Link>
          <ChevronRight size={14} className="opacity-60" />
          <span className="font-medium text-foreground">{meta.title}</span>
        </nav>
        {/* Header */}
        <div className="flex items-center gap-5 pb-8 border-b border-border">
          <div
            className={`h-12 w-12 rounded-xl border flex items-center justify-center shadow-md ${
              categoryId === "staff"
                ? "bg-gradient-to-br from-[#1a3826]/15 to-[#FFC72C]/10 text-[#1a3826] dark:text-[#FFC72C] border-[#1a3826]/20 dark:border-[#FFC72C]/30"
                : "bg-card border-border text-[#1a3826] dark:text-[#FFC72C]"
            }`}
          >
            <HeaderIcon size={24} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {meta.title}
            </h1>
            <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mt-0.5">
              {meta.subtitle}
            </p>
          </div>
        </div>

        {/* Cards – kompaktni red za više alata */}
        <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {visibleTools.map((t) => (
            <Card
              key={t.href}
              href={t.href}
              title={t.title}
              description={t.description}
              icon={t.icon}
              badge={t.badge}
              iconClassName={t.iconClassName}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
