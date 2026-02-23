"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  Phone,
  Mail,
  Building2,
  ChevronRight,
  LayoutGrid,
  UserCircle,
} from "lucide-react";
import { getPartnerCategoryIcon } from "@/lib/partnerCategoryIcons";
import { motion, AnimatePresence } from "framer-motion";

/** Boje badge-a u skladu s brandom stranice (#1a3826 / #FFC72C) – nijanse zelene i žute */
const BADGE_STYLES = [
  "bg-[#1a3826]/12 text-[#1a3826] border-[#1a3826]/25 dark:bg-[#FFC72C]/15 dark:text-[#FFC72C] dark:border-[#FFC72C]/30",
  "bg-emerald-600/12 text-emerald-800 border-emerald-500/25 dark:bg-emerald-400/15 dark:text-emerald-300 dark:border-emerald-400/30",
  "bg-[#1a3826]/10 text-[#1a3826]/90 border-[#1a3826]/20 dark:bg-[#FFC72C]/12 dark:text-[#FFC72C] dark:border-[#FFC72C]/25",
  "bg-amber-600/12 text-amber-800 border-amber-500/25 dark:bg-amber-400/15 dark:text-amber-300 dark:border-amber-400/30",
  "bg-slate-600/10 text-slate-700 border-slate-500/20 dark:bg-slate-400/12 dark:text-slate-300 dark:border-slate-400/25",
  "bg-[#1a3826]/8 text-[#1a3826]/80 border-[#1a3826]/15 dark:bg-[#FFC72C]/10 dark:text-[#FFC72C]/90 dark:border-[#FFC72C]/20",
];

