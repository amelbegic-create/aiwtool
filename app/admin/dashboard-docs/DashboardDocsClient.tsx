"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UploadCloud, FileText, CheckCircle2, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { upload } from "@vercel/blob/client";
import PdfPreviewModal from "@/components/sitzplan/PdfPreviewModal";
import {
  deletePinnedDoc,
  updatePinnedDocMetadata,
  type DashboardPinnedDocPublic,
} from "@/app/actions/dashboardPinnedDocsActions";

function isPdf(file: File | null | undefined) {
  if (!file) return false;
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return type === "application/pdf" || name.endsWith(".pdf") || type.endsWith("/pdf");
}

export default function DashboardDocsClient({ initial }: { initial: DashboardPinnedDocPublic[] }) {
  const [preview, setPreview] = useState<{ title: string; url: string } | null>(null);
  /** Per-document save in flight so cards stay independent. */
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const fileInputRefs = useRef(new Map<string, HTMLInputElement>());
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [savedTitles, setSavedTitles] = useState<Record<string, string>>({});
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [stagedFile, setStagedFile] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t: Record<string, string> = {};
    const st: Record<string, string> = {};
    const u: Record<string, string | null> = {};
    const sf: Record<string, boolean> = {};
    for (const d of initial) {
      t[d.id] = d.title;
      st[d.id] = d.title;
      u[d.id] = d.pdfUrl ?? null;
      sf[d.id] = false;
    }
    setTitles(t);
    setSavedTitles(st);
    setUrls(u);
    setStagedFile(sf);
  }, [initial]);

  const cards = useMemo(() => {
    return initial.map((d, idx) => ({
      id: d.id,
      key: d.key,
      label: `Document ${idx + 1}`,
      title: titles[d.id] ?? d.title,
      savedTitle: savedTitles[d.id] ?? d.title,
      url: urls[d.id] ?? d.pdfUrl ?? null,
      staged: stagedFile[d.id] ?? false,
    }));
  }, [initial, savedTitles, titles, urls, stagedFile]);

  const setTitle = (id: string, v: string) => setTitles((p) => ({ ...p, [id]: v }));

  const onDelete = async (docId: string) => {
    if (pending[docId]) return;
    if (!confirm("Delete this document?")) return;
    setPending((p) => ({ ...p, [docId]: true }));
    try {
      const r = await deletePinnedDoc(docId);
      if (!r.ok) {
        toast.error(r.error ?? "Error.");
        return;
      }
      toast.success("Deleted.");
      window.location.reload();
    } finally {
      setPending((p) => ({ ...p, [docId]: false }));
    }
  };

  const saveOne = async (docId: string, docKey: string, currentTitle: string) => {
    if (pending[docId]) return;
    const cleanTitle = String(currentTitle ?? "").trim();
    if (!cleanTitle) {
      toast.error("Title is required.");
      return;
    }

    const input = fileInputRefs.current.get(docId) ?? null;
    const f = input?.files?.[0] ?? null;
    if (f && !isPdf(f)) {
      toast.error("Only PDF files are allowed.");
      return;
    }
    if (f && f.size > 50 * 1024 * 1024) {
      toast.error("PDF: max. 50 MB.");
      return;
    }

    const dirty = cleanTitle !== (savedTitles[docId] ?? "").trim();
    if (!dirty && !f) {
      toast.message("Nothing to save.", { description: "Change the title, choose a PDF, or both." });
      return;
    }

    setPending((p) => ({ ...p, [docId]: true }));
    try {
      let pdfUrl: string | null | undefined = undefined;
      if (f) {
        const safeName = (f.name || "document.pdf").replace(/\s+/g, "_");
        const pathname = `dashboard-docs/${docKey}-${Date.now()}-${safeName}`;
        const blob = await upload(pathname, f, {
          access: "public",
          handleUploadUrl: "/api/blob/dashboard-doc",
          multipart: true,
        });
        pdfUrl = blob.url;
      }

      const r = await updatePinnedDocMetadata({ docId, title: cleanTitle, pdfUrl });
      if (!r.ok) {
        toast.error(r.error ?? "Could not save.");
        return;
      }

      toast.success("Saved.");
      if (r.doc) {
        setSavedTitles((p) => ({ ...p, [docId]: r.doc!.title }));
        setUrls((p) => ({ ...p, [docId]: r.doc!.pdfUrl ?? p[docId] ?? null }));
      } else {
        setSavedTitles((p) => ({ ...p, [docId]: cleanTitle }));
      }
      setStagedFile((p) => ({ ...p, [docId]: false }));
      if (input) input.value = "";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setPending((p) => ({ ...p, [docId]: false }));
    }
  };

  return (
    <>
      {initial.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            No documents yet. Use <span className="font-semibold text-foreground">Add</span> above to create one.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {cards.map((c) => {
            const dirtyTitle = c.title.trim() !== c.savedTitle.trim();
            const canSave = dirtyTitle || c.staged;
            const savedAndSynced = !dirtyTitle && !c.staged && !!c.url;
            const saving = !!pending[c.id];

            return (
              <article
                key={c.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]"
              >
                <header className="flex items-start justify-between gap-3 border-b border-border bg-muted/30 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {c.label}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{c.title || "—"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onDelete(c.id)}
                    disabled={saving}
                    className="shrink-0 rounded-xl border border-border bg-background/80 p-2.5 text-muted-foreground transition hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive disabled:opacity-40"
                    title="Delete document"
                    aria-label="Delete document"
                  >
                    <Trash2 size={18} />
                  </button>
                </header>

                <div className="flex flex-1 flex-col gap-4 p-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor={`title-${c.id}`}>
                      Title
                    </label>
                    <input
                      id={`title-${c.id}`}
                      value={c.title}
                      onChange={(e) => setTitle(c.id, e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none ring-offset-background transition focus:border-[#1a3826]/50 focus:ring-2 focus:ring-[#1a3826]/20"
                      placeholder="Document title"
                      autoComplete="off"
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">PDF file</span>
                    <input
                      ref={(el) => {
                        if (el) fileInputRefs.current.set(c.id, el);
                        else fileInputRefs.current.delete(c.id);
                      }}
                      type="file"
                      accept="application/pdf"
                      disabled={saving}
                      onChange={(e) => {
                        const has = !!(e.target.files?.length && e.target.files[0]);
                        setStagedFile((p) => ({ ...p, [c.id]: has }));
                      }}
                      className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#1a3826] file:px-4 file:py-2.5 file:text-xs file:font-semibold file:text-[#FFC72C] disabled:opacity-50"
                    />
                  </div>

                  {/* Single primary control: save + optional upload */}
                  <div className="mt-auto space-y-3 pt-1">
                    {savedAndSynced ? (
                      <button
                        type="button"
                        disabled
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 py-3 text-sm font-semibold text-emerald-800 dark:text-emerald-200"
                      >
                        <CheckCircle2 size={18} className="shrink-0" />
                        Saved
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void saveOne(c.id, c.key, c.title)}
                        disabled={saving || !canSave}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a3826] py-3 text-sm font-black uppercase tracking-wide text-[#FFC72C] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            Saving…
                          </>
                        ) : (
                          <>
                            <UploadCloud size={18} />
                            Save / Upload
                          </>
                        )}
                      </button>
                    )}

                    {c.url ? (
                      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
                        <button
                          type="button"
                          onClick={() => setPreview({ title: c.title, url: c.url! })}
                          className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
                        >
                          <FileText size={16} />
                          Open PDF
                        </button>
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        >
                          Open in new tab
                        </a>
                      </div>
                    ) : (
                      <p className="border-t border-border pt-3 text-xs text-muted-foreground">No PDF uploaded yet.</p>
                    )}

                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      PDF max. 50 MB. Upload goes directly to storage (more stable).
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {preview && (
        <PdfPreviewModal url={preview.url} title={preview.title} onClose={() => setPreview(null)} />
      )}
    </>
  );
}
