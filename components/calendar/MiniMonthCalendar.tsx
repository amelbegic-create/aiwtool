"use client";

import { useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  getDay,
} from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEventItem } from "@/lib/calendarShared";
import {
  buildEventsByDayKey,
  getCalendarEventDotColor,
} from "./calendarEventUi";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export type MiniMonthCalendarProps = {
  year: number;
  month: number;
  events: CalendarEventItem[];
  onDayClick?: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  loading?: boolean;
  /** Prikaz strelica + MMM yyyy iznad reda dana u tjednu */
  showNavigation?: boolean;
  /** Kompaktniji grid (dashboard) vs malo veći (sidebar) */
  variant?: "dashboard" | "sidebar";
  className?: string;
};

export default function MiniMonthCalendar({
  year,
  month,
  events,
  onDayClick,
  onPrevMonth,
  onNextMonth,
  loading = false,
  showNavigation = false,
  variant = "dashboard",
  className = "",
}: MiniMonthCalendarProps) {
  const now = new Date();
  const monthStart = startOfMonth(new Date(year, month - 1));
  const daysInMonth = eachDayOfInterval({
    start: monthStart,
    end: endOfMonth(monthStart),
  });
  const startWeekday = (getDay(monthStart) + 6) % 7;
  const gridDays = [...Array(startWeekday).fill(null), ...daysInMonth] as (Date | null)[];
  const totalCells = Math.ceil(gridDays.length / 7) * 7;
  const filledGrid = [...gridDays, ...Array(totalCells - gridDays.length).fill(null)] as (Date | null)[];

  const eventsByDay = useMemo(() => buildEventsByDayKey(events), [events]);

  const isDashboard = variant === "dashboard";
  const minH = isDashboard ? "min-h-[100px]" : "min-h-[120px]";
  const dayNumClass = isDashboard
    ? "text-[10px] font-semibold leading-none w-4 h-4 rounded-full flex items-center justify-center shrink-0"
    : "text-[11px] font-semibold leading-none w-5 h-5 rounded-full flex items-center justify-center shrink-0";
  const dotClass = isDashboard ? "w-1.5 h-1.5" : "w-2 h-2";

  return (
    <div className={className}>
      {showNavigation && (
        <div className="flex items-center justify-center gap-2 mb-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrevMonth();
            }}
            disabled={loading}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
            aria-label="Vormonat"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-bold text-gray-800 dark:text-gray-200 capitalize min-w-[6rem] text-center select-none">
            {format(monthStart, "MMMM yyyy", { locale: de })}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNextMonth();
            }}
            disabled={loading}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
            aria-label="Nächster Monat"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <div
        className={`grid grid-cols-7 border-b shrink-0 ${
          isDashboard
            ? "border-gray-100 dark:border-gray-800"
            : "border-gray-200/80 dark:border-[#FFC72C]/10"
        }`}
      >
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={`py-0.5 text-center text-[9px] font-bold uppercase tracking-wide ${
              isDashboard
                ? i >= 5
                  ? "text-gray-400 dark:text-gray-600"
                  : "text-gray-500 dark:text-gray-400"
                : "text-gray-500 dark:text-[#FFC72C]/80"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      <div
        className={`flex-1 min-h-0 grid grid-cols-7 ${minH}`}
        style={{ gridAutoRows: "minmax(0, 1fr)" }}
      >
        {filledGrid.map((day, i) => {
          const isWeekend = i % 7 >= 5;
          if (!day) {
            return (
              <div
                key={`empty-${i}`}
                className={`border-b border-r ${
                  isDashboard
                    ? `border-gray-100 dark:border-gray-800 ${isWeekend ? "bg-gray-50/50 dark:bg-gray-800/20" : ""}`
                    : "border-gray-100 dark:border-[#1a3826]/10 min-h-[44px]"
                }`}
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
              role={onDayClick ? "button" : undefined}
              tabIndex={onDayClick ? 0 : undefined}
              aria-label={format(day, "d. MMMM yyyy", { locale: de })}
              onClick={onDayClick ? () => onDayClick(day) : undefined}
              onKeyDown={
                onDayClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onDayClick(day);
                      }
                    }
                  : undefined
              }
              className={[
                "border-b border-r flex flex-col transition-colors",
                isDashboard
                  ? "border-gray-100 dark:border-gray-800 p-0.5"
                  : "border-gray-100 dark:border-[#1a3826]/10 p-1 min-h-[44px]",
                onDayClick ? "cursor-pointer hover:bg-blue-50/70 dark:hover:bg-gray-800/60" : "",
                isWeekend && inMonth && isDashboard ? "bg-gray-50/50 dark:bg-gray-800/10" : "",
                !inMonth ? "opacity-40" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span
                className={[
                  dayNumClass,
                  isToday
                    ? "bg-[#FFBC0D] text-[#1a3826] font-black"
                    : inMonth
                      ? "text-gray-700 dark:text-gray-300"
                      : "text-gray-400 dark:text-gray-600",
                ].join(" ")}
              >
                {format(day, "d")}
              </span>
              <div className="flex flex-wrap gap-px mt-0.5 overflow-hidden">
                {dayEvents.slice(0, 2).map((ev) => (
                  <span
                    key={`${ev.id}-${key}`}
                    className={`${dotClass} rounded-full shrink-0`}
                    style={{ backgroundColor: getCalendarEventDotColor(ev) }}
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
    </div>
  );
}
