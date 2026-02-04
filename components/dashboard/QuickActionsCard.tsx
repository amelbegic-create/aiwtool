"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Network,
  FilePlus,
  BookOpen,
  Zap,
  PlaneTakeoff,
  ClipboardList,
  Clock,
  TrendingUp,
  LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ICON_MAP: Record<string, LucideIcon> = {
  Network,
  FilePlus,
  BookOpen,
  hijerarhija: Network,
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
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = () => {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  if (!actions?.length) {
    return (
      <Card className="border-slate-200 bg-white shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-2 px-6">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Zap size={18} className="text-[#FFC72C]" />
            Brze akcije
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
          <p className="text-sm text-slate-500">Nema dostupnih brzih akcija za vašu ulogu.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-slate-200 bg-white shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-2 px-6">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Zap size={18} className="text-[#FFC72C]" />
            Brze akcije
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {actions.map((action) => {
              const Icon = ICON_MAP[action.iconKey] ?? BookOpen;
              const isPlaceholder = action.href === "#" && action.id === "hijerarhija";
              if (isPlaceholder) {
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={showToast}
                    className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-[#1a3826]/5 hover:border-[#1a3826]/30 transition-all text-left group"
                  >
                    <div className="h-10 w-10 rounded-lg bg-[#1a3826]/10 text-[#1a3826] flex items-center justify-center group-hover:bg-[#1a3826] group-hover:text-[#FFC72C] transition-colors">
                      <Icon size={20} />
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{action.label}</span>
                  </button>
                );
              }
              return (
                <Link
                  key={action.id}
                  href={action.href}
                  className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-[#1a3826]/5 hover:border-[#1a3826]/30 transition-all group"
                >
                  <div className="h-10 w-10 rounded-lg bg-[#1a3826]/10 text-[#1a3826] flex items-center justify-center group-hover:bg-[#1a3826] group-hover:text-[#FFC72C] transition-colors">
                    <Icon size={20} />
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{action.label}</span>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {toastVisible && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-[#1a3826] text-white text-sm font-semibold shadow-lg border border-[#1a3826]/20 animate-in fade-in slide-in-from-bottom-4 duration-300"
          role="alert"
        >
          Modul je trenutno u izradi.
        </div>
      )}
    </>
  );
}
