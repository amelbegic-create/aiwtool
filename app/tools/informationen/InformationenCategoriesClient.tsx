"use client";

import React, { useState, useEffect } from "react";
import { searchInformationGlobal } from "@/app/actions/informationActions";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import * as Icons from "lucide-react";
import {
  Info,
  Search,
  ChevronRight,
  FileText,
  Loader2,
  Newspaper,
  X,
  Download,
  LayoutGrid,
  List,
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

function ViewToggle({
  value,
  onChange,
}: {
  value: "grid" | "list";
  onChange: (v: "grid" | "list") => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl border border-stone-200 bg-white p-0.5 shadow-sm">
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
          value === "grid"
            ? "text-white shadow-sm"
            : "text-stone-400 hover:text-stone-600"
        }`}
        style={value === "grid" ? { backgroundColor: "#14532d" } : {}}
        aria-label="Grid-Ansicht"
      >
        <LayoutGrid size={13} />
        <span className="hidden sm:inline">Grid</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
          value === "list"
            ? "text-white shadow-sm"
            : "text-stone-400 hover:text-stone-600"
        }`}
        style={value === "list" ? { backgroundColor: "#14532d" } : {}}
        aria-label="Listen-Ansicht"
      >
        <List size={13} />
        <span className="hidden sm:inline">Liste</span>
      </button>
    </div>
  );
}

