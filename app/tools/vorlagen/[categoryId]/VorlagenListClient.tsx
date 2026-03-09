"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Download, FileText, File, Image as ImageIcon, FileSpreadsheet, X } from "lucide-react";

type Category = {
  id: string;
  name: string;
  description: string | null;
};

type Template = {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: string;
  createdAt: Date | string;
};

function getFileIcon(fileType: string) {
  if (fileType.includes("pdf")) return { Icon: FileText, color: "text-red-500" };
  if (fileType.includes("image")) return { Icon: ImageIcon, color: "text-blue-500" };
  if (fileType.includes("sheet") || fileType.includes("excel")) return { Icon: FileSpreadsheet, color: "text-green-600" };
  if (fileType.includes("word") || fileType.includes("document")) return { Icon: File, color: "text-blue-600" };
  return { Icon: File, color: "text-muted-foreground" };
}

export default function VorlagenListClient({
  category,
  templates,
}: {
  category: Category;
  templates: Template[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description?.toLowerCase() ?? "").includes(q)
    );
  }, [templates, searchQuery]);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
        <div className="border-b border-border pb-6 mb-8">
          <Link
            href="/tools/vorlagen"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-[#1a3826] dark:hover:text-[#FFC72C] mb-4"
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

        <div className="mb-6 bg-card rounded-2xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 flex items-center gap-3 p-4">
          <Search size={20} className="text-[#1a3826]/60 dark:text-[#FFC72C]/70 shrink-0" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Vorlagen durchsuchen…"
            className="bg-transparent outline-none text-sm font-medium text-foreground w-full"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl md:rounded-3xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-gradient-to-br from-emerald-50/40 via-card to-[#1a3826]/5 dark:from-[#1a3826]/10 dark:via-card dark:to-[#1a3826]/5 shadow-lg p-10 md:p-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-[#1a3826]/8 dark:bg-[#FFC72C]/12 flex items-center justify-center mx-auto mb-5">
              <FileText size={30} className="text-[#1a3826] dark:text-[#FFC72C]" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Keine Vorlagen</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              In dieser Kategorie sind noch keine Dokumente verfügbar.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((template, index) => {
              const { Icon, color } = getFileIcon(template.fileType);
              return (
                <motion.article
                  key={template.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.2 }}
                >
                  <div className="group flex items-center justify-between gap-4 rounded-2xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-card hover:bg-gradient-to-r hover:from-[#1a3826]/5 hover:to-transparent dark:hover:from-[#FFC72C]/5 px-5 py-4 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="h-12 w-12 rounded-xl bg-[#1a3826]/5 dark:bg-[#FFC72C]/10 flex items-center justify-center shrink-0">
                        <Icon size={24} className={color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-foreground leading-snug line-clamp-1">
                          {template.title}
                        </h3>
                        {template.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {template.description}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">
                          {template.fileType.split("/")[1] || "Datei"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (template.fileType.includes("pdf")) {
                          setPdfPreviewUrl(template.fileUrl);
                        } else {
                          window.open(template.fileUrl, "_blank");
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] hover:bg-[#142e1e] dark:hover:bg-[#e6b328] text-sm font-bold shadow-sm transition-all shrink-0"
                    >
                      <Download size={16} />
                      <span className="hidden sm:inline">Herunterladen</span>
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}

        {pdfPreviewUrl && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPdfPreviewUrl(null);
            }}
          >
            <div className="relative bg-card rounded-2xl shadow-2xl border border-[#1a3826]/20 w-full max-w-[75vw] h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
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
