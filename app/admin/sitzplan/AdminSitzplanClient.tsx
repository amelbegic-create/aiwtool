"use client";

import { useState } from "react";
import { Upload, Trash2, FileText, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { uploadSitzplan, deleteSitzplan } from "@/app/actions/sitzplanActions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Restaurant = {
  id: string;
  code: string;
  name: string | null;
  city: string | null;
  sitzplanPdfUrl: string | null;
};

export default function AdminSitzplanClient({ restaurants }: { restaurants: Restaurant[] }) {
  const router = useRouter();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    if (!confirm("Sitzplan wirklich löschen?")) return;

    setDeletingId(restaurantId);
    try {
      await deleteSitzplan(restaurantId);
      toast.success("Sitzplan gelöscht.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Löschen.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
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
          PDF-Layouts für alle Restaurants verwalten
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
              {restaurants.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-bold text-foreground">{r.name ?? r.code}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono">{r.code}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.city ?? "—"}</td>
                  <td className="px-4 py-3">
                    {r.sitzplanPdfUrl ? (
                      <a
                        href={r.sitzplanPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[#1a3826] dark:text-[#FFC72C] hover:underline font-bold"
                      >
                        <FileText size={16} />
                        PDF anzeigen
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.sitzplanPdfUrl ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id)}
                          disabled={deletingId === r.id}
                          className="p-2 rounded-lg text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          title="Sitzplan löschen"
                        >
                          {deletingId === r.id ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Trash2 size={18} />
                          )}
                        </button>
                      ) : null}
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="application/pdf"
                          className="sr-only"
                          onChange={(e) => handleUpload(r.id, e)}
                          disabled={uploadingId === r.id}
                        />
                        <span
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                            uploadingId === r.id
                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                              : "bg-amber-500 hover:bg-amber-600 text-white"
                          }`}
                        >
                          {uploadingId === r.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Upload size={16} />
                          )}
                          Hochladen
                        </span>
                      </label>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
