"use client";

import { useState } from "react";
import { Upload, Trash2, FileText, Loader2, ArrowLeft, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { uploadSitzplan, deleteSitzplan } from "@/app/actions/sitzplanActions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import PdfPreviewModal from "@/components/sitzplan/PdfPreviewModal";
import { SITZPLAN_MAX_FILES, type SitzplanPdfEntry } from "@/lib/sitzplanUrls";

type Restaurant = {
  id: string;
  code: string;
  name: string | null;
  city: string | null;
  sitzplanPdfs: SitzplanPdfEntry[];
};

export default function AdminSitzplanClient({ restaurants }: { restaurants: Restaurant[] }) {
  const router = useRouter();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  const handleUpload = async (restaurantId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Bitte nur PDF-Dateien hochladen.");
      return;
    }

    setUploadingId(restaurantId);
    const formData = new FormData();
    formData.append("file", file);

    try {
      await uploadSitzplan(restaurantId, formData);
      toast.success("Sitzplan erfolgreich hochgeladen.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Hochladen.");
    } finally {
      setUploadingId(null);
      e.target.value = "";
    }
  };

  const handleDelete = async (restaurantId: string) => {
    if (!confirm("Alle Sitzplan-PDFs wirklich löschen?")) return;

    setDeletingId(restaurantId);
    try {
      await deleteSitzplan(restaurantId);
      toast.success("Sitzpläne gelöscht.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Löschen.");
    } finally {
      setDeletingId(null);
    }
  };

  const countBadgeClass =
    "inline-flex items-center justify-center rounded-lg bg-[#1a3826] dark:bg-[#1a3826] px-2.5 py-1 text-xs font-black text-[#FFC72C] tabular-nums shadow-sm border border-[#FFC72C]/30 min-w-[2.75rem]";

  /** Zeleno / žuto (McDonald’s brand) – upload u Aktionen */
  const uploadBtnBase =
    "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-opacity border border-[#FFC72C]/40 bg-[#1a3826] text-[#FFC72C] hover:opacity-90 [&_svg]:text-[#FFC72C]";
  const uploadBtnLoading =
    "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-[#1a3826]/85 text-[#FFC72C] border border-[#FFC72C]/30";
  const uploadBtnDisabled = "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-muted text-muted-foreground border border-border cursor-not-allowed";
  const uploadLinkSecondary =
    "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-[#1a3826] text-[#FFC72C] border border-[#FFC72C]/40 hover:opacity-90 transition-opacity [&_svg]:text-[#FFC72C]";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
      {preview ? (
        <PdfPreviewModal
          url={preview.url}
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      ) : null}

      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-bold">Zurück</span>
        </Link>
      </div>

      <div className="border-b border-border pb-6 mb-8">
        <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter mb-2">
          Sitzplan
        </h1>
        <p className="text-muted-foreground text-sm font-medium">
          PDF-Layouts für alle Restaurants verwalten (bis zu {SITZPLAN_MAX_FILES} PDFs pro Restaurant)
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-black text-foreground">Restaurant</th>
                <th className="text-left px-4 py-3 font-black text-foreground">Code</th>
                <th className="text-left px-4 py-3 font-black text-foreground">Stadt</th>
                <th className="text-left px-4 py-3 font-black text-foreground">Sitzplan</th>
                <th className="text-right px-4 py-3 font-black text-foreground">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map((r) => {
                const pdfs = r.sitzplanPdfs;
                const n = pdfs.length;
                const atMax = n >= SITZPLAN_MAX_FILES;
                /** Upload u tablici samo za 0 ili 1 PDF; od 2. dalje – na stranici s karticama */
                const showTableUpload = n < 2;

                return (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-bold text-foreground">{r.name ?? r.code}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono">{r.code}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.city ?? "—"}</td>
                    <td className="px-4 py-3">
                      {n === 0 ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : n === 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPreview({
                              url: pdfs[0].url,
                              title: pdfs[0].fileName,
                            })
                          }
                          className="inline-flex items-center gap-2 text-left text-[#1a3826] dark:text-[#FFC72C] hover:underline font-bold"
                          title={pdfs[0].fileName}
                        >
                          <FileText size={16} className="shrink-0" />
                          PDF anzeigen
                        </button>
                      ) : (
                        <Link
                          href={`/admin/sitzplan/${r.id}`}
                          className="inline-flex items-center gap-2 text-[#1a3826] dark:text-[#FFC72C] hover:underline font-bold"
                          title={`${n} Pläne`}
                        >
                          <LayoutGrid size={16} className="shrink-0" />
                          {n} Pläne anzeigen
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
                        {n > 0 ? (
                          <span className={countBadgeClass} title={`${n} von ${SITZPLAN_MAX_FILES} PDFs`}>
                            {n}/{SITZPLAN_MAX_FILES}
                          </span>
                        ) : null}
                        <div className="flex items-center justify-end gap-2">
                          {n > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleDelete(r.id)}
                              disabled={deletingId === r.id}
                              className="p-2 rounded-lg text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                              title="Alle Sitzpläne löschen"
                            >
                              {deletingId === r.id ? (
                                <Loader2 size={18} className="animate-spin" />
                              ) : (
                                <Trash2 size={18} />
                              )}
                            </button>
                          ) : null}
                          {showTableUpload ? (
                            <label className={atMax ? "cursor-not-allowed opacity-50" : "cursor-pointer"}>
                              <input
                                type="file"
                                accept="application/pdf"
                                className="sr-only"
                                onChange={(e) => handleUpload(r.id, e)}
                                disabled={uploadingId === r.id || atMax}
                              />
                              <span
                                className={
                                  uploadingId === r.id
                                    ? uploadBtnLoading
                                    : atMax
                                      ? uploadBtnDisabled
                                      : uploadBtnBase
                                }
                                title={atMax ? `Maximum ${SITZPLAN_MAX_FILES} PDFs` : undefined}
                              >
                                {uploadingId === r.id ? (
                                  <Loader2 size={16} className="animate-spin text-[#FFC72C]" />
                                ) : (
                                  <Upload size={16} />
                                )}
                                Hochladen
                              </span>
                            </label>
                          ) : (
                            <Link href={`/admin/sitzplan/${r.id}`} className={uploadLinkSecondary}>
                              <Upload size={14} />
                              PDF hinzufügen
                            </Link>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
