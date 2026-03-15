"use server";

import prisma from "@/lib/prisma";
import { getDbUserForAccess, requirePermission } from "@/lib/access";
import { revalidatePath } from "next/cache";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  parseISO,
  isWithinInterval,
} from "date-fns";

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

/** Dohvati sve događaje za mjesec: CalendarEvent + virtualni dani iz odobrenih VacationRequest. */
export async function getCalendarEvents(
  userId: string,
  year: number,
  month: number
): Promise<CalendarEventItem[]> {
  await getDbUserForAccess();

  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(new Date(year, month - 1));

  const [events, approvedVacations, personalEntries] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        date: { lte: end },
        OR: [
          { endDate: null, date: { gte: start } },
          { endDate: { gte: start } },
        ],
      },
      include: { category: true },
      orderBy: { date: "asc" },
    }),
    prisma.vacationRequest.findMany({
      where: {
        userId,
        status: "APPROVED",
        start: { lte: format(end, "yyyy-MM-dd") },
        end: { gte: format(start, "yyyy-MM-dd") },
      },
    }),
    prisma.calendarPersonalEntry.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
      },
    }),
  ]);

  const result: CalendarEventItem[] = [];
  for (const e of events) {
    const eventEnd = e.endDate ? e.endDate : e.date;
    const eventStart = e.date;
    const days = eachDayOfInterval({
      start: eventStart > start ? eventStart : start,
      end: eventEnd < end ? eventEnd : end,
    });
    for (const d of days) {
      result.push({
        id: e.id,
        title: e.title,
        date: d,
        type: e.type as CalendarEventType,
        endDate: e.endDate ?? undefined,
        color: e.color ?? undefined,
        categoryId: e.categoryId ?? undefined,
        categoryLabel: e.category?.name ?? undefined,
        categoryColor: e.category?.color ?? undefined,
      });
    }
  }

  for (const pe of personalEntries) {
    const d = pe.date;
    if (d >= start && d <= end) {
      result.push({
        id: `pe-${format(d, "yyyy-MM-dd")}`,
        title: pe.title,
        date: d,
        type: "personal",
        isPersonalEntry: true,
        color: pe.color ?? undefined,
      });
    }
  }

  for (const vac of approvedVacations) {
    let dayStart: Date;
    let dayEnd: Date;
    try {
      dayStart = parseISO(vac.start);
      dayEnd = parseISO(vac.end);
    } catch {
      continue;
    }
    const days = eachDayOfInterval({ start: dayStart, end: dayEnd });
    for (const d of days) {
      if (!isWithinInterval(d, { start, end })) continue;
      result.push({
        id: `vac-${vac.id}-${format(d, "yyyy-MM-dd")}`,
        title: "Urlaub",
        date: d,
        type: "vacation",
        isFromVacationRequest: true,
      });
    }
  }

  result.sort((a, b) => a.date.getTime() - b.date.getTime());
  return result;
}

