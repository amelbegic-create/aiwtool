"use client";

import { motion } from "framer-motion";
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
  Gift,
  FileText,
  LucideIcon,
  ArrowRight,
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
  vorlagen: FileText,
  "admin-panel": ShieldCheck,
  bonus: Gift,
};

// McDonald's palette: green #1a3826, yellow #FFC72C, royal blue #4169E1
type CardStyle = {
  gradient: string;
  textLight: boolean; // true = white text, false = dark (for yellow card)
  accentIcon: string; // icon color class
  shadow: string;
  category: string;
};

const CARD_STYLES: Record<string, CardStyle> = {
  team: {
    gradient: "from-[#1a3826] to-[#0f2218]",
    textLight: true,
    accentIcon: "text-[#FFC72C]",
    shadow: "shadow-[#1a3826]/25",
    category: "HR",
  },
  vacations: {
    gradient: "from-[#1a3826] to-[#142e1e]",
    textLight: true,
    accentIcon: "text-[#FFC72C]",
    shadow: "shadow-[#1a3826]/25",
    category: "HR",
  },
  PDS: {
    gradient: "from-[#4169E1] to-[#2d4fb8]",
    textLight: true,
    accentIcon: "text-white/90",
    shadow: "shadow-[#4169E1]/25",
    category: "HR",
  },
  rules: {
    gradient: "from-[#1a3826] to-[#0f2218]",
    textLight: true,
    accentIcon: "text-[#FFC72C]",
    shadow: "shadow-[#1a3826]/25",
    category: "Ops",
  },
  "labor-planner": {
    gradient: "from-[#FFC72C] to-[#e6b328]",
    textLight: false,
    accentIcon: "text-[#1a3826]",
    shadow: "shadow-[#FFC72C]/25",
    category: "Finance",
  },
  productivity: {
    gradient: "from-[#4169E1] to-[#2d4fb8]",
    textLight: true,
    accentIcon: "text-white/90",
    shadow: "shadow-[#4169E1]/25",
    category: "Ops",
  },
  partners: {
    gradient: "from-[#4169E1] to-[#2d4fb8]",
    textLight: true,
    accentIcon: "text-white/90",
    shadow: "shadow-[#4169E1]/25",
    category: "Ops",
  },
  bonus: {
    gradient: "from-[#FFC72C] to-[#e6b328]",
    textLight: false,
    accentIcon: "text-[#1a3826]",
    shadow: "shadow-[#FFC72C]/25",
    category: "HR",
  },
  vorlagen: {
    gradient: "from-[#1a3826] to-[#0f2218]",
    textLight: true,
    accentIcon: "text-[#FFC72C]",
    shadow: "shadow-[#1a3826]/25",
    category: "Docs",
  },
  "admin-panel": {
    gradient: "from-[#1a3826] to-[#0f2218]",
    textLight: true,
    accentIcon: "text-[#FFC72C]",
    shadow: "shadow-[#1a3826]/25",
    category: "Admin",
  },
};

const MODULE_DESCRIPTIONS: Record<string, string> = {
  team: "Teamübersicht & Urlaubsfreigaben",
  vacations: "Jahresurlaub planen & verwalten",
  PDS: "Mitarbeiterbewertungen & Entwicklung",
  rules: "Richtlinien, Verfahren & SOPs",
  "labor-planner": "Kosten- & Stundeneinsatzplanung",
  productivity: "Umsatz & Stationsplanung",
  partners: "Kontakte & Servicedienstleister",
  vorlagen: "Offizielle Dokumente & Formulare",
  bonus: "Prämien- & Bonusabrechnungen",
  "admin-panel": "Systemverwaltung & Einstellungen",
};

type Highlight = { id: string; moduleKey: string; moduleLabel: string };
type Props = { highlights: Highlight[] };

export default function DashboardModuleLauncher({ highlights }: Props) {
  if (highlights.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
      {highlights.map((h, i) => {
        const tool = APP_TOOLS.find((t) => t.id === h.moduleKey);
        const href = tool?.href ?? "#";
        const Icon = ICON_MAP[h.moduleKey] ?? BookMarked;
        const style = CARD_STYLES[h.moduleKey] ?? {
          gradient: "from-[#1a3826] to-[#0f2218]",
          textLight: true,
          accentIcon: "text-[#FFC72C]",
          shadow: "shadow-[#1a3826]/25",
          category: "Tool",
        };
        const isLight = style.textLight;

        return (
          <motion.div
            key={h.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35, ease: "easeOut" }}
          >
            <Link
              href={href}
              className={`group relative flex flex-col gap-3 p-4 md:p-5 rounded-2xl bg-gradient-to-br ${style.gradient} shadow-lg ${style.shadow} hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 overflow-hidden min-h-[140px] ${
                isLight ? "text-white" : "text-[#1a3826]"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${isLight ? "bg-white/20" : "bg-[#1a3826]/15"} transition-all duration-300 group-hover:opacity-90`}>
                  <Icon size={22} strokeWidth={2} className={style.accentIcon} />
                </div>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${isLight ? "bg-white/20 text-white" : "bg-[#1a3826]/15 text-[#1a3826]"}`}>
                  {style.category}
                </span>
              </div>

              <div className="flex-1">
                <p className="text-sm font-black leading-tight">
                  {h.moduleLabel}
                </p>
                <p className={`mt-1 text-[11px] leading-snug line-clamp-2 ${isLight ? "text-white/70" : "text-[#1a3826]/70"}`}>
                  {MODULE_DESCRIPTIONS[h.moduleKey] ?? ""}
                </p>
              </div>

              <div className={`flex items-center gap-1 text-[11px] font-bold opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 ${isLight ? "text-white/80" : "text-[#1a3826]/80"}`}>
                Öffnen <ArrowRight size={11} />
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
