"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Search,
  Download,
  FileText,
  File,
  Image as ImageIcon,
  FileSpreadsheet,
  X,
  LayoutGrid,
  List,
  ChevronRight,
} from "lucide-react";
import { getItems } from "@/app/actions/visitReportActions";

type Category = {
  id: string;
  name: string;
  description: string | null;
};

type Item = {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: string;
  year: number;
};

function getFileIcon(fileType: string) {
  if (fileType.includes("pdf")) return { Icon: FileText, color: "text-red-400" };
  if (fileType.includes("image")) return { Icon: ImageIcon, color: "text-blue-400" };
  if (fileType.includes("sheet") || fileType.includes("excel")) return { Icon: FileSpreadsheet, color: "text-green-400" };
  if (fileType.includes("word") || fileType.includes("document")) return { Icon: File, color: "text-blue-400" };
  return { Icon: File, color: "text-white/70" };
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const YEAR_OPTIONS = [2026, 2027, 2028, 2029, 2030];

export default function BesuchsberichteListClient({
  category,
  initialItems,
  initialYear,
  restaurantId,
}: {
  category: Category;
  initialItems: Item[];
  initialYear: number;
  restaurantId: string;
}) {
  const router = useRouter();
  const defaultYear = YEAR_OPTIONS.includes(initialYear) ? initialYear : YEAR_OPTIONS[0];
  const [year, setYear] = useState(defaultYear);
  const [items, setItems] = useState(initialItems);
  const [searchQuery, setSearchQuery] = useState("");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [loadingYear, setLoadingYear] = useState(false);

  useEffect(() => {
    setYear(YEAR_OPTIONS.includes(initialYear) ? initialYear : YEAR_OPTIONS[0]);
    setItems(initialItems);
  }, [initialYear, initialItems]);

  const handleYearChange = async (newYear: number) => {
    if (newYear === year) return;
    setLoadingYear(true);
    setYear(newYear);
    try {
      const nextItems = await getItems(category.id, newYear, restaurantId);
      setItems(nextItems);
      router.replace(`/tools/besuchsberichte/${category.id}?year=${newYear}`, { scroll: false });
    } finally {
      setLoadingYear(false);
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description?.toLowerCase() ?? "").includes(q)
    );
  }, [items, searchQuery]);

  const handleOpen = (item: Item) => {
    if (item.fileType.includes("pdf")) {
      setPdfPreviewUrl(item.fileUrl);
    } else {
      window.open(item.fileUrl, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8">
        <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/tools/besuchsberichte"
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-[#1a3826] dark:hover:text-[#FFC72C] mb-3"
            >
              <ArrowLeft size={18} /> Zurück zu Kategorien
            </Link>
            <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter mb-2">
              {category.name}
            </h1>
            {category.description && (
              <p className="text-muted-foreground text-sm font-medium">{category.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Jahr</label>
            <select
              value={year}
              onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
              disabled={loadingYear}
              className="h-10 px-4 rounded-xl border border-[#1a3826]/20 dark:border-[#FFC72C]/25 bg-background text-sm font-bold text-foreground focus:ring-2 focus:ring-[#1a3826]/20 dark:focus:ring-[#FFC72C]/20 outline-none disabled:opacity-60"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 sm:mt-8 sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-[#1a3826]/10 dark:border-[#FFC72C]/10">
          <div className="rounded-2xl md:rounded-3xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-gradient-to-br from-emerald-50/80 via-white to-[#1a3826]/5 dark:from-[#1a3826]/15 dark:via-background dark:to-[#1a3826]/10 shadow-lg overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 sm:p-5">
              <div className="flex-1 flex items-center gap-2.5 rounded-xl bg-background/80 border border-[#1a3826]/15 dark:border-[#FFC72C]/20 px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-[#1a3826]/20 dark:focus-within:ring-[#FFC72C]/20 transition-all">
                <Search size={20} className="text-[#1a3826]/60 dark:text-[#FFC72C]/70 shrink-0" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Dokumente durchsuchen…"
                  className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-foreground placeholder:text-muted-foreground"
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
              <div className="inline-flex items-center gap-1 rounded-xl border border-[#1a3826]/15 dark:border-[#FFC72C]/25 bg-background/80 px-1 py-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors",
                    viewMode === "cards"
                      ? "bg-[#1a3826] text-white shadow-sm dark:bg-[#FFC72C] dark:text-[#1a3826]"
                      : "text-muted-foreground hover:text-foreground hover:bg-[#1a3826]/5"
                  )}
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
                >
                  <List size={14} />
                  <span className="hidden sm:inline">Liste</span>
                </button>
              </div>
            </div>
            <div className="px-4 pb-4">
              <span className="text-[11px] text-muted-foreground">
                <span className="font-semibold text-[#1a3826] dark:text-[#FFC72C]">
                  {filtered.length}
                </span>{" "}
                {filtered.length === 1 ? "Dokument" : "Dokumente"} ({year})
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <AnimatePresence mode="wait">
            {loadingYear ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-card p-10 text-center text-muted-foreground"
              >
                Lade Dokumente für {year}…
              </motion.div>
            ) : filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl md:rounded-3xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-gradient-to-br from-emerald-50/40 via-card to-[#1a3826]/5 dark:from-[#1a3826]/10 dark:via-card dark:to-[#1a3826]/5 shadow-lg p-10 md:p-16 text-center"
              >
                <div className="h-16 w-16 rounded-2xl bg-[#1a3826]/8 dark:bg-[#FFC72C]/12 flex items-center justify-center mx-auto mb-5">
                  <FileText size={30} className="text-[#1a3826] dark:text-[#FFC72C]" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Keine Dokumente</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                  Für das Jahr {year} sind in dieser Kategorie noch keine Dokumente verfügbar.
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
                {filtered.map((item, index) => {
                  const { Icon, color } = getFileIcon(item.fileType);
                  return (
                    <motion.article
                      key={item.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04, duration: 0.25 }}
                    >
                      <button
                        type="button"
                        onClick={() => handleOpen(item)}
                        className="group w-full text-left rounded-2xl md:rounded-3xl overflow-hidden h-full min-h-[170px] bg-gradient-to-br from-[#1a3826] via-[#1a3826] to-[#0b1a12] border border-[#FFC72C]/25 shadow-[0_18px_40px_rgba(0,0,0,0.45)] hover:-translate-y-1 hover:border-[#FFC72C]/60 hover:shadow-[0_22px_55px_rgba(0,0,0,0.6)] transition-all duration-300 flex flex-col p-5 md:p-6"
                      >
                        <div className="flex items-center gap-2 mb-2 shrink-0">
                          <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center">
                            <Icon size={18} className={color} />
                          </div>
                          <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">
                            {item.fileType.split("/")[1] || "Datei"}
                          </span>
                        </div>
                        <h3 className="text-base md:text-lg font-black text-white leading-snug line-clamp-3 flex-1">
                          {item.title}
                        </h3>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="text-white/60 font-medium line-clamp-1">
                            {item.description || "Dokument"}
                          </span>
                          <span className="flex items-center gap-1.5 text-[#FFC72C] font-bold opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200">
                            Öffnen
                            <ChevronRight size={14} />
                          </span>
                        </div>
                      </button>
                    </motion.article>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {filtered.map((item, index) => {
                  const { Icon, color } = getFileIcon(item.fileType);
                  return (
                    <motion.article
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03, duration: 0.2 }}
                    >
                      <button
                        type="button"
                        onClick={() => handleOpen(item)}
                        className={cn(
                          "group w-full flex items-center justify-between gap-4 rounded-2xl border border-[#1a3826]/20 dark:border-[#FFC72C]/25",
                          "bg-gradient-to-r from-[#1a3826] via-[#0f2319] to-[#07110b]",
                          "px-4 sm:px-5 py-3.5 sm:py-4 shadow-md hover:shadow-xl hover:border-[#FFC72C]/50 transition-all duration-200"
                        )}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                            <Icon size={20} className={color} />
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <h3 className="text-sm sm:text-base font-semibold text-white leading-snug line-clamp-1 sm:line-clamp-2">
                              {item.title}
                            </h3>
                            <span className="text-white/60 text-xs">
                              {item.fileType.split("/")[1] || "Datei"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[#FFC72C] text-xs font-bold shrink-0 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-200">
                          Öffnen
                          <ChevronRight size={14} />
                        </div>
                      </button>
                    </motion.article>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {pdfPreviewUrl && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPdfPreviewUrl(null);
            }}
          >
            <div className="relative bg-card rounded-2xl shadow-2xl border border-[#1a3826]/20 w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between px-5 py-4 shrink-0 bg-[#1a3826] border-b border-[#FFC72C]/20">
                <div className="flex items-center gap-2.5">
                  <FileText size={20} className="text-[#FFC72C]" aria-hidden />
                  <span className="text-sm md:text-base font-black text-white uppercase tracking-wider">
                    Dokument anzeigen
                  </span>
                </div>
                <div className="flex items-center gap-2">
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
                <iframe
                  src={pdfPreviewUrl}
                  className="w-full h-full border-0"
                  title="PDF Vorschau"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
