"use client";

import { useState, useCallback, useMemo } from "react";
import { format, addMonths, subMonths, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEventItem } from "@/lib/calendarShared";
import { getCalendarEvents } from "@/app/actions/calendarActions";
import { parseCalendarEventDate } from "@/components/calendar/calendarEventUi";
import MiniMonthCalendar from "@/components/calendar/MiniMonthCalendar";
import DashboardDayEventsDialog from "./DashboardDayEventsDialog";
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
  canWriteCalendar = false,
}: Props) {
  const [events, setEvents] = useState(initialEvents);
  const [displayYear, setDisplayYear] = useState(initialYear);
  const [displayMonth, setDisplayMonth] = useState(initialMonth);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
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
  const fullModalInitialDate = useMemo(
    () => new Date(displayYear, displayMonth - 1, 1),
    [displayYear, displayMonth]
  );

  return (
    <>
      <div className="relative rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg h-full flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-6 h-6 rounded-md bg-[#1a3826]/10 dark:bg-[#FFC72C]/10 flex items-center justify-center shrink-0">
              <Calendar size={12} className="text-[#1a3826] dark:text-[#FFC72C]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-black text-gray-900 dark:text-white leading-tight">Mein Kalender</h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight truncate">
                Termine, Urlaub und Schichten
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              disabled={loading}
              className="p-1 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
              aria-label="Vormonat"
            >
              <ChevronLeft size={12} />
            </button>
            <span className="text-[10px] font-bold text-gray-800 dark:text-gray-200 capitalize min-w-[5rem] text-center select-none">
              {format(monthStart, "MMM yyyy", { locale: de })}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              disabled={loading}
              className="p-1 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
              aria-label="Nächster Monat"
            >
              <ChevronRight size={12} />
            </button>
          </div>
        </div>

        <MiniMonthCalendar
          year={displayYear}
          month={displayMonth}
          events={events}
          onDayClick={(day) => setSelectedDay(day)}
          onPrevMonth={handlePrev}
          onNextMonth={handleNext}
          loading={loading}
          showNavigation={false}
          variant="dashboard"
          className="flex-1 min-h-0 flex flex-col"
        />

        <div className="shrink-0 px-3 py-2 rounded-b-xl bg-[#1a3826] border-t border-[#1a3826]">
          <button
            type="button"
            onClick={() => setFullCalendarOpen(true)}
            className="text-xs font-bold text-white flex items-center gap-1 hover:opacity-90 transition-opacity w-full text-left"
          >
            Mehr anzeigen <ChevronRight size={12} />
          </button>
        </div>
      </div>

      <CalendarFullViewModal
        open={fullCalendarOpen}
        onClose={() => setFullCalendarOpen(false)}
        userId={userId}
        initialDate={fullModalInitialDate}
        canWrite={canWriteCalendar}
      />

      <DashboardDayEventsDialog
        open={selectedDay !== null}
        date={selectedDay}
        dayEvents={
          selectedDay
            ? events.filter(
                (e) =>
                  format(parseCalendarEventDate(e), "yyyy-MM-dd") === format(selectedDay, "yyyy-MM-dd")
              )
            : []
        }
        onClose={() => setSelectedDay(null)}
      />
    </>
  );
}
