"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Building2, ChevronRight, LayoutGrid, List } from "lucide-react";
import { getPartnerCategoryIcon } from "@/lib/partnerCategoryIcons";
import { motion, AnimatePresence } from "framer-motion";

function getCategoryIcon(category: { icon?: string | null; name?: string | null } | null) {
  if (category?.icon) return getPartnerCategoryIcon(category.icon);
  return getPartnerCategoryIcon(null);
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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
  websiteUrl: string | null;
  galleryUrls: string[];
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
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");

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
      {/* Header – isti stil kao Bedienungsanleitungen / Vorlagen */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 md:pt-8">
        <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter mb-2">
              FIRMEN <span className="text-[#FFC72C]">& PARTNER</span>
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              Wichtige Kontakte und Serviceunternehmen an einem Ort.
            </p>
          </div>
        </div>
      </div>

      {/* Pretraga + filteri – ista kartica kao na pravila/vorlagen */}
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
                Kategorien
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
              <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="hidden sm:inline">
                  <span className="font-semibold text-[#1a3826] dark:text-[#FFC72C]">
                    {filtered.length}
                  </span>{" "}
                  {filtered.length === 1 ? "Firma" : "Firmen"} gefunden
                </span>
                <div className="ml-auto inline-flex items-center gap-1 rounded-xl border border-[#1a3826]/15 dark:border-[#FFC72C]/25 bg-background/80 px-1 py-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("cards")}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors",
                      viewMode === "cards"
                        ? "bg-[#1a3826] text-white shadow-sm dark:bg-[#FFC72C] dark:text-[#1a3826]"
                        : "text-muted-foreground hover:text-foreground hover:bg-[#1a3826]/5"
                    )}
                    aria-label="Karten"
                  >
                    <LayoutGrid size={14} />
                    <span className="hidden sm:inline">Karten</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors",
                      viewMode === "list"
                        ? "bg-[#1a3826] text-white shadow-sm dark:bg-[#FFC72C] dark:text-[#1a3826]"
                        : "text-muted-foreground hover:text-foreground hover:bg-[#1a3826]/5"
                    )}
                    aria-label="Liste"
                  >
                    <List size={14} />
                    <span className="hidden sm:inline">Liste</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid – tamnozelene kartice, logo desno (kao pravila/vorlagen) */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <AnimatePresence mode="wait">
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl md:rounded-3xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-gradient-to-br from-emerald-50/40 via-card to-[#1a3826]/5 dark:from-[#1a3826]/10 dark:via-card dark:to-[#1a3826]/5 shadow-lg p-10 md:p-16 text-center"
            >
              <div className="h-16 w-16 rounded-2xl bg-[#1a3826]/8 dark:bg-[#FFC72C]/12 flex items-center justify-center mx-auto mb-5">
                <Building2 size={30} className="text-[#1a3826] dark:text-[#FFC72C]" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Keine Ergebnisse</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                Kategorie oder Suchbegriff ändern, um Firmen und Partner anzuzeigen.
              </p>
            </motion.div>
          ) : viewMode === "cards" ? (
            <motion.div
              key="cards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filtered.map((partner, index) => (
                <motion.article
                  key={partner.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.25 }}
                >
                  <Link
                    href={`/tools/partners/${partner.id}`}
                    className={cn(
                      "group block rounded-2xl md:rounded-3xl overflow-hidden h-full min-h-[170px]",
                      "bg-gradient-to-br from-[#1a3826] via-[#1a3826] to-[#0b1a12]",
                      "border border-[#FFC72C]/25 shadow-[0_18px_40px_rgba(0,0,0,0.45)]",
                      "hover:-translate-y-1 hover:border-[#FFC72C]/60 hover:shadow-[0_22px_55px_rgba(0,0,0,0.6)] transition-all duration-300",
                      "flex flex-col p-5 md:p-6"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3 flex-1 min-h-0">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-base md:text-lg font-black text-white leading-snug line-clamp-3">
                          {partner.companyName}
                        </h2>
                        {partner.category?.name && (
                          <p className="text-white/60 text-xs font-medium mt-1">
                            {partner.category.name}
                          </p>
                        )}
                      </div>
                      <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl overflow-hidden bg-white/10 flex items-center justify-center">
                        {partner.logoUrl ? (
                          <Image
                            src={partner.logoUrl}
                            alt=""
                            fill
                            className="object-contain p-1.5"
                            sizes="80px"
                            unoptimized={partner.logoUrl.includes("blob.vercel-storage.com")}
                          />
                        ) : (
                          <Building2 size={28} className="text-[#FFC72C]" />
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-white/60 font-medium">
                        Firma · {partner.category?.name ?? "Partner"}
                      </span>
                      <span className="flex items-center gap-1.5 text-[#FFC72C] font-bold opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200">
                        Öffnen
                        <ChevronRight size={14} />
                      </span>
                    </div>
                  </Link>
                </motion.article>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {filtered.map((partner, index) => (
                <motion.article
                  key={partner.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.2 }}
                >
                  <Link
                    href={`/tools/partners/${partner.id}`}
                    className={cn(
                      "group flex items-center justify-between gap-4 rounded-2xl border border-[#1a3826]/20 dark:border-[#FFC72C]/25",
                      "bg-gradient-to-r from-[#1a3826] via-[#0f2319] to-[#07110b]",
                      "px-4 sm:px-5 py-3.5 sm:py-4 shadow-md hover:shadow-xl hover:border-[#FFC72C]/50 transition-all duration-200"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-white/10 flex items-center justify-center">
                        {partner.logoUrl ? (
                          <Image
                            src={partner.logoUrl}
                            alt=""
                            fill
                            className="object-contain p-1.5"
                            sizes="56px"
                            unoptimized={partner.logoUrl.includes("blob.vercel-storage.com")}
                          />
                        ) : (
                          <Building2 size={24} className="text-[#FFC72C]" />
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <h2 className="text-sm sm:text-base font-semibold text-white leading-snug line-clamp-1 sm:line-clamp-2">
                          {partner.companyName}
                        </h2>
                        <span className="text-white/60 text-xs">
                          {partner.category?.name ?? "Partner"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#FFC72C] text-xs font-bold shrink-0 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-200">
                      Öffnen
                      <ChevronRight size={14} />
                    </div>
                  </Link>
                </motion.article>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
