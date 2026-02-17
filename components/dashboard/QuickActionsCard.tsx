"use client";

import React from "react";
import Link from "next/link";
import {
  FilePlus,
  BookOpen,
  Zap,
  PlaneTakeoff,
  ClipboardList,
  Clock,
  TrendingUp,
  LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  FilePlus,
  BookOpen,
  vacations: PlaneTakeoff,
  PDS: ClipboardList,
  rules: BookOpen,
  "labor-planner": Clock,
  productivity: TrendingUp,
};

export type QuickActionProps = {
  id: string;
  label: string;
  href: string;
  iconKey: string;
};

type Props = {
  actions: QuickActionProps[];
};

export default function QuickActionsCard({ actions }: Props) {
  if (!actions?.length) {
    return (
      <div className="rounded-2xl md:rounded-3xl border border-border bg-card shadow-md p-6">
        <p className="text-sm text-muted-foreground">Keine Schnellzugriffe für Ihre Rolle verfügbar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-card-foreground flex items-center gap-2 px-0.5">
        <Zap size={18} className="text-[#FFC72C]" />
        Schnellzugriff
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map((action) => {
          const Icon = ICON_MAP[action.iconKey] ?? BookOpen;
          return (
            <Link
              key={action.id}
              href={action.href}
              className="group flex items-center gap-4 p-5 md:p-6 rounded-2xl border border-border bg-card shadow-md hover:shadow-xl hover:-translate-y-1 hover:border-[#1a3826]/20 dark:hover:border-[#FFC72C]/30 transition-all duration-300 min-h-[44px] touch-manipulation"
            >
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#1a3826]/10 to-[#1a3826]/5 dark:from-[#FFC72C]/20 dark:to-[#FFC72C]/10 text-[#1a3826] dark:text-[#FFC72C] flex items-center justify-center group-hover:from-[#1a3826] group-hover:to-[#1a3826]/80 group-hover:text-white dark:group-hover:from-[#FFC72C] dark:group-hover:to-amber-500 dark:group-hover:text-[#1a3826] transition-all duration-300 shrink-0">
                <Icon size={28} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <span className="text-base font-bold text-foreground block">{action.label}</span>
                <span className="text-xs text-muted-foreground mt-0.5 block group-hover:text-foreground/80 transition-colors">
                  Jetzt öffnen →
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
