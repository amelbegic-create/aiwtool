"use client";

import Image from "next/image";
import type { MyIdeaRow } from "@/app/actions/ideaActions";
import { FileText } from "lucide-react";

/** Server → Client props serialize Date as ISO string; avoid .toISOString() on raw values. */
function toIsoUtc(d: Date | string): string {
  return new Date(d).toISOString();
}

const STATUS_DE: Record<string, string> = {
  SENT: "Eingereicht",
  IN_PROGRESS: "In Bearbeitung",
  DONE: "Erledigt",
};

function statusBadgeClass(s: string): string {
  if (s === "DONE") return "bg-emerald-600/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30";
  if (s === "IN_PROGRESS") return "bg-amber-500/15 text-amber-900 dark:text-amber-100 border-amber-500/30";
  return "bg-slate-500/10 text-slate-700 dark:text-slate-200 border-slate-400/25";
}

function formatWhen(d: Date | string): string {
  return new Date(d).toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = { initialIdeas: MyIdeaRow[] };

export default function MeineIdeenClient({ initialIdeas }: Props) {
  if (initialIdeas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <p className="text-sm font-semibold text-foreground">Noch keine Ideen gesendet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Nutze die Glühbirne oben auf dem Dashboard, um eine Idee einzureichen.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {initialIdeas.map((idea) => {
        const hasImages = (idea.imageUrls?.length ?? 0) > 0;
        const hasPdf = !!idea.pdfUrl;

        return (
          <li
            key={idea.id}
            className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border/80 flex flex-wrap items-center gap-2 justify-between bg-muted/20">
              <time className="text-[11px] font-mono text-muted-foreground tabular-nums" dateTime={toIsoUtc(idea.createdAt)}>
                {formatWhen(idea.createdAt)}
              </time>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${statusBadgeClass(String(idea.status))}`}
                >
                  {STATUS_DE[String(idea.status)] ?? String(idea.status)}
                </span>
                {idea.isArchived && (
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Archiv (Admin)</span>
                )}
              </div>
            </div>

            <div className="px-4 py-3">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{idea.text}</p>

              {(hasImages || hasPdf) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {hasImages &&
                    idea.imageUrls.map((url, idx) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-muted"
                      >
                        <Image
                          src={url}
                          alt={idea.imageNames?.[idx] ?? ""}
                          fill
                          className="object-cover"
                          sizes="64px"
                          unoptimized={url.includes("blob.vercel-storage.com")}
                        />
                      </a>
                    ))}
                  {hasPdf && idea.pdfUrl && (
                    <a
                      href={idea.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2 py-1.5 text-[11px] font-semibold"
                    >
                      <FileText className="h-3.5 w-3.5 text-blue-600" />
                      {idea.pdfName ?? "PDF"}
                    </a>
                  )}
                </div>
              )}
            </div>

            {(idea.adminReply?.trim() || idea.repliedAt) && (
              <div className="px-4 py-3 bg-teal-50/50 dark:bg-teal-950/20 border-t border-teal-200/40 dark:border-teal-800/40">
                <p className="text-[10px] font-black uppercase tracking-widest text-teal-800 dark:text-teal-200 mb-1.5">
                  Rückmeldung {idea.repliedBy?.name ? `von ${idea.repliedBy.name}` : ""}
                </p>
                {idea.adminReply?.trim() ? (
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{idea.adminReply}</p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Noch kein Text – Status siehst du oben.</p>
                )}
                {idea.repliedAt && (
                  <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
                    {formatWhen(idea.repliedAt)}
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
