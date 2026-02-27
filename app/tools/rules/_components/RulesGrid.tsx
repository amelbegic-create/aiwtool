"use client";

import React, { useMemo, useState } from "react";
import {
  BookOpen,
  Search,
  CheckCircle2,
  Image as ImageIcon,
  Calendar,
  Users,
  Settings,
  Layers,
  FileText,
  Plus,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { formatDateDDMMGGGG } from "@/lib/dateUtils";
import { motion, AnimatePresence } from "framer-motion";

interface RulesGridProps {
  initialRules: Array<{
    id: string;
    title: string;
    content?: string | null;
    categoryId: string;
    category?: { name: string } | null;
    priority: string;
    imageUrl?: string | null;
    images?: Array<{ url: string }>;
    createdAt: string | Date;
    isRead?: boolean;
  }>;
  categories: Array<{ id: string; name: string }>;
  showReadStatus?: boolean;
  canEdit?: boolean;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function stripPreview(content: string | null | undefined, maxLen: number): string {
  if (!content) return "";
  const text = content
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[#*`\[\]()]/g, "")
    .trim();
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim() + "…";
}

function priorityMeta(p: string) {
  if (p === "URGENT")
    return { label: "Dringend", chip: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800" };
  if (p === "MANDATORY")
    return { label: "Pflicht", chip: "bg-[#FFC72C]/20 text-[#1a3826] border-[#FFC72C]/40 dark:border-[#FFC72C]/30" };
  return { label: "Info", chip: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800" };
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  Personal: Users,
  "Operatives & Betrieb": Settings,
  Operatives: Settings,
  Sonstiges: Layers,
};

function getCategoryIcon(categoryName: string | null | undefined) {
  if (!categoryName) return FileText;
  return CATEGORY_ICONS[categoryName] ?? BookOpen;
}

export default function RulesGrid({
  initialRules,
  categories,
  showReadStatus = true,
  canEdit = false,
}: RulesGridProps) {
  const [rules] = useState(initialRules);
  const [activeCategory, setActiveCategory] = useState("alle");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      const matchesCat = activeCategory === "alle" || r.categoryId === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || r.title.toLowerCase().includes(q) || (r.content && r.content.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });
  }, [rules, activeCategory, searchQuery]);

  const unreadCount = useMemo(
    () => (showReadStatus ? filteredRules.filter((r) => !r.isRead).length : 0),
    [filteredRules, showReadStatus]
  );

  const coverUrl = (r: (typeof rules)[0]) =>
    r.imageUrl || (r.images && r.images.length > 0 ? r.images[0].url : null);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground pb-24">
      {/* Sticky Search + Filters (bez dodatnog naslova – glavni naslov je u parent headeru) */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4">
          <div className="flex flex-col gap-3">
            {/* Search – full width, min 44px */}
            <div className="rounded-xl border border-border bg-muted/50 focus-within:ring-2 focus-within:ring-[#1a3826]/20 dark:focus-within:ring-[#FFC72C]/20 flex items-center gap-3 px-4 py-3 min-h-[44px]">
              <Search size={20} className="text-muted-foreground shrink-0" />
              <input
                type="search"
                placeholder="Suche…"
                className="flex-1 min-w-0 bg-transparent outline-none text-base text-foreground placeholder:text-muted-foreground min-h-[24px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Suche"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-xs font-bold uppercase px-2 py-1.5 rounded-lg bg-muted hover:bg-accent text-muted-foreground transition min-h-[36px]"
                >
                  Löschen
                </button>
              )}
            </div>

            {/* Horizontal category filter */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1 min-h-[44px] items-center">
              <button
                onClick={() => setActiveCategory("alle")}
                className={cn(
                  "px-4 py-2.5 rounded-full text-sm font-semibold transition-all shrink-0 min-h-[44px] touch-manipulation",
                  activeCategory === "alle"
                    ? "bg-[#1a3826] text-white dark:bg-[#FFC72C] dark:text-[#1a3826]"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                Alle
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "px-4 py-2.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap shrink-0 min-h-[44px] touch-manipulation",
                    activeCategory === cat.id
                      ? "bg-[#1a3826] text-white dark:bg-[#FFC72C] dark:text-[#1a3826]"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
        <AnimatePresence mode="wait">
          {filteredRules.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-border bg-card shadow-sm p-10 md:p-14 text-center"
            >
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Search size={28} className="text-muted-foreground" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Keine Ergebnisse gefunden</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                Ändern Sie die Kategorie oder den Suchbegriff.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {filteredRules.map((rule, index) => {
                const pr = priorityMeta(rule.priority);
                const cover = coverUrl(rule);
                const Icon = getCategoryIcon(rule.category?.name ?? undefined);
                const preview = stripPreview(rule.content, 100);
                return (
                  <motion.div
                    key={rule.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.2 }}
                  >
                    <Link
                      href={`/tools/rules/${rule.id}`}
                      className="group block h-full bg-card rounded-2xl border border-border shadow-sm hover:shadow-lg hover:border-[#1a3826]/20 dark:hover:border-[#FFC72C]/30 transition-all overflow-hidden min-h-[44px] touch-manipulation"
                    >
                      <div className="h-36 w-full bg-muted overflow-hidden flex items-center justify-center relative">
                        {cover ? (
                          <Image
                            src={cover}
                            alt=""
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-2xl bg-[#1a3826]/10 dark:bg-[#FFC72C]/20 text-[#1a3826] dark:text-[#FFC72C] flex items-center justify-center">
                            <Icon size={28} />
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border",
                              pr.chip
                            )}
                          >
                            {pr.label}
                          </span>
                          {rule.category?.name && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[#1a3826]/10 text-[#1a3826] dark:bg-[#FFC72C]/20 dark:text-[#FFC72C] border border-[#1a3826]/20 dark:border-[#FFC72C]/30">
                              {rule.category.name}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-foreground group-hover:text-[#1a3826] dark:group-hover:text-[#FFC72C] transition-colors line-clamp-2 leading-snug">
                          {rule.title}
                        </h3>
                        {preview && (
                          <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                            {preview}
                          </p>
                        )}
                        <div className="mt-auto pt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 shrink-0">
                            <Calendar size={12} />
                            {formatDateDDMMGGGG(rule.createdAt)}
                          </span>
                          {showReadStatus &&
                            (rule.isRead ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 shrink-0">
                                <CheckCircle2 size={12} />
                                <span className="font-medium">Gelesen</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 shrink-0 font-medium">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                Neu
                              </span>
                            ))}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