/** Dohvati sve događaje u rasponu datuma: CalendarEvent + virtualni Urlaub (jedan red po danu za višednevne). */
export async function getCalendarEventsForDateRange(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<CalendarEventItem[]> {
  await getDbUserForAccess();

  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);

  const [events, approvedVacations, personalEntries] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        date: { lte: end },
        OR: [
          { endDate: null, date: { gte: start } },
          { endDate: { gte: start } },
        ],
      },
      include: { category: true },
      orderBy: { date: "asc" },
    }),
    prisma.vacationRequest.findMany({
      where: {
        userId,
        status: "APPROVED",
        start: { lte: format(end, "yyyy-MM-dd") },
        end: { gte: format(start, "yyyy-MM-dd") },
      },
    }),
    prisma.calendarPersonalEntry.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
      },
    }),
  ]);

  const result: CalendarEventItem[] = [];
  for (const e of events) {
    const eventEnd = e.endDate ? e.endDate : e.date;
    const eventStart = e.date;
    const rangeStart = eventStart > start ? eventStart : start;
    const rangeEnd = eventEnd < end ? eventEnd : end;
    if (rangeStart > rangeEnd) continue;
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    for (const d of days) {
      result.push({
        id: e.id,
        title: e.title,
        date: d,
        type: e.type as CalendarEventType,
        endDate: e.endDate ?? undefined,
        color: e.color ?? undefined,
        categoryId: e.categoryId ?? undefined,
        categoryLabel: e.category?.name ?? undefined,
        categoryColor: e.category?.color ?? undefined,
      });
    }
  }

  for (const pe of personalEntries) {
    result.push({
      id: `pe-${format(pe.date, "yyyy-MM-dd")}`,
      title: pe.title,
      date: pe.date,
      type: "personal",
      isPersonalEntry: true,
      color: pe.color ?? undefined,
    });
  }

  for (const vac of approvedVacations) {
    let dayStart: Date;
    let dayEnd: Date;
    try {
      dayStart = parseISO(vac.start);
      dayEnd = parseISO(vac.end);
    } catch {
      continue;
    }
    const days = eachDayOfInterval({ start: dayStart, end: dayEnd });
    for (const d of days) {
      if (!isWithinInterval(d, { start, end })) continue;
      result.push({
        id: `vac-${vac.id}-${format(d, "yyyy-MM-dd")}`,
        title: "Urlaub",
        date: d,
        type: "vacation",
        isFromVacationRequest: true,
      });
    }
  }

  result.sort((a, b) => a.date.getTime() - b.date.getTime());
  return result;
}

/** Dohvati sve korisnikove CalendarEvent (za ICS export) – bez virtualnih. */
export async function getAllCalendarEventsForUser(userId: string): Promise<CalendarEventItem[]> {
  await getDbUserForAccess();

  const events = await prisma.calendarEvent.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });

  return events.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    type: e.type as CalendarEventType,
    endDate: e.endDate ?? undefined,
    color: e.color ?? undefined,
  }));
}

/** Dohvati odobrene godišnje za korisnika (za ICS) – rasponi. */
export async function getApprovedVacationRangesForUser(
  userId: string
): Promise<{ start: Date; end: Date; title: string }[]> {
  await getDbUserForAccess();

  const list = await prisma.vacationRequest.findMany({
    where: { userId, status: "APPROVED" },
    select: { start: true, end: true },
  });

  return list.map((v) => ({
    start: parseISO(v.start),
    end: parseISO(v.end),
    title: "Urlaub",
  }));
}

/** Za ICS export: vraća događaje i godišnje kao plain objekti (ISO string datumi). */
export async function getCalendarDataForExport(userId: string): Promise<{
  events: { title: string; date: string; endDate?: string; type: string }[];
  vacationRanges: { start: string; end: string; title: string }[];
}> {
  const dbUser = await getDbUserForAccess();
  if (dbUser.id !== userId) return { events: [], vacationRanges: [] };

  const [events, vacations] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      select: { title: true, date: true, endDate: true, type: true },
    }),
    prisma.vacationRequest.findMany({
      where: { userId, status: "APPROVED" },
      select: { start: true, end: true },
    }),
  ]);

  return {
    events: events.map((e) => ({
      title: e.title,
      date: e.date.toISOString(),
      endDate: e.endDate?.toISOString(),
      type: e.type,
    })),
    vacationRanges: vacations.map((v) => ({
      start: v.start,
      end: v.end,
      title: "Urlaub",
    })),
  };
}

export async function addCalendarEvent(
  userId: string,
  data: {
    title: string;
    date: Date;
    categoryId: string;
    endDate?: Date | null;
    color?: string | null;
  }
) {
  const dbUser = await requirePermission("calendar:write");
  if (dbUser.id !== userId) throw new Error("Keine Berechtigung.");

  const category = await prisma.calendarEventCategory.findUnique({
    where: { id: data.categoryId },
  });
  if (!category) throw new Error("Kategorie nicht gefunden.");

  const event = await prisma.calendarEvent.create({
    data: {
      userId,
      title: data.title.trim(),
      date: data.date,
      type: category.name,
      categoryId: data.categoryId,
      endDate: data.endDate ?? undefined,
      color: data.color && /^#[0-9A-Fa-f]{6}$/.test(data.color) ? data.color : category.color ?? undefined,
    },
  });

  revalidatePath("/tools/calendar");
  revalidatePath("/dashboard");
  return event;
}

