"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  createDashboardNewsItem,
  updateDashboardNewsItem,
} from "@/app/actions/dashboardNewsActions";
import { DashboardNewsAttachmentKind } from "@prisma/client";

export type DashboardNewsFormInitial = {
  id: string;
  title: string;
  subtitle: string | null;
  sortOrder: number;
  isActive: boolean;
  coverImageUrl: string;
  attachmentUrl: string;
  attachmentKind: DashboardNewsAttachmentKind;
};

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

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setError(null);
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createDashboardNewsItem(fd)
          : await updateDashboardNewsItem(initial!.id, fd);
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
      className="mx-auto max-w-xl space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      <div>
        <label htmlFor="title" className="mb-1 block text-xs font-black uppercase text-muted-foreground">
          Titel *
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={initial?.title ?? ""}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium"
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
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium"
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
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium tabular-nums"
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
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium"
          >
            <option value="true">Aktiv (auf Startseite)</option>
            <option value="false">Inaktiv</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="cover" className="mb-1 block text-xs font-black uppercase text-muted-foreground">
          Titelbild (JPG, PNG, GIF, WebP …) {mode === "create" ? "*" : ""}
        </label>
        <input
          id="cover"
          name="cover"
          type="file"
          accept="image/*,image/gif,.gif"
          required={mode === "create"}
          className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#1a3826] file:px-3 file:py-2 file:text-xs file:font-black file:text-[#FFC72C]"
        />
        {mode === "edit" && initial?.coverImageUrl ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Aktuell:{" "}
            <a href={initial.coverImageUrl} className="font-semibold text-[#1a3826] underline dark:text-[#FFC72C]" target="_blank" rel="noreferrer">
              Vorschau
            </a>{" "}
            – leer lassen, um beizubehalten.
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="attachment" className="mb-1 block text-xs font-black uppercase text-muted-foreground">
          Anhang (PDF, Bild oder GIF) {mode === "create" ? "*" : ""}
        </label>
        <input
          id="attachment"
          name="attachment"
          type="file"
          accept="application/pdf,image/*,image/gif,.gif"
          required={mode === "create"}
          className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#1a3826] file:px-3 file:py-2 file:text-xs file:font-black file:text-[#FFC72C]"
        />
        {mode === "edit" && initial?.attachmentUrl ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Aktuell ({initial.attachmentKind}):{" "}
            <a
              href={initial.attachmentUrl}
              className="font-semibold text-[#1a3826] underline dark:text-[#FFC72C]"
              target="_blank"
              rel="noreferrer"
            >
              Öffnen
            </a>{" "}
            – leer lassen, um beizubehalten.
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#1a3826] px-5 py-2.5 text-sm font-black uppercase tracking-wide text-[#FFC72C] disabled:opacity-60"
        >
          {pending ? "Speichern…" : "Speichern"}
        </button>
        <Link
          href="/admin/dashboard-news"
          className="inline-flex items-center rounded-lg border border-border px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted"
        >
          Abbrechen
        </Link>
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
    <div className="min-h-screen bg-background p-4 font-sans text-foreground md:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link
            href="/admin/dashboard-news"
            className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-[#1a3826] dark:hover:text-[#FFC72C]"
          >
            <ArrowLeft size={16} aria-hidden /> Zurück zur Liste
          </Link>
          <h1 className="text-2xl font-black uppercase tracking-tight text-[#1a3826] dark:text-[#FFC72C] md:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
