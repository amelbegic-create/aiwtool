"use client";

import Link from "next/link";
import {
  Plane,
  ClipboardCheck,
  BookMarked,
  Clock,
  TrendingUp,
  ShieldCheck,
  UsersRound,
  Building2,
  LucideIcon,
} from "lucide-react";
import { APP_TOOLS } from "@/lib/tools/tools-config";

const ICON_MAP: Record<string, LucideIcon> = {
  team: UsersRound,
  vacations: Plane,
  PDS: ClipboardCheck,
  rules: BookMarked,
  "labor-planner": Clock,
  productivity: TrendingUp,
  partners: Building2,
  "admin-panel": ShieldCheck,
};

const ICON_STYLES: Record<string, string> = {
  team: "from-amber-500/20 to-yellow-500/20 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-500/30",
  vacations: "from-sky-500/20 to-blue-500/20 text-sky-700 dark:text-sky-400 border-sky-200/50 dark:border-sky-500/30",
  PDS: "from-violet-500/20 to-purple-500/20 text-violet-700 dark:text-violet-400 border-violet-200/50 dark:border-violet-500/30",
  rules: "from-emerald-500/20 to-teal-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/30",
  "labor-planner": "from-orange-500/20 to-amber-500/20 text-orange-700 dark:text-orange-400 border-orange-200/50 dark:border-orange-500/30",
  productivity: "from-rose-500/20 to-pink-500/20 text-rose-700 dark:text-rose-400 border-rose-200/50 dark:border-rose-500/30",
  partners: "from-blue-500/20 to-sky-500/20 text-blue-700 dark:text-blue-400 border-blue-200/50 dark:border-blue-500/30",
  "admin-panel": "from-slate-500/20 to-zinc-500/20 text-slate-700 dark:text-slate-400 border-slate-200/50 dark:border-slate-500/30",
};

type Highlight = { id: string; moduleKey: string; moduleLabel: string };

type Props = { highlights: Highlight[] };

export default function DashboardModuleIcons({ highlights }: Props) {
  if (highlights.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {highlights.map((h) => {
        const tool = APP_TOOLS.find((t) => t.id === h.moduleKey);
        const href = tool?.href ?? "#";
        const Icon = ICON_MAP[h.moduleKey] ?? BookMarked;
        const style = ICON_STYLES[h.moduleKey] ?? "from-[#1a3826]/10 to-[#1a3826]/5 text-[#1a3826] dark:text-[#FFC72C] border-border";
        return (
          <Link
            key={h.id}
            href={href}
            title={h.moduleLabel}
            className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border border-border bg-card shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-300 min-h-[44px] touch-manipulation group"
          >
            <div className={`h-14 w-14 rounded-2xl border bg-gradient-to-br flex items-center justify-center ${style} group-hover:shadow-inner transition-all duration-300`}>
              <Icon size={28} strokeWidth={2} />
            </div>
            <span className="text-xs font-bold text-foreground text-center leading-tight line-clamp-2">
              {h.moduleLabel}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
