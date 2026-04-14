"use client";

import Link from "next/link";
import { CalendarDays, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useTransition } from "react";
import { getCalendarEvents } from "@/app/actions/calendarActions";
import type { CalendarEventItem } from "@/lib/calendarShared";

type Props = {
  userId: string;
  initialEvents: CalendarEventItem[];
};

const MONTHS = [
  "Jänner","Februar","März","April","Mai","Juni",
  "Juli","August","September","Oktober","November","Dezember",
];

const FALLBACK_COLOR = { dot: "bg-[#1a3826]", bg: "bg-[#1a3826]/10", text: "text-[#1a3826] dark:text-[#FFC72C]" };
const EVENT_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  vacation: { dot: "bg-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300" },
  personal: { dot: "bg-purple-500",  bg: "bg-purple-500/10",  text: "text-purple-700 dark:text-purple-300" },
  shift:    FALLBACK_COLOR,
};

function fmtDay(d: Date | string) {
  return new Date(d).toLocaleDateString("de-AT", { weekday: "short", day: "numeric", month: "short" });
}

export default function CalendarTab({ userId, initialEvents }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [events, setEvents] = useState<CalendarEventItem[]>(initialEvents);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const data = await getCalendarEvents(userId, year, month);
      setEvents(data);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, year, month]);

  const prevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  };

  // Group by date — use composite key to avoid duplicate ID issue
  const grouped = events.reduce<Record<string, CalendarEventItem[]>>((acc, e) => {
    const key = new Date(e.date).toISOString().slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  const sortedDays = Object.keys(grouped).sort();
  const todayStr = now.toISOString().slice(0, 10);

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-xl font-black text-foreground">Mein Kalender</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Ereignisse und Termine</p>
      </div>

      {/* Month navigator */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <button type="button" onClick={prevMonth} className="p-2 rounded-xl hover:bg-muted transition text-muted-foreground hover:text-foreground">
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <div className="text-base font-black text-foreground">{MONTHS[month - 1]}</div>
            <div className="text-xs text-muted-foreground">{year}</div>
          </div>
          <button type="button" onClick={nextMonth} className="p-2 rounded-xl hover:bg-muted transition text-muted-foreground hover:text-foreground">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className={`transition-opacity ${isPending ? "opacity-40" : "opacity-100"}`}>
          {sortedDays.length === 0 ? (
            <div className="py-12 text-center">
              <CalendarDays size={28} className="mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Keine Ereignisse in diesem Monat.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {sortedDays.map((day) => {
                const dayEvents = grouped[day];
                const isToday = day === todayStr;
                return (
                  <div key={day} className={`px-5 py-3.5 ${isToday ? "bg-[#1a3826]/3 dark:bg-[#FFC72C]/3" : ""}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[11px] font-black uppercase tracking-wide ${isToday ? "text-[#1a3826] dark:text-[#FFC72C]" : "text-muted-foreground"}`}>
                        {fmtDay(day)}
                      </span>
                      {isToday && (
                        <span className="px-2 py-0.5 rounded-full bg-[#1a3826] text-white text-[9px] font-black">HEUTE</span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {dayEvents.map((e, idx) => {
                        const c = EVENT_COLORS[e.type] ?? FALLBACK_COLOR;
                        return (
                          <div
                            key={`${e.id}-${day}-${idx}`}
                            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 ${c.bg}`}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
                            <span className={`text-xs font-semibold truncate ${c.text}`}>{e.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-1">
        {[
          { type: "vacation", label: "Urlaub" },
          { type: "personal", label: "Persönlich" },
          { type: "shift", label: "Allgemein" },
        ].map(({ type, label }) => {
          const c = EVENT_COLORS[type] ?? FALLBACK_COLOR;
          return (
            <div key={type} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <div className={`w-2 h-2 rounded-full ${c.dot}`} />
              {label}
            </div>
          );
        })}
      </div>

      <Link
        href="/tools/calendar"
        className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 hover:bg-muted/50 transition shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#1a3826]/10 text-[#1a3826] dark:bg-[#FFC72C]/10 dark:text-[#FFC72C]">
            <CalendarDays size={16} />
          </div>
          <div>
            <p className="text-sm font-black text-foreground">Vollständigen Kalender öffnen</p>
            <p className="text-xs text-muted-foreground">Alle Ansichten, persönliche Einträge, ICS-Export</p>
          </div>
        </div>
        <ExternalLink size={14} className="text-muted-foreground" />
      </Link>
    </div>
  );
}
