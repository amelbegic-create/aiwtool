"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BookMarked, ChevronRight, X } from "lucide-react";
import PdfPreviewModal from "@/components/sitzplan/PdfPreviewModal";
import type { DashboardPinnedDocPublic } from "@/app/actions/dashboardPinnedDocsActions";

type Props = {
  docs: DashboardPinnedDocPublic[];
};

export default function QualitaetsfuehrerLauncher({ docs }: Props) {
  const [mounted, setMounted] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [preview, setPreview] = useState<{ title: string; url: string } | null>(null);

  const items = useMemo(() => {
    return docs
      .filter((d) => !!d.pdfUrl)
      .map((d) => ({ id: d.id, title: d.title, url: d.pdfUrl! }));
  }, [docs]);

  const closeList = useCallback(() => setListOpen(false), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!listOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeList();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listOpen, closeList]);

  useEffect(() => {
    if (!listOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [listOpen]);

  const listModal =
    listOpen && mounted ? (
      <div
        className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeList();
        }}
        role="presentation"
      >
        <div
          className="relative z-10 flex w-full max-w-md max-h-[min(80vh,520px)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="qualitaetsfuehrer-list-title"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[#FFC72C]/20 bg-[#1a3826] px-4 py-3">
            <h2 id="qualitaetsfuehrer-list-title" className="truncate pr-2 text-base font-black text-white">
              Qualitätsführer
            </h2>
            <button
              type="button"
              onClick={closeList}
              className="shrink-0 rounded-lg p-2 text-white/70 transition hover:bg-white/15 hover:text-white"
              aria-label="Schließen"
            >
              <X size={20} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-background p-3">
            {items.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">Keine Dokumente verfügbar.</p>
            ) : (
              <ul className="space-y-1">
                {items.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPreview({ title: it.title, url: it.url });
                        closeList();
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-left text-sm font-semibold text-foreground transition hover:bg-muted/50"
                    >
                      <span className="truncate">{it.title}</span>
                      <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex shrink-0 justify-end border-t border-border bg-muted/30 px-4 py-3">
            <button
              type="button"
              onClick={closeList}
              className="rounded-xl bg-[#1a3826] px-5 py-2 text-sm font-bold text-[#FFC72C] transition-opacity hover:opacity-90"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setListOpen(true)}
        aria-expanded={listOpen}
        aria-haspopup="dialog"
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 border-[#FFC72C] bg-[#FFC72C] px-5 py-2.5 text-sm font-black uppercase tracking-wide text-[#1a3826] shadow-md transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFC72C]"
      >
        <BookMarked size={18} className="shrink-0" aria-hidden />
        Qualitätsführer
      </button>

      {mounted && listModal ? createPortal(listModal, document.body) : null}

      {preview && (
        <PdfPreviewModal url={preview.url} title={preview.title} onClose={() => setPreview(null)} />
      )}
    </>
  );
}
