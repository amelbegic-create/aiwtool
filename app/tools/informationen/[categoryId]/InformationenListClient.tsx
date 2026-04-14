"use client";

import React, { useState, useEffect } from "react";
import { searchInformationInCategory } from "@/app/actions/informationActions";
import Link from "next/link";
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
  ExternalLink,
  Newspaper,
  Loader2,
  LayoutGrid,
  List,
} from "lucide-react";

type Category = {
  id: string;
  name: string;
  description: string | null;
};

type InformationItem = {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: string;
  createdAt: Date | string;
};

type FilePlaque = {
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  bg: string;
  label: string;
};

function getFilePlaque(fileType: string): FilePlaque {
  if (fileType.includes("pdf"))
    return { Icon: FileText, bg: "bg-red-500", label: "PDF" };
  if (fileType.includes("image"))
    return { Icon: ImageIcon, bg: "bg-sky-500", label: "Bild" };
  if (fileType.includes("sheet") || fileType.includes("excel"))
    return { Icon: FileSpreadsheet, bg: "bg-emerald-600", label: "Excel" };
  if (fileType.includes("word") || fileType.includes("document"))
    return { Icon: File, bg: "bg-indigo-600", label: "Word" };
  return { Icon: File, bg: "bg-stone-400", label: "Datei" };
}

function ViewToggle({
  value,
  onChange,
}: {
  value: "list" | "grid";
  onChange: (v: "list" | "grid") => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl border border-stone-200 bg-white p-0.5 shadow-sm">
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
          value === "list" ? "text-white shadow-sm" : "text-stone-400 hover:text-stone-600"
        }`}
        style={value === "list" ? { backgroundColor: "#14532d" } : {}}
        aria-label="Listen-Ansicht"
      >
        <List size={13} />
        <span className="hidden sm:inline">Liste</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
          value === "grid" ? "text-white shadow-sm" : "text-stone-400 hover:text-stone-600"
        }`}
        style={value === "grid" ? { backgroundColor: "#14532d" } : {}}
        aria-label="Grid-Ansicht"
      >
        <LayoutGrid size={13} />
        <span className="hidden sm:inline">Grid</span>
      </button>
    </div>
  );
}

