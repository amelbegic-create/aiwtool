"use client";

import Link from "next/link";
import {
  PlaneTakeoff,
  ClipboardList,
  BookOpen,
  Clock,
  TrendingUp,
  ShieldCheck,
  LucideIcon,
} from "lucide-react";
import { APP_TOOLS } from "@/lib/tools/tools-config";

const ICON_MAP: Record<string, LucideIcon> = {
  vacations: PlaneTakeoff,
  PDS: ClipboardList,
  rules: BookOpen,
  "labor-planner": Clock,
  productivity: TrendingUp,
  "admin-panel": ShieldCheck,
};

type Highlight = { id: string; moduleKey: string; moduleLabel: string };

type Props = { highlights: Highlight[] };

export default function DashboardModuleIcons({ highlights }: Props) {
  if (highlights.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {highlights.map((h) => {
        const tool = APP_TOOLS.find((t) => t.id === h.moduleKey);
        const href = tool?.href ?? "#";
        const Icon = ICON_MAP[h.moduleKey] ?? BookOpen;
        return (
          <Link
            key={h.id}
            href={href}
            title={h.moduleLabel}
            className="flex flex-col items-center gap-1.5 p-4 rounded-xl border border-slate-200 bg-white hover:bg-[#1a3826]/5 hover:border-[#1a3826]/30 transition-colors min-w-[80px]"
          >
            <div className="h-10 w-10 rounded-lg bg-[#1a3826]/10 text-[#1a3826] flex items-center justify-center">
              <Icon size={22} />
            </div>
            <span className="text-xs font-semibold text-slate-700 text-center leading-tight line-clamp-2">
              {h.moduleLabel}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
