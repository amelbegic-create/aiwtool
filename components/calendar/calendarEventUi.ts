import { format, parseISO } from "date-fns";
import type { CalendarEventItem } from "@/lib/calendarShared";

export const CALENDAR_TYPE_COLORS: Record<string, string> = {
  personal: "#FFBC0D",
  shift: "#DA291C",
  vacation: "#1a3826",
};

export function parseCalendarEventDate(e: CalendarEventItem): Date {
  return typeof e.date === "string" ? parseISO(e.date) : e.date;
}

export function getCalendarEventDotColor(ev: CalendarEventItem): string {
  if (ev.categoryColor && /^#[0-9A-Fa-f]{6}$/.test(ev.categoryColor)) return ev.categoryColor;
  if (ev.color && /^#[0-9A-Fa-f]{6}$/.test(ev.color)) return ev.color;
  return CALENDAR_TYPE_COLORS[ev.type] ?? "#6366f1";
}

export function buildEventsByDayKey(events: CalendarEventItem[]): Map<string, CalendarEventItem[]> {
  const map = new Map<string, CalendarEventItem[]>();
  for (const e of events) {
    const key = format(parseCalendarEventDate(e), "yyyy-MM-dd");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return map;
}

/** Jedinstveni događaji za jedan dan (višednevni dijele isti id). */
export function uniqueEventsForDay(dayEvents: CalendarEventItem[]): CalendarEventItem[] {
  const byId = new Map<string, CalendarEventItem>();
  for (const ev of dayEvents) {
    if (!byId.has(ev.id)) byId.set(ev.id, ev);
  }
  return Array.from(byId.values());
}
