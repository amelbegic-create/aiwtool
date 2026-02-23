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
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group block bg-white dark:bg-card rounded-2xl md:rounded-[2rem] border border-slate-200 dark:border-border shadow-sm hover:shadow-xl hover:-translate-y-1 active:scale-[0.99] transition-all touch-manipulation min-h-[140px]"
    >
      <div className="p-5 sm:p-8 h-full flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
            <Icon className="text-[#1a3826]" />
          </div>

          {badge ? (
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
              {badge}
            </span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
              AKTIV
            </span>
          )}
        </div>

        <div className="mt-8">
          <h3 className="text-xl font-black text-slate-900 group-hover:text-[#1a3826] transition-colors">
            {title}
          </h3>
          <p className="mt-2 text-sm font-semibold text-slate-400">
            {description}
          </p>

          <div className="mt-6 flex items-center justify-between">
            <span className="text-xs font-black text-[#1a3826]">Öffnen</span>
            <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:bg-white transition-colors">
              <ArrowRight
                className="text-slate-400 group-hover:text-[#1a3826]"
                size={18}
              />
            </div>
          </div>
        </div>
      </div>
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
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    show?: boolean;
  }> = [];

  if (categoryId === "staff") {
    tools.push(
      {
        href: "/tools/vacations",
        title: "Urlaubsplanung",
        description: "Abwesenheits- und Genehmigungsplanung.",
        icon: Palmtree,
      },
      {
        href: "/tools/PDS",
        title: "PDS (Beurteilung)",
        description: "Mitarbeiterbeurteilung.",
        icon: ClipboardCheck,
      },
      {
        href: "/tools/rules",
        title: "Bedienungsanleitungen",
        description: "Anweisungen und Abläufe.",
        icon: BookOpenText,
      },
      {
        href: "/tools/bonusi",
        title: "Prämien & Bonus",
        description: "Bonusverwaltung.",
        icon: Gift,
        badge: "ADMIN",
        show: isAdmin,
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
      },
      {
        href: "/tools/labor-planner",
        title: "Personaleinsatzplanung",
        description: "Arbeits- und Schichtplanung.",
        icon: CalendarClock,
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
          <div className="h-14 w-14 rounded-2xl bg-card border border-border flex items-center justify-center shadow-sm">
            <HeaderIcon className="text-[#1a3826] dark:text-[#FFC72C]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {meta.title}
            </h1>
            <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
              {meta.subtitle}
            </p>
          </div>
        </div>

        {/* Cards */}
        <div className="pt-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {visibleTools.map((t) => (
            <Card
              key={t.href}
              href={t.href}
              title={t.title}
              description={t.description}
              icon={t.icon}
              badge={t.badge}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
