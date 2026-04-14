"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { format, addMonths, subMonths, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from "lucide-react";
import type { CalendarEventItem } from "@/lib/calendarShared";
import { getCalendarEvents } from "@/app/actions/calendarActions";
import { parseCalendarEventDate } from "@/components/calendar/calendarEventUi";
import DashboardCalendarComboModal from "./DashboardCalendarComboModal";
import CalendarFullViewModal from "./CalendarFullViewModal";

type Props = {
  userId: string;
  initialEvents: CalendarEventItem[];
  initialYear: number;
  initialMonth: number;
  canWriteCalendar?: boolean;
};

export default function DashboardCalendarCard({
  userId,
  initialEvents,
  initialYear,
  initialMonth,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  canWriteCalendar = false,
}: Props) {
  // Use useEffect to set today on the client to avoid SSR hydration mismatch
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    setToday(new Date());
  }, []);

  const [events, setEvents] = useState(initialEvents);
  const [displayYear, setDisplayYear] = useState(initialYear);
  const [displayMonth, setDisplayMonth] = useState(initialMonth);
  const [loading, setLoading] = useState(false);
  const [popupSelectedDay, setPopupSelectedDay] = useState<Date | null>(null);
  const [comboOpen, setComboOpen] = useState(false);
  const [fullCalendarOpen, setFullCalendarOpen] = useState(false);

  const loadMonth = useCallback(
    async (y: number, m: number) => {
      setLoading(true);
      try {
        setEvents(await getCalendarEvents(userId, y, m));
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const handlePrev = () => {
    const d = subMonths(new Date(displayYear, displayMonth - 1), 1);
    setDisplayYear(d.getFullYear());
    setDisplayMonth(d.getMonth() + 1);
    loadMonth(d.getFullYear(), d.getMonth() + 1);
  };
  const handleNext = () => {
    const d = addMonths(new Date(displayYear, displayMonth - 1), 1);
    setDisplayYear(d.getFullYear());
    setDisplayMonth(d.getMonth() + 1);
    loadMonth(d.getFullYear(), d.getMonth() + 1);
  };

  const monthStart = startOfMonth(new Date(displayYear, displayMonth - 1));

  // Events for today only (shown in card body)
  const todayEvents = useMemo(() => {
    if (!today) return [];
    const key = format(today, "yyyy-MM-dd");
    return events.filter(
      (e) => format(parseCalendarEventDate(e), "yyyy-MM-dd") === key
    );
  }, [events, today]);

  const openPopup = () => {
    if (!popupSelectedDay && today) setPopupSelectedDay(today);
    setComboOpen(true);
  };

  // Popup selected day defaults to today
  const effectivePopupDay = popupSelectedDay ?? today ?? new Date(displayYear, displayMonth - 1, 1);

  return (
    <>
      <div className="relative rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg h-full flex flex-col overflow-hidden">

        {/* ── Compact month nav ── */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 shrink-0 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              disabled={loading}
              className="h-7 w-7 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors flex items-center justify-center"
              aria-label="Vormonat"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-[11px] font-black text-gray-700 dark:text-gray-200 capitalize select-none px-1">
              {format(monthStart, "MMM yyyy", { locale: de })}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              disabled={loading}
              className="h-7 w-7 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors flex items-center justify-center"
              aria-label="Nächster Monat"
            >
              <ChevronRight size={13} />
            </button>
          </div>
          {/* Personal entry shortcut */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setFullCalendarOpen(true); }}
            title="Persönlichen Eintrag hinzufügen"
            className="h-7 w-7 rounded-lg bg-[#1a3826] hover:bg-[#142d1f] text-[#FFC72C] flex items-center justify-center transition-colors"
            aria-label="Eintrag hinzufügen"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* ── Card body: big date left + event list right ── */}
        <button
          type="button"
          onClick={openPopup}
          className="flex-1 min-h-0 text-left px-3 py-3 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors"
        >
          <div className="flex gap-3 h-full">

            {/* Big date block */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-3 shadow-sm w-[110px] shrink-0 flex flex-col">
              {today ? (
                <>
                  <div className="text-[10px] font-black uppercase tracking-wide text-[#DA291C] leading-none">
                    {format(today, "EEEE", { locale: de })}
                  </div>
                  <div className="text-[52px] leading-none font-black text-gray-900 dark:text-white mt-1.5">
                    {format(today, "d")}
                  </div>
                  <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mt-1.5 capitalize leading-tight">
                    {format(today, "MMMM yyyy", { locale: de })}
                  </div>
                </>
              ) : (
                /* skeleton while client hydrates */
                <div className="animate-pulse space-y-2 pt-1">
                  <div className="h-2 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-9 w-10 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-2 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              )}
            </div>

            {/* Event list for today */}
            <div className="flex-1 min-w-0 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-3 flex flex-col">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 mb-2">
                Heute
              </div>

              {!today ? null : todayEvents.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center leading-relaxed">
                    Keine Einträge<br />für diesen Tag.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto flex-1">
                  {todayEvents.slice(0, 4).map((ev) => (
                    <div
                      key={`${ev.id}-${format(parseCalendarEventDate(ev), "yyyy-MM-dd")}`}
                      className="rounded-xl bg-[#FFBC0D]/15 px-2.5 py-1.5 border border-[#FFBC0D]/30"
                    >
                      <div className="text-xs font-black text-[#7a5b00] dark:text-[#FFC72C] truncate leading-tight">
                        {ev.title}
                      </div>
                      <div className="text-[10px] font-bold text-[#a37a00] dark:text-[#FFC72C]/70 truncate leading-tight mt-0.5">
                        {ev.categoryLabel ?? ev.type}
                      </div>
                    </div>
                  ))}
                  {todayEvents.length > 4 && (
                    <div className="text-[10px] font-bold text-gray-400">
                      +{todayEvents.length - 4} weitere…
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </button>

        {/* ── Footer button ── */}
        <div className="shrink-0 px-4 py-2.5 bg-[#1a3826]">
          <button
            type="button"
            onClick={openPopup}
            className="text-xs font-black text-white flex items-center justify-between gap-2 w-full hover:opacity-90 transition-opacity"
          >
            <span className="flex items-center gap-1.5">
              <CalendarDays size={14} />
              Vollständigen Kalender öffnen
            </span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <DashboardCalendarComboModal
        open={comboOpen}
        onClose={() => setComboOpen(false)}
        year={displayYear}
        month={displayMonth}
        events={events}
        loading={loading}
        selectedDay={effectivePopupDay}
        onSelectDay={setPopupSelectedDay}
        onPrevMonth={handlePrev}
        onNextMonth={handleNext}
      />

      <CalendarFullViewModal
        open={fullCalendarOpen}
        onClose={() => { setFullCalendarOpen(false); loadMonth(displayYear, displayMonth); }}
        userId={userId}
        initialDate={today ?? new Date(displayYear, displayMonth - 1, 1)}
        canWrite={canWriteCalendar}
      />
    </>
  );
}
