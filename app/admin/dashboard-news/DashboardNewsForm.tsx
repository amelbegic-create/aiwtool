"use client";

import { useMemo, useReducer, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, FileText, Image as ImageIcon, RefreshCw, Video, UploadCloud } from "lucide-react";
import {
  createDashboardNewsItem,
  updateDashboardNewsItem,
} from "@/app/actions/dashboardNewsActions";
import { DashboardNewsAttachmentKind } from "@prisma/client";
import { GalleryFileThumb } from "@/components/admin/GalleryFileThumb";
import { resizeImageFileIfNeeded } from "@/lib/clientImageResize";

export type DashboardNewsFormInitial = {
  id: string;
  title: string;
  subtitle: string | null;
  sortOrder: number;
  isActive: boolean;
  coverImageUrl: string;
  attachmentUrl: string;
  attachmentKind: DashboardNewsAttachmentKind;
  galleryUrls: string[];
};

type GalleryState = {
  kept: Set<string>;
  newFiles: File[];
};

type GalleryAction =
  | { type: "toggleKeep"; url: string; checked: boolean }
  | { type: "addFiles"; files: File[]; max: number }
  | { type: "removeNew"; index: number }
  | { type: "replace"; url: string; file: File; max: number };

function galleryReducer(state: GalleryState, action: GalleryAction): GalleryState {
  switch (action.type) {
    case "toggleKeep": {
      const kept = new Set(state.kept);
      if (action.checked) kept.add(action.url);
      else kept.delete(action.url);
      return { ...state, kept };
    }
    case "addFiles": {
      let newFiles = [...state.newFiles, ...action.files];
      const cap = Math.max(0, action.max - state.kept.size);
      if (newFiles.length > cap) newFiles = newFiles.slice(0, cap);
      return { ...state, newFiles };
    }
    case "removeNew": {
      return {
        ...state,
        newFiles: state.newFiles.filter((_, i) => i !== action.index),
      };
    }
    case "replace": {
      if (!state.kept.has(action.url)) return state;
      const kept = new Set(state.kept);
      kept.delete(action.url);
      let newFiles = [...state.newFiles, action.file];
      const cap = Math.max(0, action.max - kept.size);
      if (newFiles.length > cap) newFiles = newFiles.slice(0, cap);
      return { kept, newFiles };
    }
    default:
      return state;
  }
}

