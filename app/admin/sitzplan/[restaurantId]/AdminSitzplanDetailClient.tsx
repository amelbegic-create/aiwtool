"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Loader2, Trash2, Upload } from "lucide-react";
import PdfPreviewModal from "@/components/sitzplan/PdfPreviewModal";
import { uploadSitzplan, deleteSitzplanAt } from "@/app/actions/sitzplanActions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { SITZPLAN_MAX_FILES, type SitzplanPdfEntry } from "@/lib/sitzplanUrls";

type Props = {
  restaurantId: string;
  restaurantLabel: string;
  pdfs: SitzplanPdfEntry[];
};

export default function AdminSitzplanDetailClient({ restaurantId, restaurantLabel, pdfs }: Props) {
  const router = useRouter();
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const n = pdfs.length;
  const atMax = n >= SITZPLAN_MAX_FILES;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Bitte nur PDF-Dateien hochladen.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      await uploadSitzplan(restaurantId, formData);
      toast.success("Sitzplan erfolgreich hochgeladen.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Hochladen.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (index: number) => {
    if (!confirm("Dieses PDF wirklich löschen?")) return;
    setDeletingIndex(index);
    try {
      await deleteSitzplanAt(restaurantId, index);
      toast.success("PDF gelöscht.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Löschen.");
    } finally {
      setDeletingIndex(null);
    }
  };

  const countBadgeClass =
    "inline-flex items-center justify-center rounded-lg bg-[#1a3826] px-2.5 py-1 text-xs font-black text-[#FFC72C] tabular-nums shadow-sm border border-[#FFC72C]/30";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
      {preview ? (
        <PdfPreviewModal
          url={preview.url}
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      ) : null}

      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/sitzplan"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-bold">Zurück zur Übersicht</span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h1 className="text-3xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter">
          Sitzpläne – {restaurantLabel}
        </h1>
        <span className={countBadgeClass}>
          {n}/{SITZPLAN_MAX_FILES}
        </span>
      </div>
      <p className="text-muted-foreground text-sm font-medium mb-8">
        Karte anklicken für Vorschau (Dateiname wie beim Upload). PDFs einzeln löschen oder weiteres PDF
        hinzufügen.
      </p>

      <div className="flex flex-wrap justify-center gap-6">
        {pdfs.map((pdf, index) => (
          <div
            key={`${pdf.url}-${index}`}
            className="flex flex-col items-center gap-3 w-[min(100%,260px)]"
          >
            <button
              type="button"
              onClick={() => setPreview({ url: pdf.url, title: pdf.fileName })}
              className="w-full rounded-2xl border-2 border-[#1a3826]/20 dark:border-[#FFC72C]/30 bg-card hover:border-[#1a3826]/50 dark:hover:border-[#FFC72C]/60 shadow-md hover:shadow-xl transition-all p-6 flex flex-col items-center gap-3 min-h-[160px] justify-center"
            >
              <div className="h-14 w-14 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] flex items-center justify-center shrink-0">
                <FileText size={28} className="text-[#FFC72C] dark:text-[#1a3826]" />
              </div>
              <span
                className="text-sm font-black text-foreground text-center line-clamp-3 px-1"
                title={pdf.fileName}
              >
                {pdf.fileName}
              </span>
              <span className="text-xs text-muted-foreground">PDF öffnen</span>
            </button>
            <button
              type="button"
              onClick={() => handleDelete(index)}
              disabled={deletingIndex === index}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:underline disabled:opacity-50"
            >
              {deletingIndex === index ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              Löschen
            </button>
          </div>
        ))}
      </div>

      {!atMax ? (
        <div className="mt-10 flex justify-center">
          <label
            className={`cursor-pointer ${uploading ? "opacity-70 pointer-events-none" : ""}`}
          >
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={handleUpload}
              disabled={uploading}
            />
            <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#1a3826] text-[#FFC72C] border border-[#FFC72C]/40 hover:opacity-90 transition-opacity [&_svg]:text-[#FFC72C]">
              {uploading ? (
                <Loader2 size={18} className="animate-spin text-[#FFC72C]" />
              ) : (
                <Upload size={18} />
              )}
              Weiteres PDF hochladen
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}
