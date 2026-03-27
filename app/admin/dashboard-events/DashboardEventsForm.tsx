"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Image as ImageIcon, UploadCloud, Video } from "lucide-react";
import {
  createDashboardEventItem,
  updateDashboardEventItem,
} from "@/app/actions/dashboardEventActions";

export type DashboardEventFormInitial = {
  id: string;
  title: string;
  subtitle: string | null;
  sortOrder: number;
  isActive: boolean;
  coverImageUrl: string;
  galleryUrls: string[];
  videoUrl: string | null;
};

export default function DashboardEventsForm({ mode, initial }: { mode: "create" | "edit"; initial?: DashboardEventFormInitial; }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [newGalleryPreviews, setNewGalleryPreviews] = useState<string[]>([]);
  const [keepExisting, setKeepExisting] = useState<Set<string>>(
    new Set((initial?.galleryUrls ?? []).filter(Boolean))
  );
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  const maxGallery = 50;
  const existingCount = initial?.galleryUrls?.length ?? 0;
  const keepCount = keepExisting.size;
  const newCount = newGalleryPreviews.length;
  const finalCount = keepCount + newCount;

  const currentCoverUrl = coverPreviewUrl ?? initial?.coverImageUrl ?? null;
  const currentVideoUrl = videoPreviewUrl ?? initial?.videoUrl ?? null;

  function safeRevokeObjectUrl(url: string | null) {
    if (!url) return;
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const fd = new FormData(formEl);
    setError(null);
    startTransition(async () => {
      // existingGalleryUrls should reflect toggles
      if (mode === "edit") {
        fd.delete("existingGalleryUrls");
        [...keepExisting].forEach((url) => fd.append("existingGalleryUrls", url));
      }
      const res = mode === "create" ? await createDashboardEventItem(fd) : await updateDashboardEventItem(initial!.id, fd);
      if (!res.ok) {
        setError(res.error ?? "Fehler beim Speichern.");
        return;
      }
      router.push("/admin/dashboard-events");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} encType="multipart/form-data" className="rounded-2xl md:rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/40 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Dashboard · Events
          </p>
          <p className="text-sm font-black text-foreground">
            {mode === "create" ? "Neues Event erstellen" : "Event bearbeiten"}
          </p>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1a3826] px-5 py-2.5 text-sm font-black text-white shadow-lg hover:opacity-90 disabled:opacity-60"
        >
          <UploadCloud size={18} /> {pending ? "Speichern…" : "Speichern"}
        </button>
      </div>

      <div className="p-5 md:p-6 space-y-6">
        <div className="grid gap-4">
          <div>
            <label htmlFor="title" className="mb-1 block text-xs font-black uppercase text-muted-foreground">Titel *</label>
            <input id="title" name="title" required defaultValue={initial?.title ?? ""} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium" />
          </div>
          <div>
            <label htmlFor="subtitle" className="mb-1 block text-xs font-black uppercase text-muted-foreground">Untertitel</label>
            <input id="subtitle" name="subtitle" defaultValue={initial?.subtitle ?? ""} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sortOrder" className="mb-1 block text-xs font-black uppercase text-muted-foreground">Reihenfolge</label>
              <input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={initial?.sortOrder ?? 0} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium tabular-nums" />
            </div>
            <div>
              <label htmlFor="isActive" className="mb-1 block text-xs font-black uppercase text-muted-foreground">Status</label>
              <select id="isActive" name="isActive" defaultValue={initial?.isActive === false ? "false" : "true"} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold">
                <option value="true">Aktiv (sichtbar)</option>
                <option value="false">Inaktiv</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Cover</p>
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
              {mode === "edit" && initial?.coverImageUrl ? (
                <p className="text-xs text-muted-foreground">
                  Aktuell:{" "}
                  <a href={initial.coverImageUrl} className="font-bold underline text-[#1a3826] dark:text-[#FFC72C]" target="_blank" rel="noreferrer">
                    öffnen
                  </a>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">JPG/PNG/WebP/GIF. Empfohlen: \(16:9\).</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Video</p>
              <p className="text-xs font-bold text-muted-foreground">optional (bis 200 MB)</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-border bg-muted flex items-center justify-center">
                {currentVideoUrl ? (
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <Video size={18} /> Video ausgewählt
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <Video size={18} /> Kein Video
                  </div>
                )}
              </div>
              <input
                id="video"
                name="video"
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  if (!f) return;
                  safeRevokeObjectUrl(videoPreviewUrl);
                  setVideoPreviewUrl(URL.createObjectURL(f));
                }}
                className="w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-[#1a3826] file:px-4 file:py-2.5 file:text-xs file:font-black file:text-[#FFC72C]"
              />
              {mode === "edit" && initial?.videoUrl ? (
                <p className="text-xs text-muted-foreground">
                  Aktuell:{" "}
                  <a href={initial.videoUrl} className="font-bold underline text-[#1a3826] dark:text-[#FFC72C]" target="_blank" rel="noreferrer">
                    öffnen
                  </a>{" "}
                  – leer lassen, um beizubehalten.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">MP4/WebM empfohlen.</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/40 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Galerie</p>
              <p className="text-xs text-muted-foreground">
                {mode === "create" ? "Mindestens 1 Bild" : "Häkchen steuern, welche Bilder bleiben"}
              </p>
            </div>
            <p className={`text-xs font-black ${finalCount > maxGallery ? "text-destructive" : "text-muted-foreground"}`}>
              {finalCount} / {maxGallery}
            </p>
          </div>
          <div className="p-4 space-y-4">
            <input
              id="galleryImages"
              name="galleryImages"
              type="file"
              accept="image/*,image/gif,.gif"
              multiple
              onChange={(e) => {
                // revoke old
                newGalleryPreviews.forEach((u) => safeRevokeObjectUrl(u));
                const files = Array.from(e.currentTarget.files ?? []);
                setNewGalleryPreviews(files.map((f) => URL.createObjectURL(f)));
              }}
              className="w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-[#1a3826] file:px-4 file:py-2.5 file:text-xs file:font-black file:text-[#FFC72C]"
            />
            <p className="text-xs text-muted-foreground">
              Bis zu 50 Bilder (GIF erlaubt). {mode === "create" ? "Pflichtfeld." : `Vorher: ${existingCount}, Behalten: ${keepCount}, Neu: ${newCount}.`}
            </p>

            {mode === "edit" && (initial?.galleryUrls?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Bestehende Bilder</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {(initial?.galleryUrls ?? []).map((url) => {
                    const kept = keepExisting.has(url);
                    return (
                      <label key={url} className={`group relative overflow-hidden rounded-xl border ${kept ? "border-[#1a3826]/40" : "border-border opacity-60"} bg-muted`}>
                        <input
                          type="checkbox"
                          className="absolute top-2 left-2 z-10 h-4 w-4 accent-[#1a3826]"
                          checked={kept}
                          onChange={(e) => {
                            setKeepExisting((prev) => {
                              const next = new Set(prev);
                              if (e.currentTarget.checked) next.add(url);
                              else next.delete(url);
                              return next;
                            });
                          }}
                        />
                        <div className="relative aspect-square w-full">
                          <Image src={url} alt="" fill className="object-cover" sizes="160px" unoptimized />
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {newGalleryPreviews.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Neue Dateien</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {newGalleryPreviews.map((url) => (
                    <div key={url} className="relative overflow-hidden rounded-xl border border-border bg-muted">
                      <div className="relative aspect-square w-full">
                        <Image src={url} alt="" fill className="object-cover" sizes="160px" unoptimized />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {finalCount > maxGallery ? (
          <p className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
            Zu viele Bilder ausgewählt. Maximum ist {maxGallery}.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Link href="/admin/dashboard-events" className="inline-flex items-center rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted">Abbrechen</Link>
          <button type="submit" disabled={pending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1a3826] px-6 py-3 text-sm font-black text-white shadow-lg hover:opacity-90 disabled:opacity-60">
            <UploadCloud size={18} /> {pending ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function DashboardEventsFormShell({ title, description, children }: { title: string; description: string; children: React.ReactNode; }) {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10 space-y-6 md:space-y-8">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-border pb-5">
          <div>
            <Link href="/admin/dashboard-events" className="mb-2 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-[#1a3826] dark:hover:text-[#FFC72C]"><ArrowLeft size={16} aria-hidden /> Zurück zur Liste</Link>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase text-[#1a3826]">
              {title.split(" ")[0]} <span className="text-[#FFC72C]">{title.split(" ").slice(1).join(" ")}</span>
            </h1>
            <p className="mt-2 text-sm font-medium text-muted-foreground max-w-2xl">{description}</p>
          </div>
        </header>

        <section className="max-w-5xl">
          {children}
        </section>
      </div>
    </div>
  );
}