export default function DashboardNewsForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: DashboardNewsFormInitial;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null);
  const [attachmentPreviewKind, setAttachmentPreviewKind] = useState<"pdf" | "image" | "video" | null>(null);
  const [shrinkGallery, setShrinkGallery] = useState(true);
  const [gallery, dispatch] = useReducer(
    galleryReducer,
    initial?.galleryUrls ?? [],
    (urls: string[]): GalleryState => ({
      kept: new Set(urls.filter(Boolean)),
      newFiles: [],
    })
  );

  const maxGallery = 50;
  const existingCount = initial?.galleryUrls?.length ?? 0;
  const keepCount = gallery.kept.size;
  const newCount = gallery.newFiles.length;
  const finalCount = keepCount + newCount;

  const currentCoverUrl = coverPreviewUrl ?? initial?.coverImageUrl ?? null;
  const currentAttachmentUrl = attachmentPreviewUrl ?? initial?.attachmentUrl ?? null;
  const currentAttachmentKind = useMemo(() => {
    if (attachmentPreviewKind === "pdf") return DashboardNewsAttachmentKind.PDF;
    if (attachmentPreviewKind === "video") return DashboardNewsAttachmentKind.VIDEO;
    if (attachmentPreviewKind === "image") return DashboardNewsAttachmentKind.IMAGE;
    return initial?.attachmentKind ?? null;
  }, [attachmentPreviewKind, initial?.attachmentKind]);

  function safeRevokeObjectUrl(url: string | null) {
    if (!url) return;
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }

  async function onGalleryPick(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = Array.from(e.currentTarget.files ?? []);
    e.currentTarget.value = "";
    if (raw.length === 0) return;
    const files = shrinkGallery
      ? await Promise.all(raw.map((f) => resizeImageFileIfNeeded(f)))
      : raw;
    dispatch({ type: "addFiles", files, max: maxGallery });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setError(null);
    startTransition(async () => {
      if (mode === "edit") {
        fd.delete("existingGalleryUrls");
        [...gallery.kept].forEach((url) => fd.append("existingGalleryUrls", url));
      }
      fd.delete("galleryImages");
      gallery.newFiles.forEach((f) => fd.append("galleryImages", f));
      const res =
        mode === "create" ? await createDashboardNewsItem(fd) : await updateDashboardNewsItem(initial!.id, fd);
      if (!res.ok) {
        setError(res.error ?? "Fehler beim Speichern.");
        return;
      }
      router.push("/admin/dashboard-news");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      encType="multipart/form-data"
      className="rounded-2xl md:rounded-3xl border border-border bg-card shadow-sm overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-border bg-muted/40 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Dashboard · News
          </p>
          <p className="text-sm font-black text-foreground">
            {mode === "create" ? "Neue Meldung erstellen" : "Meldung bearbeiten"}
          </p>
        </div>
        <button
          type="submit"
          disabled={pending || finalCount > maxGallery}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1a3826] px-5 py-2.5 text-sm font-black text-white shadow-lg hover:opacity-90 disabled:opacity-60"
        >
          <UploadCloud size={18} /> {pending ? "Speichern…" : "Speichern"}
        </button>
      </div>

      <div className="p-5 md:p-6 space-y-6">
        <div className="grid gap-4">
          <div>
            <label htmlFor="title" className="mb-1 block text-xs font-black uppercase text-muted-foreground">
              Titel *
            </label>
            <input
              id="title"
              name="title"
              required
              defaultValue={initial?.title ?? ""}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium"
            />
          </div>
          <div>
            <label htmlFor="subtitle" className="mb-1 block text-xs font-black uppercase text-muted-foreground">
              Untertitel
            </label>
            <input
              id="subtitle"
              name="subtitle"
              defaultValue={initial?.subtitle ?? ""}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sortOrder" className="mb-1 block text-xs font-black uppercase text-muted-foreground">
                Reihenfolge
              </label>
              <input
                id="sortOrder"
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={initial?.sortOrder ?? 0}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="isActive" className="mb-1 block text-xs font-black uppercase text-muted-foreground">
                Status
              </label>
              <select
                id="isActive"
                name="isActive"
                defaultValue={initial?.isActive === false ? "false" : "true"}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold"
              >
                <option value="true">Aktiv (sichtbar)</option>
                <option value="false">Inaktiv</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Titelbild</p>
              <p className="text-xs font-bold text-muted-foreground">{mode === "create" ? "Pflichtfeld" : "optional"}</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-border bg-muted">
                {currentCoverUrl ? (
                  <Image src={currentCoverUrl} alt="" fill className="object-cover" sizes="640px" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageIcon size={20} />
                    <span className="ml-2 text-sm font-semibold">Kein Bild</span>
                  </div>
                )}
              </div>
              <input
                id="cover"
                name="cover"
                type="file"
                accept="image/*,image/gif,.gif"
                required={mode === "create"}
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  if (!f) return;
                  safeRevokeObjectUrl(coverPreviewUrl);
                  setCoverPreviewUrl(URL.createObjectURL(f));
                }}
                className="w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-[#1a3826] file:px-4 file:py-2.5 file:text-xs file:font-black file:text-[#FFC72C]"
              />
              <p className="text-xs text-muted-foreground">JPG/PNG/WebP/GIF. Empfohlen: \(16:9\).</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Anhang</p>
              <p className="text-xs font-bold text-muted-foreground">{mode === "create" ? "Pflichtfeld" : "optional"}</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-border bg-muted flex items-center justify-center">
                {currentAttachmentUrl && currentAttachmentKind === DashboardNewsAttachmentKind.IMAGE ? (
                  <Image src={currentAttachmentUrl} alt="" fill className="object-cover" sizes="640px" unoptimized />
                ) : currentAttachmentUrl && currentAttachmentKind === DashboardNewsAttachmentKind.VIDEO ? (
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <Video size={18} /> Video ausgewählt
                  </div>
                ) : currentAttachmentUrl && currentAttachmentKind === DashboardNewsAttachmentKind.PDF ? (
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <FileText size={18} /> PDF ausgewählt
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <FileText size={18} /> Kein Anhang
                  </div>
                )}
              </div>
              <input
                id="attachment"
                name="attachment"
                type="file"
                accept="application/pdf,image/*,image/gif,.gif,video/*"
                required={mode === "create"}
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  if (!f) return;
                  const t = (f.type || "").toLowerCase();
                  const name = (f.name || "").toLowerCase();
                  if (t === "application/pdf" || name.endsWith(".pdf")) setAttachmentPreviewKind("pdf");
                  else if (t.startsWith("video/")) setAttachmentPreviewKind("video");
                  else setAttachmentPreviewKind("image");
                  safeRevokeObjectUrl(attachmentPreviewUrl);
                  setAttachmentPreviewUrl(URL.createObjectURL(f));
                }}
                className="w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-[#1a3826] file:px-4 file:py-2.5 file:text-xs file:font-black file:text-[#FFC72C]"
              />
              <p className="text-xs text-muted-foreground">
                PDF/Bild/GIF (bis 10 MB) oder Video (bis 200 MB).
                {mode === "edit" && initial?.attachmentUrl ? (
                  <>
                    {" "}
                    Aktuell:{" "}
                    <a
                      href={initial.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold underline text-[#1a3826] dark:text-[#FFC72C]"
                    >
                      öffnen
                    </a>
                    .
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/40 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Galerie (optional)</p>
              <p className="text-xs text-muted-foreground">
                Bis zu 50 zusätzliche Bilder im Popup; Häkchen = behalten, „Ersetzen“ = Datei tauschen
              </p>
            </div>
            <p
              className={`text-xs font-black ${finalCount > maxGallery ? "text-destructive" : "text-muted-foreground"}`}
            >
              {finalCount} / {maxGallery}
            </p>
          </div>
          <div className="p-4 space-y-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={shrinkGallery}
                onChange={(e) => setShrinkGallery(e.currentTarget.checked)}
                className="h-4 w-4 accent-[#1a3826]"
              />
              Große Bilder vor Upload auf max. 1920 px Breite verkleinern (GIF bleibt unverändert)
            </label>
            <input
              id="newsGalleryPick"
              type="file"
              accept="image/*,image/gif,.gif"
              multiple
              onChange={onGalleryPick}
              className="w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-[#1a3826] file:px-4 file:py-2.5 file:text-xs file:font-black file:text-[#FFC72C]"
            />
            <p className="text-xs text-muted-foreground">
              Mehrfach hinzufügen möglich. {mode === "edit" ? `Vorher: ${existingCount}, Behalten: ${keepCount}, Neu: ${newCount}.` : null}
            </p>

            {mode === "edit" && (initial?.galleryUrls?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Bestehende Galeriebilder</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {(initial?.galleryUrls ?? []).map((url, idx) => {
                    const kept = gallery.kept.has(url);
                    return (
                      <div
                        key={url}
                        className={`group relative overflow-hidden rounded-xl border ${kept ? "border-[#1a3826]/40" : "border-border opacity-60"} bg-muted`}
                      >
                        <label className="block cursor-pointer">
                          <input
                            type="checkbox"
                            className="absolute top-2 left-2 z-10 h-4 w-4 accent-[#1a3826]"
                            checked={kept}
                            onChange={(e) => {
                              const checked = e.currentTarget.checked;
                              dispatch({ type: "toggleKeep", url, checked });
                            }}
                          />
                          <div className="relative aspect-square w-full">
                            <Image src={url} alt="" fill className="object-cover" sizes="160px" unoptimized />
                          </div>
                        </label>
                        {kept ? (
                          <>
                            <input
                              type="file"
                              id={`news-gallery-replace-${idx}`}
                              className="sr-only"
                              accept="image/*,image/gif,.gif"
                              tabIndex={-1}
                              onChange={async (e) => {
                                const f = e.currentTarget.files?.[0];
                                e.currentTarget.value = "";
                                if (!f) return;
                                const file = shrinkGallery ? await resizeImageFileIfNeeded(f) : f;
                                dispatch({ type: "replace", url, file, max: maxGallery });
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => document.getElementById(`news-gallery-replace-${idx}`)?.click()}
                              className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1 rounded-lg bg-black/65 px-1.5 py-1 text-[10px] font-black uppercase text-white opacity-0 transition hover:bg-black/80 group-hover:opacity-100"
                            >
                              <RefreshCw size={12} /> Ersetzen
                            </button>
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {gallery.newFiles.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Neue Galerie-Dateien</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {gallery.newFiles.map((file, i) => (
                    <GalleryFileThumb
                      key={`${file.name}-${file.size}-${file.lastModified}-${i}`}
                      file={file}
                      onRemove={() => dispatch({ type: "removeNew", index: i })}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {finalCount > maxGallery ? (
          <p className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
            Zu viele Galeriebilder. Maximum ist {maxGallery}.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Link
            href="/admin/dashboard-news"
            className="inline-flex items-center rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={pending || finalCount > maxGallery}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1a3826] px-6 py-3 text-sm font-black text-white shadow-lg hover:opacity-90 disabled:opacity-60"
          >
            <UploadCloud size={18} /> {pending ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function DashboardNewsFormShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10 space-y-6 md:space-y-8">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-border pb-5">
          <div>
            <Link
              href="/admin/dashboard-news"
              className="mb-2 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-[#1a3826] dark:hover:text-[#FFC72C]"
            >
              <ArrowLeft size={16} aria-hidden /> Zurück zur Liste
            </Link>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase text-[#1a3826]">
              {title.split(" ")[0]} <span className="text-[#FFC72C]">{title.split(" ").slice(1).join(" ")}</span>
            </h1>
            <p className="mt-2 text-sm font-medium text-muted-foreground max-w-2xl">{description}</p>
          </div>
        </header>

        <section className="max-w-5xl">{children}</section>
      </div>
    </div>
  );
}