export default function InformationenCategoriesClient({ categories }: { categories: Category[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [docHits, setDocHits] = useState<DocSearchHit[]>([]);
  const [docSearchLoading, setDocSearchLoading] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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

  const isSearching = searchQuery.trim().length >= 2;
  const featured = categories[0] ?? null;
  const rest = categories.slice(1);

  return (
    <div className="min-h-screen bg-stone-50 font-sans pb-24">

      {/* ── HERO HEADER ─────────────────────────────────────────────────────── */}
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
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <Newspaper size={20} className="text-white" />
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/50">
              Internes Portal
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter text-white leading-none mb-2">
            Informationen
          </h1>
          <p className="text-white/55 text-sm sm:text-base mb-8 max-w-lg">
            Interne Richtlinien, Dresscode und wichtige Informationen für alle Mitarbeiter.
          </p>

          {/* Search bar */}
          <div className="relative max-w-2xl">
            <div className="flex items-center gap-3 bg-white rounded-2xl shadow-xl px-4 py-3.5 ring-2 ring-white/10 focus-within:ring-[#FFC72C]/50 transition-all">
              {docSearchLoading ? (
                <Loader2 size={20} className="text-stone-400 shrink-0 animate-spin" />
              ) : (
                <Search size={20} className="text-stone-400 shrink-0" />
              )}
              <input
                type="search"
                placeholder="Dresscode, Hygiene, Richtlinien durchsuchen…"
                className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-stone-800 placeholder:text-stone-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Suche"
              />
              {searchQuery.length > 0 && (
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

      {/* ── SEARCH RESULTS ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 pt-6"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">
              {docSearchLoading ? "Suche…" : `${docHits.length} Treffer`}
            </p>

            {!docSearchLoading && (
              <div className="space-y-2">
                {docHits.length === 0 ? (
                  <div className="rounded-2xl bg-white border border-stone-200 shadow-sm px-5 py-10 text-center">
                    <Info size={24} className="text-stone-300 mx-auto mb-2" />
                    <p className="text-sm text-stone-500">Keine Treffer gefunden.</p>
                  </div>
                ) : (
                  docHits.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-4 bg-white rounded-xl border border-stone-200 shadow-sm px-4 py-3.5 hover:border-[#14532d]/30 hover:shadow-md transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-stone-900 text-sm truncate">{d.title}</p>
                        {d.description && (
                          <p className="text-xs text-stone-400 line-clamp-1 mt-0.5">{d.description}</p>
                        )}
                        <span className="text-[10px] text-stone-400 font-medium mt-0.5 block">
                          {d.category.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openDocument(d)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#14532d] text-white text-xs font-bold shadow-sm hover:bg-[#166534] transition-colors"
                        >
                          <FileText size={13} />
                          Öffnen
                        </button>
                        <Link
                          href={`/tools/informationen/${d.categoryId}`}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-stone-100 text-stone-700 text-xs font-bold hover:bg-stone-200 transition-colors"
                        >
                          Zur Kategorie
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CATEGORIES ──────────────────────────────────────────────────────── */}
      {!isSearching && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 pt-8">

          {categories.length === 0 ? (
            <div className="rounded-2xl bg-white border border-stone-200 shadow-sm p-12 text-center">
              <div className="h-16 w-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
                <Info size={30} className="text-[#14532d]" />
              </div>
              <h2 className="text-lg font-black text-stone-900">Keine Kategorien</h2>
              <p className="text-sm text-stone-500 mt-1 max-w-sm mx-auto">
                Noch keine Inhalte vorhanden. Wenden Sie sich an einen Administrator.
              </p>
            </div>
          ) : (
            <>
              {/* Section label + toggle */}
              <div className="flex items-center gap-2 mb-5">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-400">
                  Kategorien
                </span>
                <span className="h-px flex-1 bg-stone-200" />
                <span className="text-xs font-bold text-stone-400 tabular-nums mr-2">
                  {categories.length}
                </span>
                <ViewToggle value={viewMode} onChange={setViewMode} />
              </div>

              <AnimatePresence mode="wait">
                {/* ── GRID MODE: magazine (featured + grid) ── */}
                {viewMode === "grid" && (
                  <motion.div
                    key="grid"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Featured */}
                    {featured && (() => {
                      const FeatIcon = getIconComponent(featured.iconName);
                      const count = featured._count?.items ?? 0;
                      return (
                        <motion.div
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                          className="mb-4"
                        >
                          <Link
                            href={`/tools/informationen/${featured.id}`}
                            className="group flex items-stretch rounded-2xl bg-white border border-stone-200 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-[#14532d]/40 transition-all duration-200 overflow-hidden"
                          >
                            <div
                              className="flex w-20 sm:w-28 shrink-0 items-center justify-center transition-all duration-200 group-hover:brightness-110"
                              style={{ backgroundColor: "#14532d" }}
                            >
                              <FeatIcon size={40} className="text-white" strokeWidth={1.8} />
                            </div>
                            <div className="flex flex-1 items-center gap-4 px-5 py-5 min-w-0">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span
                                    className="text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full"
                                    style={{ backgroundColor: "#14532d22", color: "#14532d" }}
                                  >
                                    Featured
                                  </span>
                                </div>
                                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-stone-900 leading-tight truncate">
                                  {featured.name}
                                </h2>
                                {featured.description && (
                                  <p className="text-sm text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                                    {featured.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <span
                                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold"
                                  style={{ backgroundColor: "#14532d18", color: "#14532d" }}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#14532d" }} />
                                  {count} {count === 1 ? "Dokument" : "Dokumente"}
                                </span>
                                <span
                                  className="flex items-center gap-1 text-[12px] font-bold opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-200"
                                  style={{ color: "#FFC72C" }}
                                >
                                  Öffnen <ChevronRight size={14} />
                                </span>
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })()}

                    {/* Rest grid */}
                    {rest.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {rest.map((cat, index) => {
                          const CardIcon = getIconComponent(cat.iconName);
                          const count = cat._count?.items ?? 0;
                          return (
                            <motion.article
                              key={cat.id}
                              initial={{ opacity: 0, y: 16 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.1 + index * 0.06, duration: 0.26 }}
                            >
                              <Link
                                href={`/tools/informationen/${cat.id}`}
                                className="group flex flex-col rounded-2xl bg-white border border-stone-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-[#14532d]/30 transition-all duration-200 overflow-hidden h-full"
                              >
                                <div
                                  className="flex items-center justify-center py-7 transition-all duration-200 group-hover:brightness-110"
                                  style={{ backgroundColor: "#14532d" }}
                                >
                                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                                    <CardIcon size={28} className="text-white" strokeWidth={2} />
                                  </div>
                                </div>
                                <div className="flex flex-col flex-1 px-4 py-4 gap-2">
                                  <h2 className="text-sm font-black uppercase tracking-tighter text-stone-900 leading-tight">
                                    {cat.name}
                                  </h2>
                                  {cat.description && (
                                    <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                                      {cat.description}
                                    </p>
                                  )}
                                  <div className="mt-auto pt-2 flex items-center justify-between">
                                    <span
                                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
                                      style={{ backgroundColor: "#14532d14", color: "#14532d" }}
                                    >
                                      <span className="h-1 w-1 rounded-full" style={{ backgroundColor: "#14532d" }} />
                                      {count} Dok.
                                    </span>
                                    <span
                                      className="flex items-center gap-0.5 text-[10px] font-bold opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-200"
                                      style={{ color: "#FFC72C" }}
                                    >
                                      <ChevronRight size={12} />
                                    </span>
                                  </div>
                                </div>
                              </Link>
                            </motion.article>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── LIST MODE: all categories as horizontal rows ── */}
                {viewMode === "list" && (
                  <motion.div
                    key="list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2"
                  >
                    {categories.map((cat, index) => {
                      const RowIcon = getIconComponent(cat.iconName);
                      const count = cat._count?.items ?? 0;
                      return (
                        <motion.div
                          key={cat.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04, duration: 0.22 }}
                        >
                          <Link
                            href={`/tools/informationen/${cat.id}`}
                            className="group flex items-center gap-4 bg-white rounded-xl border border-stone-200 shadow-sm px-4 py-3.5 hover:border-[#14532d]/30 hover:shadow-md transition-all duration-200"
                          >
                            {/* Icon */}
                            <div
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200 group-hover:brightness-110"
                              style={{ backgroundColor: "#14532d" }}
                            >
                              <RowIcon size={22} className="text-white" strokeWidth={2} />
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                              <h2 className="text-sm font-black uppercase tracking-tighter text-stone-900 leading-tight truncate">
                                {cat.name}
                              </h2>
                              {cat.description && (
                                <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">
                                  {cat.description}
                                </p>
                              )}
                            </div>

                            {/* Count + arrow */}
                            <div className="flex items-center gap-3 shrink-0">
                              <span
                                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold"
                                style={{ backgroundColor: "#14532d14", color: "#14532d" }}
                              >
                                {count} {count === 1 ? "Dok." : "Dok."}
                              </span>
                              <ChevronRight
                                size={16}
                                className="text-stone-300 group-hover:text-[#14532d] transition-colors"
                              />
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      )}

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
