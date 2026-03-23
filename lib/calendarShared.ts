/**
 * Kalender-Typen und Hilfen für Client + Server.
 * NICHT in "use server"-Dateien exportieren — nur hier.
 */

export const MAX_PERSONAL_ENTRIES_PER_DAY = 5;

/** Ein Kalendertag in UTC Mittag – wie in der DB für persönliche Einträge. */
export function normalizePersonalDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0));
}

/** Datum aus yyyy-MM-dd als UTC 12:00 (wie bei Kalendereinträgen). */
export function dateStringToUtcNoon(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
}

/** Echter DB-Termin (bearbeitbar mit calendar:write) – kein Urlaub, persönlich, Feiertag. */
export function isManagedCalendarEventId(id: string): boolean {
  return !id.startsWith("vac-") && !id.startsWith("pe-") && !id.startsWith("hol-");
}

export type CalendarEventType = "personal" | "shift" | "vacation";

export type CalendarEventCategoryItem = {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number | null;
};

export type CalendarEventItem = {
  id: string;
  title: string;
  date: Date;
  type: CalendarEventType;
  isFromVacationRequest?: boolean;
  isPersonalEntry?: boolean;
  endDate?: Date | null;
  color?: string | null;
  categoryId?: string | null;
  categoryLabel?: string | null;
  categoryColor?: string | null;
};

export type PersonalEntryUpdateInput = {
  title: string;
  color?: string | null;
  /** Wenn gesetzt und anderer Kalendertag: Eintrag wird verschoben (max. 5 pro Tag). */
  date?: Date;
};