export default function InformationenListClient({
  category,
  items,
}: {
  category: Category;
  items: InformationItem[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [displayed, setDisplayed] = useState<InformationItem[]>(items);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  useEffect(() => {
    setDisplayed(items);
  }, [items]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setDisplayed(items);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    const t = window.setTimeout(() => {
      searchInformationInCategory(category.id, q)
        .then((rows) => {
          if (!cancelled) setDisplayed(rows as InformationItem[]);
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [searchQuery, category.id, items]);

  const handleOpen = (item: InformationItem) => {
    if (item.fileType.includes("pdf")) {
      setPdfPreviewUrl(item.fileUrl);
    } else {
      window.open(item.fileUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans pb-24">

      {/* ── HERO HEADER ──────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden px-4 pt-10 pb-14 sm:px-6 md:px-8"
        style={{ backgroundColor: "#14532d" }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 20%, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative max-w-4xl mx-auto">
          <Link
            href="/tools/informationen"
            className="inline-flex items-center gap-2 text-sm font-bold text-white/50 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft size={16} />
            Zurück zu Kategorien
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <Newspaper size={20} className="text-white" />
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/50">
              Informationen
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter text-white leading-none mb-2">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-white/50 text-sm sm:text-base mb-6 max-w-lg">
              {category.description}
            </p>
          )}

          {/* Search bar */}
          <div className="relative max-w-2xl mt-6">
            <div className="flex items-center gap-3 bg-white rounded-2xl shadow-xl px-4 py-3.5 ring-2 ring-white/10 focus-within:ring-[#FFC72C]/50 transition-all">
              {searchLoading ? (
                <Loader2 size={20} className="text-stone-400 shrink-0 animate-spin" />
              ) : (
                <Search size={20} className="text-stone-400 shrink-0" />
              )}
              <input
                type="search"
                placeholder={`In „${category.name}" suchen…`}
                className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-stone-800 placeholder:text-stone-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Suche"
              />
              {searchQuery.length > 0 && !searchLoading && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="shrink-0 text-stone-400 hover:text-stone-600 transition-colors"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── DOCUMENT CONTENT ─────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 pt-8">

        {/* Section label + toggle */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-400">
            Dokumente
          </span>
          <span className="h-px flex-1 bg-stone-200" />
          <span className="text-xs font-bold text-stone-400 tabular-nums mr-2">
            {displayed.length}
          </span>
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>

        <AnimatePresence mode="wait">
          {displayed.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl bg-white border border-stone-200 shadow-sm p-12 text-center"
            >
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: "#14532d18" }}
              >
                <FileText size={30} style={{ color: "#14532d" }} />
              </div>
              <h2 className="text-lg font-black text-stone-900">Keine Dokumente</h2>
              <p className="text-sm text-stone-500 mt-1 max-w-sm mx-auto">
                {searchQuery.trim()
                  ? "Keine Treffer für Ihre Suche."
                  : "In dieser Kategorie sind noch keine Dokumente verfügbar."}
              </p>
            </motion.div>

          ) : viewMode === "list" ? (
            /* ── LIST VIEW ── */
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {displayed.map((item, index) => {
                const { Icon, bg, label } = getFilePlaque(item.fileType);
                return (
                  <motion.article
                    key={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.22 }}
                  >
                    <div className="group flex items-center gap-4 bg-white rounded-xl border border-stone-200 shadow-sm px-4 py-4 hover:border-[#14532d]/30 hover:shadow-md transition-all duration-200">
                      {/* File-type plaque */}
                      <div
                        className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${bg} shadow-sm`}
                      >
                        <Icon size={22} className="text-white" />
                        <span className="text-[9px] font-black uppercase text-white/80 tracking-widest mt-0.5">
                          {label}
                        </span>
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm sm:text-base font-black text-stone-900 leading-tight line-clamp-2">
                          {item.title}
                        </h3>
                        {item.description && (
                          <p className="text-xs italic text-stone-400 mt-0.5 line-clamp-1">
                            {item.description}
                          </p>
                        )}
                        <span className="inline-flex items-center gap-1 mt-1.5 rounded-full bg-stone-100 px-2.5 py-0.5 text-[10px] font-bold text-stone-500">
                          {label}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpen(item)}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black shadow-sm transition-colors"
                          style={{ backgroundColor: "#FFC72C", color: "#14532d" }}
                        >
                          <ExternalLink size={13} />
                          <span className="hidden sm:inline">Öffnen</span>
                        </button>
                        <a
                          href={item.fileUrl}
                          download
                          onClick={(e) => e.stopPropagation()}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700 transition-colors"
                          aria-label="Herunterladen"
                        >
                          <Download size={15} />
                        </a>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </motion.div>

          ) : (
            /* ── GRID VIEW ── */
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {displayed.map((item, index) => {
                const { Icon, bg, label } = getFilePlaque(item.fileType);
                return (
                  <motion.article
                    key={item.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.24 }}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpen(item)}
                      className="group w-full text-left flex flex-col rounded-2xl bg-white border border-stone-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-[#14532d]/30 transition-all duration-200 overflow-hidden h-full"
                    >
                      {/* File-type pane */}
                      <div className={`flex items-center justify-center py-8 ${bg} relative`}>
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/20">
                          <Icon size={32} className="text-white" />
                        </div>
                        <span className="absolute top-3 right-3 text-[9px] font-black uppercase text-white/70 tracking-widest bg-white/15 px-2 py-0.5 rounded-full">
                          {label}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex flex-col flex-1 px-4 py-4 gap-2">
                        <h3 className="text-sm font-black text-stone-900 leading-tight line-clamp-3">
                          {item.title}
                        </h3>
                        {item.description && (
                          <p className="text-xs italic text-stone-400 line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                        )}

                        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                          <span
                            className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: "#FFC72C", color: "#14532d" }}
                          >
                            <ExternalLink size={10} />
                            Öffnen
                          </span>
                          <a
                            href={item.fileUrl}
                            download
                            onClick={(e) => e.stopPropagation()}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-400 hover:bg-stone-200 hover:text-stone-600 transition-colors"
                            aria-label="Herunterladen"
                          >
                            <Download size={13} />
                          </a>
                        </div>
                      </div>
                    </button>
                  </motion.article>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── PDF PREVIEW MODAL ────────────────────────────────────────────────── */}
      {pdfPreviewUrl && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPdfPreviewUrl(null);
          }}
        >
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-white/10"
              style={{ backgroundColor: "#14532d" }}
            >
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#FFC72C] text-[#14532d] hover:bg-[#FFD55A] transition shadow-sm"
                >
                  <Download size={16} />
                  Herunterladen
                </a>
                <button
                  type="button"
                  onClick={() => setPdfPreviewUrl(null)}
                  className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
                  aria-label="Schließen"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-slate-100 min-h-0">
              <iframe src={pdfPreviewUrl} className="w-full h-full border-0" title="PDF Vorschau" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