function getCategoryIcon(
  category: { icon?: string | null; name?: string | null } | null,
  categoryIndex?: number
) {
  if (category?.icon) return getPartnerCategoryIcon(category.icon);
  return getPartnerCategoryIcon(null);
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function badgeStyleForCategory(categoryId: string | null, categories: { id: string }[]): string {
  if (!categoryId) return BADGE_STYLES[5];
  const idx = categories.findIndex((c) => c.id === categoryId);
  return BADGE_STYLES[idx >= 0 ? idx % BADGE_STYLES.length : 5];
}

type Category = { id: string; name: string; sortOrder: number; icon: string | null };

type Partner = {
  id: string;
  categoryId: string | null;
  category?: { id: string; name: string; icon: string | null } | null;
  companyName: string;
  logoUrl: string | null;
  serviceDescription: string | null;
  notes: string | null;
  contacts: Array<{
    id: string;
    contactName: string;
    phone: string | null;
    email: string | null;
    role: string | null;
  }>;
};

export default function PartnersToolClient({
  initialPartners,
  initialCategories,
}: {
  initialPartners: Partner[];
  initialCategories: Category[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("alle");

  const categoryTabs = useMemo(
    () => [{ id: "alle", name: "Alle" }, ...initialCategories],
    [initialCategories]
  );

  const filtered = useMemo(() => {
    return initialPartners.filter((p) => {
      const matchCat = activeCategory === "alle" || p.categoryId === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.companyName.toLowerCase().includes(q) ||
        (p.serviceDescription?.toLowerCase() ?? "").includes(q) ||
        (p.notes?.toLowerCase() ?? "").includes(q) ||
        (p.category?.name?.toLowerCase() ?? "").includes(q) ||
        p.contacts.some(
          (c) =>
            (c.contactName?.toLowerCase() ?? "").includes(q) ||
            (c.email?.toLowerCase() ?? "").includes(q) ||
            (c.phone?.toLowerCase() ?? "").includes(q)
        );
      return matchCat && matchSearch;
    });
  }, [initialPartners, activeCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground pb-24">
      {/* Breadcrumb – u skladu s dashboardom */}
      <div className="border-b border-[#1a3826]/10 dark:border-[#FFC72C]/10 bg-card/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              href="/dashboard"
              className="hover:text-[#1a3826] dark:hover:text-[#FFC72C] transition-colors"
            >
              Start
            </Link>
            <ChevronRight size={14} className="opacity-60" />
            <span className="font-medium text-foreground">Firmen und Partner</span>
          </nav>
        </div>
      </div>

      {/* Hero – isti stil kao dashboard header (zaobljeni, gradijent, ikona) */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4 mb-6">
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-[#1a3826] dark:bg-[#1a3826]/95 shadow-xl border border-[#1a3826]/20">
          <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-white/5 rounded-full blur-3xl -mr-12 -mt-12" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#FFC72C]/10 rounded-full blur-3xl -ml-10 -mb-10" />
          <div className="relative z-10 flex items-center gap-4 px-6 py-8 md:px-10 md:py-10">
            <div className="h-14 w-14 md:h-16 md:w-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <Building2 className="h-7 w-7 md:h-8 md:w-8 text-[#FFC72C]" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                Firmen und Partner
              </h1>
              <p className="text-white/80 text-sm md:text-base mt-0.5">
                Wichtige Kontakte und Serviceunternehmen an einem Ort
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pretraga + filteri – kartica u stilu dashboard modula */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-[#1a3826]/10 dark:border-[#FFC72C]/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="rounded-2xl md:rounded-3xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-gradient-to-br from-emerald-50/80 via-white to-[#1a3826]/5 dark:from-[#1a3826]/15 dark:via-background dark:to-[#1a3826]/10 shadow-lg overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 sm:p-5 border-b border-[#1a3826]/10 dark:border-[#FFC72C]/10">
              <div className="flex-1 flex items-center gap-2.5 rounded-xl bg-background/80 border border-[#1a3826]/15 dark:border-[#FFC72C]/20 px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-[#1a3826]/20 dark:focus-within:ring-[#FFC72C]/20 transition-all">
                <Search size={20} className="text-[#1a3826]/60 dark:text-[#FFC72C]/70 shrink-0" />
                <input
                  type="search"
                  placeholder="Firmen oder Kontakte suchen…"
                  className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-foreground placeholder:text-muted-foreground"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Suche"
                />
              </div>
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="shrink-0 text-xs font-bold text-muted-foreground hover:text-[#1a3826] dark:hover:text-[#FFC72C] px-3 py-2 rounded-lg hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10 transition-colors"
                >
                  Löschen
                </button>
              )}
            </div>
            <div className="px-4 pb-4">
              <p className="text-xs font-semibold text-[#1a3826]/70 dark:text-[#FFC72C]/80 uppercase tracking-wider mb-2">
                Abteilung
              </p>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {categoryTabs.map((tab) => {
                  const Icon = tab.id === "alle" ? LayoutGrid : getCategoryIcon(tab);
                  const isActive = activeCategory === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveCategory(tab.id)}
                      className={cn(
                        "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 touch-manipulation",
                        isActive
                          ? "bg-[#1a3826] text-white shadow-md dark:bg-[#FFC72C] dark:text-[#1a3826]"
                          : "bg-background/70 text-muted-foreground border border-[#1a3826]/10 dark:border-[#FFC72C]/15 hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10 hover:text-foreground"
                      )}
                    >
                      <Icon size={16} className="shrink-0" />
                      <span className="whitespace-nowrap">{tab.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid kartica – isti vizualni jezik kao dashboard kartice (Urlaubsstatus, Mein Team) */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <AnimatePresence mode="wait">
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl md:rounded-3xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-gradient-to-br from-emerald-50/50 via-card to-[#1a3826]/5 dark:from-[#1a3826]/10 dark:via-card dark:to-[#1a3826]/5 shadow-lg p-14 md:p-20 text-center"
            >
              <div className="h-20 w-20 rounded-2xl bg-[#1a3826]/10 dark:bg-[#FFC72C]/15 flex items-center justify-center mx-auto mb-6">
                <Building2 size={40} className="text-[#1a3826] dark:text-[#FFC72C]" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Keine Ergebnisse</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                Kategorie oder Suchbegriff ändern, um Firmen und Partner anzuzeigen.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filtered.map((partner, index) => {
                const CategoryIcon = getCategoryIcon(partner.category ?? null);
                return (
                  <motion.article
                    key={partner.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.25 }}
                    className={cn(
                      "rounded-2xl md:rounded-3xl overflow-hidden flex flex-col",
                      "border border-[#1a3826]/10 dark:border-[#FFC72C]/20",
                      "bg-gradient-to-br from-emerald-50/60 via-white to-[#1a3826]/5 dark:from-[#1a3826]/15 dark:via-card dark:to-[#1a3826]/10",
                      "shadow-lg hover:shadow-xl hover:-translate-y-0.5 hover:border-[#1a3826]/25 dark:hover:border-[#FFC72C]/30 transition-all duration-300"
                    )}
                  >
                    {partner.logoUrl ? (
                      <div className="relative w-full h-28 md:h-32 bg-[#1a3826]/5 dark:bg-[#1a3826]/20 overflow-hidden shrink-0">
                        <Image
                          src={partner.logoUrl}
                          alt=""
                          fill
                          className="object-cover object-center"
                          sizes="(max-width: 768px) 100vw, 33vw"
                          unoptimized={partner.logoUrl.includes("blob.vercel-storage.com")}
                        />
                      </div>
                    ) : null}
                    <div className="p-5 md:p-6 flex flex-col flex-1 min-w-0">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border",
                          badgeStyleForCategory(partner.categoryId, initialCategories)
                        )}
                      >
                        <CategoryIcon size={12} className="shrink-0" />
                        {partner.category?.name ?? "—"}
                      </span>
                      <h2 className="mt-3 text-lg md:text-xl font-black text-[#1a3826] dark:text-[#FFC72C] leading-snug line-clamp-2">
                        {partner.companyName}
                      </h2>
                      {partner.serviceDescription && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                          {partner.serviceDescription}
                        </p>
                      )}
                      {partner.notes && (
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 italic">
                          {partner.notes}
                        </p>
                      )}

                      <div className="mt-5 pt-4 border-t border-[#1a3826]/10 dark:border-[#FFC72C]/15 space-y-3">
                        {partner.contacts.map((c) => (
                          <div
                            key={c.id}
                            className="flex gap-3 text-sm"
                          >
                            <div className="shrink-0 h-9 w-9 rounded-full bg-[#1a3826]/10 dark:bg-[#FFC72C]/15 flex items-center justify-center">
                              <UserCircle size={18} className="text-[#1a3826] dark:text-[#FFC72C]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-foreground">
                                {c.contactName}
                                {c.role && (
                                  <span className="font-normal text-muted-foreground"> · {c.role}</span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                {c.phone && (
                                  <a
                                    href={`tel:${c.phone.trim()}`}
                                    className="inline-flex items-center gap-1.5 text-[#1a3826] dark:text-[#FFC72C] hover:underline font-medium text-[13px]"
                                  >
                                    <Phone size={14} className="shrink-0" />
                                    <span>{c.phone}</span>
                                  </a>
                                )}
                                {c.email && (
                                  <a
                                    href={`mailto:${c.email.trim()}`}
                                    className="inline-flex items-center gap-1.5 text-[#1a3826] dark:text-[#FFC72C] hover:underline font-medium text-[13px] truncate max-w-full"
                                  >
                                    <Mail size={14} className="shrink-0" />
                                    <span className="truncate">{c.email}</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
