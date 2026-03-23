"use client";

import { AlertTriangle } from "lucide-react";

interface VacationBlockedDateModalProps {
  open: boolean;
  onClose: () => void;
  /** Erster gesperrter Tag im gewählten Zeitraum (optional, z. B. „15.03.2026“) */
  detailDateDe?: string | null;
  /** Grund aus Admin, falls vorhanden */
  detailReason?: string | null;
}

/**
 * Zentrierter Hinweis (de-AT): gesperrte Tage durch Admin – kein Urlaub in diesem Zeitraum.
 */
export default function VacationBlockedDateModal({
  open,
  onClose,
  detailDateDe,
  detailReason,
}: VacationBlockedDateModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vacation-blocked-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-amber-500/15 dark:bg-amber-500/10 px-5 py-4 border-b border-amber-500/30 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
            <AlertTriangle size={22} strokeWidth={2.5} />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2
              id="vacation-blocked-title"
              className="text-base font-black text-foreground uppercase tracking-tight leading-tight"
            >
              Urlaub in diesem Zeitraum nicht möglich
            </h2>
            {(detailDateDe || detailReason) && (
              <p className="text-xs text-muted-foreground mt-1.5 font-medium">
                {detailDateDe ? <>Betroffener Tag: <span className="text-foreground font-bold">{detailDateDe}</span></> : null}
                {detailDateDe && detailReason ? " · " : null}
                {detailReason ? <span className="italic">{detailReason}</span> : null}
              </p>
            )}
          </div>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm text-foreground leading-relaxed">
          <p>
            Der gewählte Zeitraum enthält einen oder mehrere vom Administrator <strong>gesperrte Tage</strong>. In
            diesem Zeitraum kann <strong>kein Urlaub beantragt</strong> werden.
          </p>
          <p className="text-muted-foreground">
            Bitte wenden Sie sich an Ihren <strong>Vorgesetzten</strong>, oder wählen Sie einen{" "}
            <strong>anderen Zeitraum</strong>.
          </p>
        </div>
        <div className="px-5 pb-5 pt-0 flex justify-center">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full sm:w-auto px-8 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] text-sm font-black uppercase tracking-wide shadow-md hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Verstanden
          </button>
        </div>
      </div>
    </div>
  );
}
