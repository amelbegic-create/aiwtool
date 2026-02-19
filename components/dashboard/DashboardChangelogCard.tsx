"use client";

import { useState, useMemo } from "react";
import { Expand } from "lucide-react";
import type { ChangelogEntry } from "@/app/actions/dashboardChangelogActions";

const PREVIEW_MAX_LENGTH = 220;
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
    const d = new Date(iso);
    return d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "";
  }
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

type Props = {
  initial: ChangelogEntry | null;
};

export default function DashboardChangelogCard({ initial }: Props) {
  const [popupOpen, setPopupOpen] = useState(false);

  const raw = initial?.content?.trim() ?? "";
  const isHtml = /<[a-z][\s\S]*>/i.test(raw);
  const safeHtml = useMemo(() => (isHtml ? sanitizeHtml(raw) : null), [isHtml, raw]);
  const plainPreview = safeHtml ? stripTags(safeHtml) : raw;
  const isLong = plainPreview.length > PREVIEW_MAX_LENGTH;
  const preview = isLong ? plainPreview.slice(0, PREVIEW_MAX_LENGTH).trim() + "…" : plainPreview;
  const hasContent = !!raw;

  return (
    <>
      <div className="rounded-2xl md:rounded-3xl border border-border bg-card shadow-md overflow-hidden h-full flex flex-col">
        <div className="px-6 py-4 bg-[#FFC72C] border-b border-[#FFC72C]">
          <h2 className="text-base font-black uppercase tracking-tight text-[#1a3826]">
            Aktuelle Änderungen
          </h2>
        </div>
        <div className="p-6 flex-1 flex flex-col min-h-[180px]">
          <div className="flex-1 text-[15px] font-medium text-foreground leading-relaxed tracking-tight [&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5">
            {!safeHtml && (hasContent ? preview : "Keine Änderungen eingetragen.")}
            {safeHtml && !isLong && <div dangerouslySetInnerHTML={{ __html: safeHtml }} />}
            {safeHtml && isLong && (
              <div className="line-clamp-4">
                <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
              </div>
            )}
          </div>
          {isLong && (
            <button
              type="button"
              onClick={() => setPopupOpen(true)}
              className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#1a3826] dark:text-[#FFC72C] hover:underline"
            >
              <Expand size={16} />
              Mehr anzeigen
            </button>
          )}
          {initial?.updatedAt && (
            <p className="mt-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Letzte Aktualisierung: {formatDate(initial.updatedAt)}
              {" · SYSTEM ARCHITECT"}
            </p>
          )}
        </div>
      </div>

      {popupOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setPopupOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Aktuelle Änderungen – Vollständige Ansicht"
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
              <h3 className="text-lg font-black uppercase tracking-tight text-[#1a3826]">Aktuelle Änderungen</h3>
              <button
                type="button"
                onClick={() => setPopupOpen(false)}
                className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-xl leading-none"
                aria-label="Schließen"
              >
                ×
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 text-[15px] font-medium text-foreground leading-relaxed tracking-tight [&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5">
              {safeHtml ? <div dangerouslySetInnerHTML={{ __html: safeHtml }} /> : (text || "Keine Änderungen eingetragen.")}
            </div>
            {initial?.updatedAt && (
              <div className="px-6 py-3 border-t border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Letzte Aktualisierung: {formatDate(initial.updatedAt)}
                {" · SYSTEM ARCHITECT"}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