export async function deleteCalendarEvent(id: string, userId: string) {
  const dbUser = await requirePermission("calendar:write");
  if (dbUser.id !== userId) throw new Error("Keine Berechtigung.");
  if (id.startsWith("vac-")) return; // virtual vacation events are not deletable
  if (id.startsWith("pe-")) return; // personal entries use deletePersonalEntry

  await prisma.calendarEvent.deleteMany({
    where: { id, userId },
  });

  revalidatePath("/tools/calendar");
  revalidatePath("/dashboard");
}

// --- Calendar categories (calendar:write) ---
export async function getCalendarCategories(): Promise<CalendarEventCategoryItem[]> {
  await getDbUserForAccess();
  const list = await prisma.calendarEventCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return list.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    sortOrder: c.sortOrder,
  }));
}

export async function createCalendarCategory(name: string, color?: string | null) {
  await requirePermission("calendar:write");
  const category = await prisma.calendarEventCategory.create({
    data: {
      name: name.trim(),
      color: color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : undefined,
    },
  });
  revalidatePath("/tools/calendar");
  return category;
}

export async function updateCalendarCategory(
  id: string,
  data: { name?: string; color?: string | null }
) {
  await requirePermission("calendar:write");
  const category = await prisma.calendarEventCategory.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.color !== undefined && {
        color: data.color && /^#[0-9A-Fa-f]{6}$/.test(data.color) ? data.color : null,
      }),
    },
  });
  revalidatePath("/tools/calendar");
  return category;
}

export async function deleteCalendarCategory(id: string) {
  await requirePermission("calendar:write");
  const inUse = await prisma.calendarEvent.count({ where: { categoryId: id } });
  if (inUse > 0) throw new Error("Kategorie wird noch von Terminen verwendet.");
  await prisma.calendarEventCategory.delete({ where: { id } });
  revalidatePath("/tools/calendar");
}

// --- Personal entries (any logged-in user, own only) ---
export async function getPersonalEntriesForUser(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{ date: string; title: string }[]> {
  const dbUser = await getDbUserForAccess();
  if (dbUser.id !== userId) return [];
  const list = await prisma.calendarPersonalEntry.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: "asc" },
  });
  return list.map((e) => ({
    date: format(e.date, "yyyy-MM-dd"),
    title: e.title,
  }));
}

export async function upsertPersonalEntry(
  userId: string,
  date: Date,
  title: string,
  color?: string | null
) {
  const dbUser = await getDbUserForAccess();
  if (dbUser.id !== userId) throw new Error("Keine Berechtigung.");
  const normalizedColor =
    color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : undefined;
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  await prisma.calendarPersonalEntry.upsert({
    where: {
      userId_date: {
        userId,
        date: dayStart,
      },
    },
    create: {
      userId,
      date: dayStart,
      title: title.trim() || "Osobno",
      color: normalizedColor ?? undefined,
    },
    update: {
      title: title.trim() || "Osobno",
      color: normalizedColor ?? undefined,
    },
  });
  revalidatePath("/tools/calendar");
  revalidatePath("/dashboard");
}

export async function deletePersonalEntry(userId: string, date: Date) {
  const dbUser = await getDbUserForAccess();
  if (dbUser.id !== userId) throw new Error("Keine Berechtigung.");
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  await prisma.calendarPersonalEntry.deleteMany({
    where: {
      userId,
      date: dayStart,
    },
  });
  revalidatePath("/tools/calendar");
  revalidatePath("/dashboard");
}
