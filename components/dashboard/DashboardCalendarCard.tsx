"use client";

import { useState, useMemo, useCallback } from "react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  parseISO,
  getDay,
} from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { getCalendarEvents, type CalendarEventItem } from "@/app/actions/calendarActions";
import CalendarFullViewModal from "./CalendarFullViewModal";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const TYPE_COLORS: Record<string, string> = {
  personal: "#FFBC0D",
  shift:    "#DA291C",
  vacation: "#1a3826",
};

function getEventColor(ev: CalendarEventItem): string {
  if (ev.color && /^#[0-9A-Fa-f]{6}$/.test(ev.color)) return ev.color;
  return TYPE_COLORS[ev.type] ?? "#6366f1";
}

function parseEventDate(e: CalendarEventItem): Date {
  return typeof e.date === "string" ? parseISO(e.date) : e.date;
}

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
  const [popupOpen, setPopupOpen] = useState(false);
  const [events, setEvents] = useState(initialEvents);
  const [displayYear, setDisplayYear] = useState(initialYear);
  const [displayMonth, setDisplayMonth] = useState(initialMonth);
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const monthStart = startOfMonth(new Date(displayYear, displayMonth - 1));
  const daysInMonth = eachDayOfInterval({
    start: monthStart,
    end: endOfMonth(monthStart),
  });
  const startWeekday = (getDay(monthStart) + 6) % 7;
  const gridDays = [...Array(startWeekday).fill(null), ...daysInMonth];
  const totalCells = Math.ceil(gridDays.length / 7) * 7;
  const filledGrid = [...gridDays, ...Array(totalCells - gridDays.length).fill(null)];

  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      setEvents(await getCalendarEvents(userId, y, m));
    } finally {
      setLoading(false);
    }
  }, [userId]);

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

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    for (const e of events) {
      const key = format(parseEventDate(e), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  return (
    <>
      <div className="relative rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg h-full flex flex-col overflow-hidden">

        {/* ── Header (kompaktan) ── */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-6 h-6 rounded-md bg-[#1a3826]/10 dark:bg-[#FFC72C]/10 flex items-center justify-center shrink-0">
              <Calendar size={12} className="text-[#1a3826] dark:text-[#FFC72C]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-black text-gray-900 dark:text-white leading-tight">Mein Kalender</h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight truncate">Termine, Urlaub und Schichten</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
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
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              disabled={loading}
              className="p-1 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
              aria-label="Nächster Monat"
            >
              <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {/* ── Weekday labels ── */}
        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800 shrink-0">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={`py-0.5 text-center text-[9px] font-bold uppercase tracking-wide ${
                i >= 5 ? "text-gray-400 dark:text-gray-600" : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* ── Calendar grid (kompaktan, klik otvara popup) ── */}
        <div className="flex-1 min-h-0 grid grid-cols-7 min-h-[100px]" style={{ gridAutoRows: "minmax(0, 1fr)" }}>
          {filledGrid.map((day, i) => {
            const isWeekend = i % 7 >= 5;
            if (!day) {
              return (
                <div
                  key={`empty-${i}`}
                  className={`border-b border-r border-gray-100 dark:border-gray-800 ${isWeekend ? "bg-gray-50/50 dark:bg-gray-800/20" : ""}`}
                />
              );
            }
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDay.get(key) ?? [];
            const isToday = isSameDay(day, now);
            const inMonth = isSameMonth(day, monthStart);
            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                aria-label={format(day, "d MMMM yyyy", { locale: de })}
                onClick={() => setPopupOpen(true)}
                onKeyDown={(e) => e.key === "Enter" && setPopupOpen(true)}
                className={[
                  "border-b border-r border-gray-100 dark:border-gray-800",
                  "p-0.5 flex flex-col cursor-pointer transition-colors hover:bg-blue-50/70 dark:hover:bg-gray-800/60",
                  isWeekend && inMonth ? "bg-gray-50/50 dark:bg-gray-800/10" : "",
                  !inMonth ? "opacity-40" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "text-[10px] font-semibold leading-none w-4 h-4 rounded-full flex items-center justify-center shrink-0",
                    isToday ? "bg-[#FFBC0D] text-[#1a3826] font-black" : inMonth ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-600",
                  ].join(" ")}
                >
                  {format(day, "d")}
                </span>
                <div className="flex flex-wrap gap-px mt-0.5 overflow-hidden">
                  {dayEvents.slice(0, 2).map((ev) => (
                    <span
                      key={`${ev.id}-${key}`}
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: getEventColor(ev) }}
                      title={ev.title}
                    />
                  ))}
                  {dayEvents.length > 2 && (
                    <span className="text-[8px] text-gray-400 leading-tight">+{dayEvents.length - 2}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer: otvori puni kalendar ── */}
        <div className="shrink-0 px-3 py-2 rounded-b-xl bg-[#1a3826] border-t border-[#1a3826]">
          <button
            type="button"
            onClick={() => setPopupOpen(true)}
            className="text-xs font-bold text-white flex items-center gap-1 hover:opacity-90 transition-opacity"
          >
            Mehr anzeigen <ChevronRight size={12} />
          </button>
        </div>
      </div>

      <CalendarFullViewModal
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        userId={userId}
        initialDate={now}
        canWrite={canWriteCalendar}
      />
    </>
  );
}
