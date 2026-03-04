"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Award, FileText, Plus, Loader2, Trash2, Pencil, X } from "lucide-react";
import {
  createCertificate,
  deleteCertificate,
  getCertificatesForUser,
  updateCertificate,
  type UserCertificateDto,
} from "@/app/actions/certificateActions";

type CertificatesAdminUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  department: string | null;
  departmentColor: string | null;
  restaurants: { id: string; name: string | null; code: string }[];
  certificatesCount: number;
};

interface CertificatesAdminClientProps {
  users: CertificatesAdminUser[];
}

export default function CertificatesAdminClient({ users }: CertificatesAdminClientProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    users.length > 0 ? users[0].id : null
  );
  const [loading, setLoading] = useState(false);
  const [certificates, setCertificates] = useState<UserCertificateDto[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfLabel, setPdfLabel] = useState<string>("Kein PDF ausgewählt");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageLabel, setImageLabel] = useState<string>("Kein Bild ausgewählt");
  const [submitting, setSubmitting] = useState(false);

  const [preview, setPreview] = useState<{
    type: "pdf" | "image";
    url: string;
    name: string;
  } | null>(null);

  const activeUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || null,
    [users, selectedUserId]
  );

  useEffect(() => {
    if (!selectedUserId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await getCertificatesForUser(selectedUserId);
        if (!cancelled) {
          if (res.ok) {
            setCertificates(res.data);
          } else {
            toast.error(res.error);
            setCertificates([]);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [selectedUserId]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setPdfFile(null);
    setPdfLabel("Kein PDF ausgewählt");
    setImageFile(null);
    setImageLabel("Kein Bild ausgewählt");
  };

  const handleSelectUser = (id: string | null) => {
    setSelectedUserId(id);
    setCertificates([]);
    resetForm();
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setPdfFile(null);
      setPdfLabel("Kein PDF ausgewählt");
      return;
    }

    const maxBytes = 10 * 1024 * 1024;
    const type = file.type || "";
    const isPdf = type === "application/pdf" || type.endsWith("/pdf");

    if (!isPdf) {
      toast.error("Bitte nur PDF-Dateien auswählen.");
      e.target.value = "";
      setPdfFile(null);
      setPdfLabel("Kein PDF ausgewählt");
      return;
    }

    if (file.size > maxBytes) {
      toast.error("Die PDF-Datei ist zu groß (max. 10 MB).");
      e.target.value = "";
      setPdfFile(null);
      setPdfLabel("Kein PDF ausgewählt");
      return;
    }

    e.target.value = "";
    setPdfFile(file);
    setPdfLabel(file.name);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setImageFile(null);
      setImageLabel("Kein Bild ausgewählt");
      return;
    }

    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error("Das Bild ist zu groß (max. 10 MB).");
      e.target.value = "";
      setImageFile(null);
      setImageLabel("Kein Bild ausgewählt");
      return;
    }
    const type = file.type || "";
    if (!type.startsWith("image/")) {
      toast.error("Bitte nur Bilddateien auswählen.");
      e.target.value = "";
      setImageFile(null);
      setImageLabel("Kein Bild ausgewählt");
      return;
    }

    e.target.value = "";
    setImageFile(file);
    setImageLabel(file.name);
  };

  const startEdit = (cert: UserCertificateDto) => {
    setEditingId(cert.id);
    setTitle(cert.title);
    setDescription(cert.description);
    setPdfFile(null);
    setPdfLabel(cert.pdfName ? `Aktuell: ${cert.pdfName}` : "Kein PDF ausgewählt");
    setImageFile(null);
    setImageLabel(cert.imageName ? `Aktuell: ${cert.imageName}` : "Kein Bild ausgewählt");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Titel ist erforderlich.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("title", trimmedTitle);
      formData.set("description", description.trim());

      if (pdfFile) {
        formData.set("pdf", pdfFile);
      }
      if (imageFile) {
        formData.set("image", imageFile);
      }

      let ok = false;
      let error: string | undefined;

      if (editingId) {
        formData.set("id", editingId);
        const res = await updateCertificate(formData);
        ok = res.ok;
        error = res.error;
      } else {
        formData.set("userId", selectedUserId);
        const res = await createCertificate(formData);
        ok = res.ok;
        error = res.error;
      }

      if (ok) {
        toast.success("Gespeichert.");
        resetForm();
        const refreshed = await getCertificatesForUser(selectedUserId);
        if (refreshed.ok) {
          setCertificates(refreshed.data);
        }
      } else if (error) {
        toast.error(error);
      } else {
        toast.error("Unbekannter Fehler beim Speichern.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!selectedUserId) return;
    if (!confirm("Dieses Zertifikat wirklich löschen?")) return;
    setSubmitting(true);
    try {
      const res = await deleteCertificate(id);
      if (res.ok) {
        toast.success("Zertifikat gelöscht.");
        const refreshed = await getCertificatesForUser(selectedUserId);
        if (refreshed.ok) {
          setCertificates(refreshed.data);
        }
      } else {
        toast.error(res.error ?? "Fehler beim Löschen.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 flex flex-col gap-4">
      <header className="flex flex-col gap-4 border-b border-slate-100 pb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#1a3826] uppercase tracking-tight flex items-center gap-2">
              <Award size={20} className="text-[#FFC72C]" />
              Mitarbeiter-Zertifikate
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kurse, Schulungen und Zertifikate einer Person als moderne Timeline.
            </p>
          </div>
          {activeUser && (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#1a3826] text-white flex items-center justify-center text-sm font-bold overflow-hidden">
                {activeUser.image ? (
                  <Image
                    src={activeUser.image}
                    alt=""
                    width={40}
                    height={40}
                    className="object-cover"
                  />
                ) : (
                  (activeUser.name || "?").charAt(0)
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {activeUser.name}
                </p>
                <p className="text-xs text-slate-500 truncate">{activeUser.email}</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Mitarbeiter auswählen
          </label>
          <select
            value={selectedUserId ?? ""}
            onChange={(e) => handleSelectUser(e.target.value || null)}
            className="mt-1 sm:mt-0 w-full sm:max-w-xs px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3826]"
          >
            {users.length === 0 && <option value="">Keine Mitarbeiter vorhanden</option>}
            {users.length > 0 && (
              <>
                <option value="">— Bitte auswählen —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
      </header>

      {!activeUser ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
          Bitte oben einen Mitarbeiter auswählen.
        </div>
      ) : (
        <>
            <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {editingId ? "Zertifikat bearbeiten" : "Neues Zertifikat hinzufügen"}
                </p>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Abbrechen
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Titel
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="z. B. Ersthelferkurs, Hygieneschulung…"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3826]"
                    disabled={submitting}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    PDF (optional)
                  </label>
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-xs text-slate-600 bg-white hover:border-[#1a3826] cursor-pointer">
                    <FileText size={14} className="text-slate-500" />
                    <span className="truncate">{pdfLabel}</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handlePdfChange}
                      disabled={submitting}
                    />
                  </label>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Bild (optional)
                  </label>
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-xs text-slate-600 bg-white hover:border-[#1a3826] cursor-pointer">
                    <FileText size={14} className="text-slate-500" />
                    <span className="truncate">{imageLabel}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                      disabled={submitting}
                    />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Beschreibung
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Kurzbeschreibung des Kurses oder der Schulung, Inhalte, Dauer, Anbieter…"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3826] resize-y"
                  disabled={submitting}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || !title.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-[#1a3826] text-white hover:bg-[#142d1f] disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Speichern…
                    </>
                  ) : (
                    <>
                      {editingId ? <Pencil size={14} /> : <Plus size={14} />}
                      {editingId ? "Aktualisieren" : "Zertifikat speichern"}
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="flex-1 space-y-3 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-6 text-slate-500 text-sm">
                  <Loader2 size={20} className="animate-spin mr-2" />
                  Zertifikate werden geladen…
                </div>
              ) : certificates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-sm text-slate-500 text-center">
                  Noch keine Zertifikate hinterlegt. Füge oben das erste Zertifikat hinzu.
                </div>
              ) : (
                <div className="space-y-3">
                  {certificates.map((cert) => (
                    <article
                      key={cert.id}
                      className="relative rounded-2xl border border-slate-200 bg-white/80 p-4 flex flex-col sm:flex-row sm:items-start gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">
                            {cert.title}
                          </h3>
                          <span className="text-[11px] text-slate-500">
                            {new Date(cert.createdAt).toLocaleDateString("de-DE", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </span>
                          {cert.pdfUrl && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-semibold">
                              <FileText size={12} />
                              PDF
                            </span>
                          )}
                        </div>
                        {cert.description && (
                          <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap">
                            {cert.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          {cert.pdfUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setPreview({
                                  type: "pdf",
                                  url: cert.pdfUrl!,
                                  name: cert.pdfName || cert.title,
                                })
                              }
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1a3826] hover:underline"
                            >
                              <FileText size={14} />
                              {cert.pdfName || "PDF öffnen"}
                            </button>
                          )}
                          {cert.imageUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setPreview({
                                  type: "image",
                                  url: cert.imageUrl!,
                                  name: cert.imageName || cert.title,
                                })
                              }
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1a3826] hover:underline"
                            >
                              <FileText size={14} />
                              {cert.imageName || "Bild öffnen"}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-start">
                        <button
                          type="button"
                          onClick={() => startEdit(cert)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          title="Bearbeiten"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cert.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                          title="Löschen"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
      )}
    </section>

    {preview && (
      <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{preview.name}</p>
              <p className="text-[11px] text-slate-500">
                {preview.type === "pdf" ? "PDF-Vorschau" : "Bildvorschau"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="ml-3 inline-flex items-center justify-center h-9 w-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
              aria-label="Schließen"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 bg-slate-50 flex items-center justify-center">
            {preview.type === "pdf" ? (
              <iframe
                src={preview.url}
                title={preview.name}
                className="w-full h-[70vh] border-0 bg-white"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.url}
                alt={preview.name}
                className="max-h-[70vh] max-w-full object-contain"
              />
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

