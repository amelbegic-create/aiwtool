"use client";

import React, { useMemo, useState, useEffect } from "react";
import { searchInformationGlobal } from "@/app/actions/informationActions";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import * as Icons from "lucide-react";
import {
  Info,
  Search,
  ChevronRight,
  FileText,
  Download,
  LayoutGrid,
  List,
  X,
} from "lucide-react";

type Category = {
  id: string;
  name: string;
  description: string | null;
  iconName: string | null;
  _count?: { items: number };
};

function getIconComponent(iconName: string | null) {
  if (!iconName) return Info;
  const Icon = (Icons as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[iconName];
  return Icon || Info;
}

type DocSearchHit = {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: string;
  categoryId: string;
  category: { name: string; iconName?: string | null };
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function InformationenCategoriesClient({ categories }: { categories: Category[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("alle");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [docHits, setDocHits] = useState<DocSearchHit[]>([]);
  const [docSearchLoading, setDocSearchLoading] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const categoryTabs = useMemo(
    () => [{ id: "alle", name: "Alle" }, ...categories.map((c) => ({ id: c.id, name: c.name }))],
    [categories]
  );

  const filtered = useMemo(() => {
    return categories.filter((cat) => {
      const matchCat = activeCategory === "alle" || cat.id === activeCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        cat.name.toLowerCase().includes(q) ||
        (cat.description?.toLowerCase() ?? "").includes(q);
      return matchCat && matchSearch;
    });
  }, [categories, activeCategory, searchQuery]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setDocHits([]);
      setDocSearchLoading(false);
      return;
    }
    let cancelled = false;
    setDocSearchLoading(true);
    const t = window.setTimeout(() => {
      searchInformationGlobal(q)
        .then((rows) => {
          if (!cancelled) setDocHits(rows as DocSearchHit[]);
        })
        .finally(() => {
          if (!cancelled) setDocSearchLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [searchQuery]);

  const openDocument = (d: DocSearchHit) => {
    if (d.fileType.toLowerCase().includes("pdf") || d.fileUrl.toLowerCase().includes(".pdf")) {
      setPdfPreviewUrl(d.fileUrl);
    } else {
      window.open(d.fileUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8">
        <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter mb-2">
              INFORMATIONEN
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              Interne Richtlinien, Dresscode und wichtige Informationen für alle Mitarbeiter.
            </p>
          </div>
        </div>

        {/* Sticky filter panel */}
        <div className="mt-6 sm:mt-8 sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-[#1a3826]/10 dark:border-[#FFC72C]/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
            <div className="rounded-2xl md:rounded-3xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-gradient-to-br from-emerald-50/80 via-white to-[#1a3826]/5 dark:from-[#1a3826]/15 dark:via-background dark:to-[#1a3826]/10 shadow-lg overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 sm:p-5 border-b border-[#1a3826]/10 dark:border-[#FFC72C]/10">
                <div className="flex-1 flex items-center gap-2.5 rounded-xl bg-background/80 border border-[#1a3826]/15 dark:border-[#FFC72C]/20 px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-[#1a3826]/20 dark:focus-within:ring-[#FFC72C]/20 transition-all">
                  <Search size={20} className="text-[#1a3826]/60 dark:text-[#FFC72C]/70 shrink-0" />
                  <input
                    type="search"
                    placeholder="Dresscode, Hygiene, Richtlinien durchsuchen…"
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
                    const Icon = tab.id === "alle" ? LayoutGrid : FileText;
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
                    {filtered.length === 1 ? "Kategorie" : "Kategorien"}
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

        {/* PDF search hits */}
        {searchQuery.trim().length >= 2 && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#1a3826]/80 dark:text-[#FFC72C]/90 mb-2">
              Treffer in Dokumenten
            </p>
            {docSearchLoading ? (
              <p className="text-sm text-muted-foreground">Suche…</p>
            ) : docHits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Treffer gefunden.</p>
            ) : (
              <ul className="space-y-1 rounded-xl border border-[#1a3826]/15 dark:border-[#FFC72C]/20 bg-card/90 p-3 shadow-sm">
                {docHits.map((d) => (
                  <li key={d.id}>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg px-3 py-2.5 hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10 transition-colors border border-transparent hover:border-[#1a3826]/10 dark:hover:border-[#FFC72C]/15">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{d.title}</p>
                        {d.description ? (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{d.description}</p>
                        ) : null}
                        <p className="text-[11px] text-muted-foreground mt-1">{d.category.name}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0 sm:justify-end">
                        <button
                          type="button"
                          onClick={() => openDocument(d)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#1a3826] text-white text-xs font-bold shadow-sm hover:bg-[#142e1e] dark:bg-[#FFC72C] dark:text-[#1a3826] dark:hover:bg-[#e6b328] transition-colors min-h-[40px] sm:min-h-0"
                        >
                          <FileText size={15} className="shrink-0" aria-hidden />
                          Dokument öffnen
                        </button>
                        <Link
                          href={`/tools/informationen/${d.categoryId}`}
                          className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-[#FFC72C] text-[#1a3826] text-xs font-bold shadow-sm hover:bg-[#e6b328] transition-colors min-h-[40px] sm:min-h-0 border border-[#1a3826]/15"
                        >
                          Zur Kategorie
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Categories grid / list */}
        <div
          className={
            filtered.length === 0 && searchQuery.trim()
              ? "max-w-6xl mx-auto px-4 sm:px-6 py-0"
              : "max-w-6xl mx-auto px-4 sm:px-6 py-8"
          }
        >
          <AnimatePresence mode="wait">
            {filtered.length === 0 && !searchQuery.trim() ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl md:rounded-3xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-gradient-to-br from-emerald-50/40 via-card to-[#1a3826]/5 dark:from-[#1a3826]/10 dark:via-card dark:to-[#1a3826]/5 shadow-lg p-10 md:p-16 text-center"
              >
                <div className="h-16 w-16 rounded-2xl bg-[#1a3826]/8 dark:bg-[#FFC72C]/12 flex items-center justify-center mx-auto mb-5">
                  <Info size={30} className="text-[#1a3826] dark:text-[#FFC72C]" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Keine Kategorien</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                  Wenden Sie sich an einen Administrator.
                </p>
              </motion.div>
            ) : filtered.length > 0 && viewMode === "cards" ? (
              <motion.div
                key="cards"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {filtered.map((cat, index) => {
                  const CardIcon = getIconComponent(cat.iconName);
                  return (
                    <motion.article
                      key={cat.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04, duration: 0.25 }}
                    >
                      <Link
                        href={`/tools/informationen/${cat.id}`}
                        className="group block rounded-2xl md:rounded-3xl overflow-hidden h-full min-h-[170px] bg-gradient-to-br from-[#1a3826] via-[#1a3826] to-[#0b1a12] border border-[#FFC72C]/25 shadow-[0_18px_40px_rgba(0,0,0,0.45)] hover:-translate-y-1 hover:border-[#FFC72C]/60 hover:shadow-[0_22px_55px_rgba(0,0,0,0.6)] transition-all duration-300 flex flex-col p-5 md:p-6"
                      >
                        <div className="flex items-start justify-between gap-3 flex-1 min-h-0">
                          <h2 className="text-base md:text-lg font-black text-white leading-snug line-clamp-3 flex-1 min-w-0">
                            {cat.name}
                          </h2>
                          <div className="shrink-0 flex items-center justify-center w-12 h-12">
                            <CardIcon size={36} className="text-[#FFC72C]" strokeWidth={2.25} />
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="text-white/60 font-medium">
                            {cat._count?.items ?? 0} Dokument(e)
                          </span>
                          <span className="flex items-center gap-1.5 text-[#FFC72C] font-bold opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200">
                            Öffnen
                            <ChevronRight size={14} />
                          </span>
                        </div>
                      </Link>
                    </motion.article>
                  );
                })}
              </motion.div>
            ) : filtered.length > 0 ? (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {filtered.map((cat, index) => {
                  const ListIcon = getIconComponent(cat.iconName);
                  return (
                    <motion.article
                      key={cat.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03, duration: 0.2 }}
                    >
                      <Link
                        href={`/tools/informationen/${cat.id}`}
                        className="group flex items-center justify-between gap-4 rounded-2xl border border-[#1a3826]/20 dark:border-[#FFC72C]/25 bg-gradient-to-r from-[#1a3826] via-[#0f2319] to-[#07110b] px-4 sm:px-5 py-3.5 sm:py-4 shadow-md hover:shadow-xl hover:border-[#FFC72C]/50 transition-all duration-200"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="shrink-0 flex items-center justify-center w-11 h-11">
                            <ListIcon size={31} className="text-[#FFC72C]" strokeWidth={2.25} />
                          </div>
                          <div className="flex flex-col gap-1 min-w-0">
                            <h2 className="text-sm sm:text-base font-semibold text-white leading-snug line-clamp-1 sm:line-clamp-2">
                              {cat.name}
                            </h2>
                            <span className="text-white/60 text-xs">
                              {cat._count?.items ?? 0} Dokument(e)
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[#FFC72C] text-xs font-bold shrink-0 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-200">
                          Öffnen
                          <ChevronRight size={14} />
                        </div>
                      </Link>
                    </motion.article>
                  );
                })}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* PDF Preview Modal */}
        {pdfPreviewUrl && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPdfPreviewUrl(null);
            }}
          >
            <div className="relative bg-card rounded-2xl shadow-2xl border border-[#1a3826]/20 w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between px-5 py-4 shrink-0 bg-[#1a3826] border-b border-[#FFC72C]/20">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText size={20} className="text-[#FFC72C] shrink-0" aria-hidden />
                  <span className="text-sm md:text-base font-black text-white uppercase tracking-wider truncate">
                    Dokument anzeigen
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={pdfPreviewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#FFC72C] text-[#1a3826] hover:bg-[#FFC72C]/90 transition shadow-sm"
                  >
                    <Download size={16} />
                    Herunterladen
                  </a>
                  <button
                    type="button"
                    onClick={() => setPdfPreviewUrl(null)}
                    className="p-2 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition"
                    aria-label="Schließen"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden bg-slate-100 dark:bg-slate-900/50 min-h-0">
                <iframe src={pdfPreviewUrl} className="w-full h-full border-0" title="PDF Vorschau" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
