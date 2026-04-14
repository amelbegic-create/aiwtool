"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, X, CalendarDays } from "lucide-react";
import type { CalendarEventItem, CalendarEventType } from "@/lib/calendarShared";
import MiniMonthCalendar from "@/components/calendar/MiniMonthCalendar";
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

export default function DashboardCalendarComboModal({
  open,
  onClose,
  year,
  month,
  events,
  loading,
  selectedDay,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
}: {
  open: boolean;
  onClose: () => void;
  year: number;
  month: number;
  events: CalendarEventItem[];
  loading: boolean;
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<"day" | "month">("day");

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

  useEffect(() => {
    if (open) setTab("day");
  }, [open, year, month]);

  const monthLabel = useMemo(() => {
    return format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: de });
  }, [year, month]);

  const dayEvents = useMemo(() => {
    const dayKey = format(selectedDay, "yyyy-MM-dd");
    return events.filter((e) => format(parseCalendarEventDate(e), "yyyy-MM-dd") === dayKey);
  }, [events, selectedDay]);

  const unique = useMemo(() => uniqueEventsForDay(dayEvents), [dayEvents]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Kalender"
    >
      <div
        className="relative w-full max-w-5xl rounded-3xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gray-400">
                Mein Kalender
              </p>
              <h2 className="text-lg md:text-xl font-black text-gray-900 dark:text-white capitalize">
                {monthLabel}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {format(selectedDay, "EEEE, d. MMMM", { locale: de })}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1">
                <button
                  type="button"
                  onClick={() => setTab("day")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                    tab === "day"
                      ? "bg-[#1a3826] text-white dark:bg-[#FFC72C] dark:text-[#1a3826]"
                      : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  }`}
                >
                  Tag
                </button>
                <button
                  type="button"
                  onClick={() => setTab("month")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                    tab === "month"
                      ? "bg-[#1a3826] text-white dark:bg-[#FFC72C] dark:text-[#1a3826]"
                      : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  }`}
                >
                  Monat
                </button>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
                aria-label="Schließen"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] min-h-[520px]">
          {/* Month panel */}
          <div className="border-b lg:border-b-0 lg:border-r border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/30">
            <div className="flex items-center justify-between px-5 py-4">
              <button
                type="button"
                onClick={onPrevMonth}
                className="h-9 w-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800"
                aria-label="Vormonat"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="text-sm font-black text-gray-900 dark:text-white capitalize select-none">
                {monthLabel}
              </div>
              <button
                type="button"
                onClick={onNextMonth}
                className="h-9 w-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800"
                aria-label="Nächster Monat"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="px-4 pb-5">
              <MiniMonthCalendar
                year={year}
                month={month}
                events={events}
                onDayClick={(d) => {
                  onSelectDay(d);
                  setTab("day");
                }}
                onPrevMonth={onPrevMonth}
                onNextMonth={onNextMonth}
                loading={loading}
                showNavigation={false}
                variant="dashboard"
                className="flex-1 min-h-0"
              />
            </div>
          </div>

          {/* Day agenda panel */}
          <div className="p-5">
            {/* Big date (like widget) */}
            <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-wide text-[#DA291C]">
                    {format(selectedDay, "EEEE", { locale: de })}
                  </p>
                  <div className="text-6xl leading-none font-black text-gray-900 dark:text-white mt-1">
                    {format(selectedDay, "d")}
                  </div>
                  <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mt-2 capitalize">
                    {format(selectedDay, "MMMM yyyy", { locale: de })}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setTab(tab === "day" ? "month" : "day")}
                  className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm font-black text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <CalendarDays size={16} />
                  {tab === "day" ? "Monat" : "Tag"}
                </button>
              </div>

              <div className="mt-5">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gray-400 mb-3">
                  Termine am Tag
                </p>
                {unique.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Keine Einträge für diesen Tag.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                    {unique.map((ev) => {
                      const subtitle = getEventSubtitle(ev);
                      return (
                        <div
                          key={`${ev.id}-${subtitle}`}
                          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-[#FFBC0D]/10 dark:bg-[#FFBC0D]/10 px-4 py-3"
                        >
                          <div className="text-lg font-black text-[#7a5b00] dark:text-[#FFC72C] truncate">
                            {ev.title}
                          </div>
                          <div className="text-sm font-bold text-[#a37a00] dark:text-[#FFC72C]/80 truncate">
                            {subtitle}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom action */}
            <div className="mt-4">
              <Link
                href="/tools/calendar"
                className="w-full inline-flex items-center justify-center rounded-2xl bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] px-5 py-3 text-sm font-black hover:opacity-90 transition"
                onClick={onClose}
              >
                Vollständigen Kalender öffnen
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

