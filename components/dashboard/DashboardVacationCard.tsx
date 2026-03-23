"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, FileText, Loader2 } from "lucide-react";
import {
  exportIndividualReportWithData,
  type UserStat,
  type RequestWithUser,
} from "@/app/tools/vacations/_components/AdminView";
import { pdfToBlobUrl } from "@/lib/pdfUtils";
import type { jsPDF } from "jspdf";

export type DashboardVacationPdfPayload = {
  userStat: UserStat;
  requests: RequestWithUser[];
};

type Props = {
  year: number;
  carryover: number;
  allowance: number;
  total: number;
  used: number;
  remaining: number;
  pdf?: DashboardVacationPdfPayload | null;
};

function StatBlock({
  label,
  hint,
  value,
  accentClass = "text-[#1a3826] dark:text-white",
}: {
  label: string;
  hint?: string;
  value: number;
  accentClass?: string;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg bg-slate-50/90 px-1 py-1.5 text-center shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800/40 dark:ring-slate-600/60 sm:px-1.5 sm:py-2">
      <p className="whitespace-nowrap text-[8px] font-bold uppercase leading-tight tracking-wide text-slate-500 dark:text-slate-400 sm:text-[9px] md:text-[10px]">
        {label}
      </p>
      {hint ? (
        <p className="whitespace-nowrap text-[8px] font-medium leading-tight text-slate-400 dark:text-slate-500 sm:text-[9px]">
          {hint}
        </p>
      ) : null}
      <p className={`text-base font-black tabular-nums leading-none sm:text-lg ${accentClass}`}>{value}</p>
    </div>
  );
}

export default function DashboardVacationCard({
  year,
  carryover,
  allowance,
  total,
  used,
  remaining,
  pdf,
}: Props) {
  const [pdfPopupUrl, setPdfPopupUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const usedPct = total > 0 ? Math.round((used / total) * 100) : 0;
  const barW = total > 0 ? Math.min(100, usedPct) : 0;

  const closePdf = useCallback(() => {
    setPdfPopupUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const handlePdfClick = useCallback(() => {
    if (!pdf) return;
    setPdfLoading(true);
    try {
      const doc = exportIndividualReportWithData(
        pdf.userStat,
        pdf.requests,
        year,
        true
      ) as jsPDF;
      const url = pdfToBlobUrl(doc);
      setPdfPopupUrl(url);
    } catch (e) {
      console.error(e);
      alert("Fehler beim Erstellen der PDF.");
    } finally {
      setPdfLoading(false);
    }
  }, [pdf, year]);

  return (
    <>
      {pdfPopupUrl && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 pt-14 md:pt-16 md:p-6">
          <button
            type="button"
            className="absolute inset-0 border-0 bg-black/50"
            onClick={closePdf}
            aria-label="Vorschau schließen (Hintergrund)"
          />
          <div
            className="relative z-10 flex h-[min(106.6dvh,1066px)] w-full max-w-[min(96vw,936px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1b3a26] shadow-2xl sm:max-w-[min(65vw,936px)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-preview-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              id="pdf-preview-title"
              className="flex shrink-0 items-center justify-between px-3 py-2.5 text-white sm:px-4"
            >
              <span className="font-bold text-sm">PDF Vorschau</span>
              <button
                type="button"
                onClick={closePdf}
                className="rounded-lg px-2 py-1 text-white hover:bg-white/10 hover:text-[#FFC72C] font-bold text-lg leading-none"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>
            <iframe
              src={pdfPopupUrl}
              className="min-h-0 flex-1 w-full border-0 bg-white"
              title="PDF Vorschau"
            />
          </div>
        </div>
      )}

      <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-gradient-to-br from-[#1a3826] via-[#152e20] to-[#0a1f14] p-2 shadow-lg ring-1 ring-black/10 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:p-2.5">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#FFC72C]/15 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-24 w-48 -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />

        {/* Naslov */}
        <div className="relative z-10 mb-1.5 flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/20 sm:h-8 sm:w-8 sm:rounded-lg">
            <CalendarDays className="h-3.5 w-3.5 text-[#FFC72C] sm:h-4 sm:w-4" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/60 sm:text-[9px]">Urlaub</p>
            <p className="truncate text-xs font-black uppercase tracking-tight text-[#FFC72C] sm:text-sm">
              Jahresurlaub <span className="tabular-nums">{year}</span>
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-1 flex-col gap-1.5 rounded-xl border border-white/10 bg-white/95 p-2 shadow-inner dark:bg-slate-950/90 dark:border-white/10 sm:gap-2 sm:p-2.5">
          {/* 4 jednaka stupca – centrirano; na vrlo uskoj širini lagani scroll */}
          <div className="overflow-x-auto sm:overflow-visible [-webkit-overflow-scrolling:touch]">
            <div className="grid w-full min-w-[15.5rem] grid-cols-4 gap-1 sm:min-w-0 sm:gap-2">
            <StatBlock
              label="Vortrag"
              hint="Übertrag"
              value={carryover}
              accentClass="text-slate-700 dark:text-slate-200"
            />
            <StatBlock
              label="Anspruch"
              hint={String(year)}
              value={allowance}
              accentClass="text-blue-700 dark:text-blue-300"
            />
            <StatBlock label="Gesamt" hint="Summe" value={total} />
            <StatBlock
              label="Rest"
              hint="Urlaub"
              value={remaining}
              accentClass="text-amber-700 dark:text-amber-400"
            />
            </div>
          </div>

          <div className="flex flex-col gap-0.5">
            <p className="text-center text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Verbrauch {year}
            </p>
            <div className="relative overflow-hidden rounded-lg bg-slate-200/90 dark:bg-slate-800/80">
              <div
                className="absolute inset-y-0 left-0 rounded-lg bg-[#FFC72C] transition-[width] duration-500 ease-out"
                style={{ width: `${barW}%` }}
              />
              <div className="relative z-10 flex items-center justify-between gap-2 px-2 py-1 sm:px-2.5 sm:py-1.5">
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <p className="text-sm font-black tabular-nums leading-tight text-[#1a3826] sm:text-base">
                    {total > 0 ? (
                      <>
                        {used}
                        <span className="font-bold text-[#1a3826]/70"> / {total}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </p>
                  <p className="text-[9px] font-semibold leading-tight text-[#1a3826]/80">
                    {total > 0 ? "Tage verbraucht" : "Kein Kontingent"}
                  </p>
                </div>
                <div className="shrink-0 text-center sm:text-right">
                  <p className="text-lg font-black tabular-nums leading-none text-[#1a3826] sm:text-xl">
                    {total > 0 ? `${usedPct}%` : "—"}
                  </p>
                  <p className="text-[8px] font-bold uppercase tracking-wide text-[#1a3826]/75 sm:text-[9px]">
                    genutzt
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-1.5 flex items-center justify-between gap-2">
          <Link
            href="/tools/vacations"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#FFC72C] transition-all hover:gap-2"
          >
            Urlaub planen <ChevronRight size={16} className="shrink-0" strokeWidth={2.5} />
          </Link>
          {pdf ? (
            <button
              type="button"
              onClick={handlePdfClick}
              disabled={pdfLoading}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-[#FFC72C] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-[#1a3826] shadow-md transition-colors hover:bg-[#f5bd2a] disabled:opacity-60"
              aria-label="Urlaubsübersicht als PDF"
            >
              {pdfLoading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#1a3826]" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-[#1a3826]" strokeWidth={2.5} />
              )}
              PDF
            </button>
          ) : (
            <span className="sr-only" aria-hidden>
              —
            </span>
          )}
        </div>
      </div>
    </>
  );
}
