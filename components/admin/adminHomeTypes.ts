import type { LucideIcon } from "lucide-react";

export type AdminCard = {
  title: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  tag: string;
  badge?: number;
};

export type AdminCategoryId = "personal" | "restaurant" | "finance" | "other";

export type AdminCategoryBlock = {
  id: AdminCategoryId;
  title: string;
  description: string;
  icon: LucideIcon;
  cards: AdminCard[];
  /** Section is always visible (empty state when no modules) */
  alwaysShow: boolean;
};

export const TAG_STYLES: Record<string, string> = {
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
  Vorlagen:
    "from-purple-500/18 via-purple-500/8 to-purple-500/8 text-purple-700 dark:text-purple-300 border-purple-200/60 dark:border-purple-500/40",
  Besuchsberichte:
    "from-teal-500/18 via-teal-500/8 to-teal-500/8 text-teal-700 dark:text-teal-300 border-teal-200/60 dark:border-teal-500/40",
};
