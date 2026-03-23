"use client";

import { useState } from "react";
import { FileText, Map } from "lucide-react";
import PdfPreviewModal from "@/components/sitzplan/PdfPreviewModal";
import type { SitzplanPdfEntry } from "@/lib/sitzplanUrls";

type Props = {
  pdfs: SitzplanPdfEntry[] | undefined;
  restaurantName: string;
};

export default function SitzplanWaehlenClient({ pdfs: pdfsProp, restaurantName }: Props) {
  const pdfs = Array.isArray(pdfsProp) ? pdfsProp : [];
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {preview ? (
        <PdfPreviewModal
          url={preview.url}
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      ) : null}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
        <div className="border-b border-border pb-6 mb-8">
          <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter mb-2 flex items-center gap-3">
            <Map size={36} className="shrink-0" />
            Sitzplan
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            {restaurantName} – wählen Sie einen Plan
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6">
          {pdfs.map((pdf) => (
            <button
              key={pdf.url}
              type="button"
              onClick={() => setPreview({ url: pdf.url, title: pdf.fileName })}
              className="w-[min(100%,260px)] rounded-2xl border-2 border-[#1a3826]/20 dark:border-[#FFC72C]/30 bg-card hover:border-[#1a3826]/50 dark:hover:border-[#FFC72C]/60 shadow-md hover:shadow-xl transition-all p-8 flex flex-col items-center gap-4 min-h-[200px] justify-center"
            >
              <div className="h-16 w-16 rounded-2xl bg-[#1a3826] dark:bg-[#FFC72C] flex items-center justify-center shrink-0">
                <FileText size={32} className="text-[#FFC72C] dark:text-[#1a3826]" />
              </div>
              <span
                className="text-sm font-black text-foreground text-center line-clamp-4 px-1"
                title={pdf.fileName}
              >
                {pdf.fileName}
              </span>
              <span className="text-xs text-muted-foreground">Tippen zum Öffnen</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
