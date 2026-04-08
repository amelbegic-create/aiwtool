"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type PdfPreviewModalProps = {
  url: string;
  title: string;
  onClose: () => void;
};

/** Zentrierter PDF-Dialog (iframe). Portal nach document.body, damit nichts vom Dashboard „durchscheint“. */
export default function PdfPreviewModal({ url, title, onClose }: PdfPreviewModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="relative z-10 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-preview-title"
      >
        <div className="flex items-center justify-between px-5 py-4 shrink-0 bg-[#1a3826] border-b border-[#FFC72C]/20">
          <h2 id="pdf-preview-title" className="text-lg font-black text-white truncate pr-4">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-white/70 hover:bg-white/15 hover:text-white transition shrink-0"
            aria-label="Schließen"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 min-h-0 p-4 overflow-hidden">
          <iframe
            src={url}
            className="w-full h-[min(78vh,720px)] rounded-md border border-border bg-muted/30"
            title={title}
          />
        </div>
        <div className="shrink-0 px-5 py-4 border-t border-border bg-muted/20 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
