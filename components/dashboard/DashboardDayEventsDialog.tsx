"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { X } from "lucide-react";
import type { CalendarEventItem, CalendarEventType } from "@/lib/calendarShared";
import { uniqueEventsForDay, parseCalendarEventDate } from "@/components/calendar/calendarEventUi";

const TYPE_LABELS: Record<CalendarEventType, string> = {
  personal: "Persönlich",
  shift: "Schicht",
  vacation: "Urlaub",
};

function getEventSubtitle(ev: CalendarEventItem): string {
  if (ev.isPersonalEntry) return "Persönlich";
  if (ev.categoryLabel) return ev.categoryLabel;
  return TYPE_LABELS[ev.type as CalendarEventType] ?? ev.type ?? "Termin";
}

type Props = {
  open: boolean;
  date: Date | null;
  dayEvents: CalendarEventItem[];
  onClose: () => void;
};

export default function DashboardDayEventsDialog({ open, date, dayEvents, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !date) return null;

  const unique = uniqueEventsForDay(dayEvents);
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const monthHref = `/tools/calendar?year=${y}&month=${m}`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dashboard-day-events-title"
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2 border-b border-gray-100 dark:border-gray-800">
          <h2 id="dashboard-day-events-title" className="text-base font-black text-gray-900 dark:text-white pr-2">
            {format(date, "EEEE, d. MMMM yyyy", { locale: de })}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
            aria-label="Schließen"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 max-h-64 overflow-y-auto">
          {unique.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Keine Einträge für diesen Tag.</p>
          ) : (
            <ul className="space-y-2">
              {unique.map((ev) => {
                const start = parseCalendarEventDate(ev);
                const subtitle = getEventSubtitle(ev);
                return (
                  <li
                    key={`${ev.id}-${format(start, "yyyy-MM-dd")}`}
                    className="rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2 bg-gray-50/80 dark:bg-gray-800/40"
                  >
                    <p className="text-sm font-bold text-gray-900 dark:text-white break-words">{ev.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-800">
          <Link
            href="/tools/calendar"
            className="flex-1 text-center py-2.5 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] text-sm font-bold hover:opacity-90 transition-opacity"
            onClick={onClose}
          >
            Kalender öffnen
          </Link>
          <Link
            href={monthHref}
            className="flex-1 text-center py-2.5 rounded-xl border-2 border-[#1a3826] dark:border-[#FFC72C] text-[#1a3826] dark:text-[#FFC72C] text-sm font-bold hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10 transition-colors"
            onClick={onClose}
          >
            Diesen Monat öffnen
          </Link>
        </div>
      </div>
    </div>
  );
}
