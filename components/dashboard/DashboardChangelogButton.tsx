"use client";

import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { ScrollText } from "lucide-react";
import type { ChangelogEntry } from "@/app/actions/dashboardChangelogActions";

const ALLOWED = new Set(["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h1", "h2", "h3"]);

function sanitizeHtml(html: string): string {
  return html.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
    const t = tag.toLowerCase();
    if (!ALLOWED.has(t)) return "";
    return match.startsWith("</") ? `</${t}>` : `<${t}>`;
  });
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "";
  }
}

type Props = { changelog: ChangelogEntry | null };

export default function DashboardChangelogButton({ changelog }: Props) {
  const [open, setOpen] = useState(false);

  const raw = changelog?.content?.trim() ?? "";
  const isHtml = /<[a-z][\s\S]*>/i.test(raw);
  const safeHtml = useMemo(() => (isHtml ? sanitizeHtml(raw) : null), [isHtml, raw]);

  const modal = open && typeof document !== "undefined" && createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Aktuelle Änderungen"
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0 bg-[#FFC72C]/10">
          <h3 className="text-lg font-black uppercase tracking-tight text-[#1a3826] dark:text-[#FFC72C] flex items-center gap-2">
            <ScrollText size={20} />
            Aktuelle Änderungen
          </h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-xl leading-none"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 text-[15px] font-medium text-foreground leading-relaxed tracking-tight [&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5">
          {raw ? (
            safeHtml ? (
              <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
            ) : (
              <p className="whitespace-pre-wrap">{changelog!.content}</p>
            )
          ) : (
            <p className="text-muted-foreground italic">Keine Änderungen eingetragen.</p>
          )}
        </div>
        {changelog?.updatedAt && (
          <div className="px-6 py-3 border-t border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Letzte Aktualisierung: {formatDate(changelog.updatedAt)}
            {changelog.updatedByName ? ` · ${changelog.updatedByName}` : " · SYSTEM ARCHITECT"}
          </div>
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center h-11 w-11 md:h-14 md:w-14 rounded-xl bg-white hover:bg-white/95 border-2 border-white/80 text-[#FFC72C] transition-all shadow-md"
        title="Aktuelle Änderungen / Posljednje izmjene"
        aria-label="Aktuelle Änderungen"
      >
        <ScrollText size={25} strokeWidth={2} className="md:w-7 md:h-7" />
      </button>
      {modal}
    </>
  );
}
