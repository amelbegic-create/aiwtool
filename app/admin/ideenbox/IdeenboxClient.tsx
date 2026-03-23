"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lightbulb,
  Check,
  FileText,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  Inbox,
  Loader2,
} from "lucide-react";
import { markIdeaAsRead, archiveIdea, unarchiveIdea } from "@/app/actions/ideaActions";
import type { IdeaWithUser } from "@/app/actions/ideaActions";

function formatDateShort(d: Date): string {
  return new Date(d).toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRestaurantLabel(idea: IdeaWithUser): string {
  const r = idea.user.restaurants?.[0]?.restaurant;
  if (!r) return "—";
  return (r.name && r.name.trim()) || r.code || "—";
}

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const n = (name || email || "?").trim();
  const parts = n.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

const TEXT_PREVIEW = 220;

type Props = {
  initialIdeas: IdeaWithUser[];
  mode: "active" | "archive";
};

export default function IdeenboxClient({ initialIdeas, mode }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const run = (id: string, fn: () => Promise<{ ok: boolean }>) => {
    setActionId(id);
    startTransition(async () => {
      try {
        const r = await fn();
        if (r.ok) router.refresh();
      } finally {
        setActionId(null);
      }
    });
  };

  const isArchiveView = mode === "archive";

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-slate-100/90 via-slate-50/50 to-background dark:from-slate-950 dark:via-slate-900/40 dark:to-background">
      <div className="mx-auto max-w-4xl px-3 py-5 md:px-6 md:py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#1a3826]/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#1a3826] dark:bg-[#FFC72C]/15 dark:text-[#FFC72C]">
              <Lightbulb className="h-3.5 w-3.5" strokeWidth={2.5} />
              Feedback
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground md:text-3xl">
              Ideenbox
            </h1>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              {isArchiveView
                ? "Archivierte Vorschläge – hier wiederherstellen oder nur lesen."
                : "Eingereichte Ideen kompakt – gelesen markieren oder archivieren."}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0 rounded-xl border border-border bg-card p-1 shadow-sm">
            <Link
              href="/admin/ideenbox"
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                !isArchiveView
                  ? "bg-[#1a3826] text-white dark:bg-[#FFC72C] dark:text-[#1a3826]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Aktiv
            </Link>
            <Link
              href="/admin/ideenbox?archiv=1"
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                isArchiveView
                  ? "bg-[#1a3826] text-white dark:bg-[#FFC72C] dark:text-[#1a3826]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Archiv
            </Link>
          </div>
        </div>

        {/* List container */}
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
          {initialIdeas.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Inbox className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {isArchiveView ? "Archiv ist leer." : "Noch keine Ideen eingegangen."}
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                {isArchiveView
                  ? "Archivierte Einträge erscheinen hier."
                  : "Mitarbeitende senden Vorschläge über das Dashboard."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {initialIdeas.map((idea) => {
                const busy = pending && actionId === idea.id;
                const expanded = expandedIds.has(idea.id);
                const long = idea.text.length > TEXT_PREVIEW;
                const preview = long && !expanded ? `${idea.text.slice(0, TEXT_PREVIEW).trim()}…` : idea.text;
                const hasImages = (idea.imageUrls?.length ?? 0) > 0;
                const hasPdf = !!(idea.pdfUrl || idea.attachmentUrl);

                return (
                  <li
                    key={idea.id}
                    className={`relative flex gap-3 px-3 py-3 transition-colors md:gap-4 md:px-4 md:py-3.5 ${
                      !idea.isRead && !isArchiveView
                        ? "bg-amber-50/40 dark:bg-amber-950/20"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    {/* Unread accent */}
                    {!idea.isRead && !isArchiveView && (
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-amber-500"
                        aria-hidden
                      />
                    )}

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1a3826] text-xs font-black text-[#FFC72C] dark:bg-[#FFC72C]/20 dark:text-[#FFC72C]">
                      {initials(idea.user.name, idea.user.email)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground md:text-xs">
                        <span className="font-bold text-foreground">
                          {idea.user.name ?? idea.user.email ?? "Unbekannt"}
                        </span>
                        <span className="text-muted-foreground/70">·</span>
                        <span title="Standort">{getRestaurantLabel(idea)}</span>
                        <span className="text-muted-foreground/70">·</span>
                        <time className="tabular-nums" dateTime={idea.createdAt.toISOString()}>
                          {formatDateShort(idea.createdAt)}
                        </time>
                        {!idea.isRead && !isArchiveView && (
                          <>
                            <span className="text-muted-foreground/70">·</span>
                            <span className="font-semibold text-amber-700 dark:text-amber-400">Neu</span>
                          </>
                        )}
                      </div>

                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-snug text-foreground/90">
                        {preview}
                      </p>

                      {long && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(idea.id)}
                          className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-bold text-[#1a3826] hover:underline dark:text-[#FFC72C]"
                        >
                          {expanded ? (
                            <>
                              Weniger <ChevronUp className="h-3 w-3" />
                            </>
                          ) : (
                            <>
                              Mehr anzeigen <ChevronDown className="h-3 w-3" />
                            </>
                          )}
                        </button>
                      )}

                      {(hasImages || hasPdf) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {hasImages &&
                            idea.imageUrls.map((url, idx) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="relative h-11 w-11 overflow-hidden rounded-lg border border-border/80 bg-muted ring-offset-2 hover:ring-2 hover:ring-[#1a3826]/40 dark:hover:ring-[#FFC72C]/40"
                                title={idea.imageNames?.[idx] ?? "Bild"}
                              >
                                <Image
                                  src={url}
                                  alt={idea.imageNames?.[idx] ?? ""}
                                  fill
                                  sizes="44px"
                                  className="object-cover"
                                  unoptimized={url.includes("blob.vercel-storage.com")}
                                />
                              </a>
                            ))}
                          {hasPdf && (
                            <a
                              href={idea.pdfUrl || idea.attachmentUrl || "#"}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-dashed border-border px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted/80"
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                              <span className="truncate">
                                {idea.pdfName || idea.attachmentName || "PDF"}
                              </span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-start">
                      {!isArchiveView && (
                        <>
                          {!idea.isRead && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => run(idea.id, () => markIdeaAsRead(idea.id))}
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] font-bold text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
                              title="Als gelesen"
                            >
                              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              <span className="hidden sm:inline">Gelesen</span>
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => run(idea.id, () => archiveIdea(idea.id))}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-200/90 px-2 py-1.5 text-[11px] font-bold text-slate-800 hover:bg-slate-300/90 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 disabled:opacity-50"
                            title="Archivieren"
                          >
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                            <span className="hidden sm:inline">Archiv</span>
                          </button>
                        </>
                      )}
                      {isArchiveView && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => run(idea.id, () => unarchiveIdea(idea.id))}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#1a3826] px-2 py-1.5 text-[11px] font-bold text-white hover:opacity-90 dark:bg-[#FFC72C] dark:text-[#1a3826] disabled:opacity-50"
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ArchiveRestore className="h-3.5 w-3.5" />
                          )}
                          <span className="hidden sm:inline">Wiederherstellen</span>
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
