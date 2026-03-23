"use server";

import prisma from "@/lib/prisma";
import { getDbUserForAccess, requirePermission } from "@/lib/access";
import { revalidatePath } from "next/cache";
import {
  MAX_PERSONAL_ENTRIES_PER_DAY,
  normalizePersonalDayUtc,
  type CalendarEventType,
  type CalendarEventCategoryItem,
  type CalendarEventItem,
  type PersonalEntryUpdateInput,
} from "@/lib/calendarShared";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  parseISO,
  isWithinInterval,
} from "date-fns";

function revalidatePersonalCalendarPaths() {
  revalidatePath("/tools/calendar");
  revalidatePath("/dashboard");
}

async function deletePersonalEntryByEventId(ownerUserId: string, eventId: string) {
  const rest = eventId.startsWith("pe-") ? eventId.slice(3) : eventId;
  if (/^\d{4}-\d{2}-\d{2}$/.test(rest)) {
    const d = parseISO(rest);
    await prisma.calendarPersonalEntry.deleteMany({
      where: { userId: ownerUserId, date: normalizePersonalDayUtc(d) },
    });
  } else {
    await prisma.calendarPersonalEntry.deleteMany({
      where: { id: rest, userId: ownerUserId },
    });
  }
  revalidatePersonalCalendarPaths();
}

/** Dohvati sve događaje za mjesec: CalendarEvent + virtualni dani iz odobrenih VacationRequest. */
export async function getCalendarEvents(
  userId: string,
  year: number,
  month: number
): Promise<CalendarEventItem[]> {
  await getDbUserForAccess();

  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(new Date(year, month - 1));

  const [events, approvedVacations, personalEntries, holidays] = await Promise.all([
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
      orderBy: [{ date: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.holiday.findMany({
      where: {
        month,
        OR: [{ year: null }, { year }],
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
        id: `pe-${pe.id}`,
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

  // Globalni praznici (Feiertage) – isti za sve korisnike
  for (const h of holidays) {
    const yearForHoliday = h.year ?? year;
    const d = new Date(yearForHoliday, h.month - 1, h.day);
    if (d < start || d > end) continue;
    result.push({
      id: `hol-${h.id}-${yearForHoliday}-${h.month}-${h.day}`,
      title: h.label ?? "Feiertag",
      date: d,
      type: "personal",
      categoryLabel: h.label ?? "Feiertag",
      color: "#FFBC0D",
    });
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

  const [events, approvedVacations, personalEntries, holidays] = await Promise.all([
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
      orderBy: [{ date: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.holiday.findMany({
      where: {
        OR: [
          {
            year: null,
          },
          {
            year: {
              gte: start.getFullYear(),
              lte: end.getFullYear(),
            },
          },
        ],
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
      id: `pe-${pe.id}`,
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

  // Globalni praznici u rasponu datuma
  for (const h of holidays) {
    // Ako je year null, uzmi svaku godinu u rasponu; ovdje je dovoljno mapirati na godinu startDate
    const years =
      h.year != null
        ? [h.year]
        : Array.from(
            { length: end.getFullYear() - start.getFullYear() + 1 },
            (_, i) => start.getFullYear() + i
          );
    for (const y of years) {
      const d = new Date(y, h.month - 1, h.day);
      if (!isWithinInterval(d, { start, end })) continue;
      result.push({
        id: `hol-${h.id}-${y}-${h.month}-${h.day}`,
        title: h.label ?? "Feiertag",
        date: d,
        type: "personal",
        categoryLabel: h.label ?? "Feiertag",
        color: "#FFBC0D",
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

export async function updateCalendarEvent(
  id: string,
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
  if (id.startsWith("vac-") || id.startsWith("pe-") || id.startsWith("hol-")) {
    throw new Error("Dieser Termin kann nicht bearbeitet werden.");
  }

  const category = await prisma.calendarEventCategory.findUnique({
    where: { id: data.categoryId },
  });
  if (!category) throw new Error("Kategorie nicht gefunden.");

  const endDate =
    data.endDate != null &&
    data.endDate.getTime() >= data.date.getTime()
      ? data.endDate
      : null;

  const nextColor =
    data.color && /^#[0-9A-Fa-f]{6}$/.test(data.color)
      ? data.color
      : category.color ?? null;

  const updated = await prisma.calendarEvent.updateMany({
    where: { id, userId },
    data: {
      title: data.title.trim(),
      date: data.date,
      endDate,
      type: category.name,
      categoryId: data.categoryId,
      color: nextColor,
    },
  });
  if (updated.count === 0) throw new Error("Termin nicht gefunden.");

  revalidatePath("/tools/calendar");
  revalidatePath("/dashboard");
}

export async function deleteCalendarEvent(id: string, userId: string) {
  const dbUser = await requirePermission("calendar:write");
  if (dbUser.id !== userId) throw new Error("Keine Berechtigung.");
  if (id.startsWith("vac-")) return; // virtual vacation events are not deletable
  if (id.startsWith("pe-")) {
    await deletePersonalEntryByEventId(userId, id);
    return;
  }

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

// --- Personal entries (do 5 po danu; id u UI: pe-<cuid>) ---

export async function getPersonalEntriesForUser(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{ id: string; date: string; title: string; color: string | null }[]> {
  const dbUser = await getDbUserForAccess();
  if (dbUser.id !== userId) return [];
  const list = await prisma.calendarPersonalEntry.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: [{ date: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return list.map((e) => ({
    id: e.id,
    date: format(e.date, "yyyy-MM-dd"),
    title: e.title,
    color: e.color ?? null,
  }));
}

function normalizePersonalEntryColorForUpdate(
  color: string | null | undefined
): string | null | undefined {
  if (color === undefined) return undefined;
  if (color === null || color === "") return null;
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) return color;
  return undefined;
}

async function updatePersonalEntryForUserInternal(
  userId: string,
  entryId: string,
  data: PersonalEntryUpdateInput
) {
  const entry = await prisma.calendarPersonalEntry.findFirst({
    where: { id: entryId, userId },
  });
  if (!entry) throw new Error("Eintrag nicht gefunden.");

  const normalizedColor = normalizePersonalEntryColorForUpdate(data.color);

  const patch: {
    title: string;
    color?: string | null;
    date?: Date;
    sortOrder?: number;
  } = {
    title: data.title.trim() || "Persönlich",
  };
  if (normalizedColor !== undefined) patch.color = normalizedColor;

  if (data.date !== undefined) {
    const dayStart = normalizePersonalDayUtc(data.date);
    if (dayStart.getTime() !== entry.date.getTime()) {
      const otherCount = await prisma.calendarPersonalEntry.count({
        where: { userId, date: dayStart, NOT: { id: entryId } },
      });
      if (otherCount >= MAX_PERSONAL_ENTRIES_PER_DAY) {
        throw new Error(
          `Maximal ${MAX_PERSONAL_ENTRIES_PER_DAY} persönliche Einträge pro Tag.`
        );
      }
      patch.date = dayStart;
      patch.sortOrder = otherCount;
    }
  }

  await prisma.calendarPersonalEntry.update({
    where: { id: entryId },
    data: patch,
  });
}

export async function createPersonalEntry(
  userId: string,
  date: Date,
  title: string,
  color?: string | null
) {
  const dbUser = await getDbUserForAccess();
  if (dbUser.id !== userId) throw new Error("Keine Berechtigung.");
  const dayStart = normalizePersonalDayUtc(date);
  const count = await prisma.calendarPersonalEntry.count({
    where: { userId, date: dayStart },
  });
  if (count >= MAX_PERSONAL_ENTRIES_PER_DAY) {
    throw new Error(`Maximal ${MAX_PERSONAL_ENTRIES_PER_DAY} persönliche Einträge pro Tag.`);
  }
  const normalizedColor =
    color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : undefined;
  await prisma.calendarPersonalEntry.create({
    data: {
      userId,
      date: dayStart,
      title: title.trim() || "Persönlich",
      color: normalizedColor ?? undefined,
      sortOrder: count,
    },
  });
  revalidatePersonalCalendarPaths();
}

export async function updatePersonalEntry(
  entryId: string,
  userId: string,
  data: PersonalEntryUpdateInput
) {
  const dbUser = await getDbUserForAccess();
  if (dbUser.id !== userId) throw new Error("Keine Berechtigung.");
  await updatePersonalEntryForUserInternal(userId, entryId, data);
  revalidatePersonalCalendarPaths();
}

export async function deletePersonalEntryById(entryId: string, userId: string) {
  const dbUser = await getDbUserForAccess();
  if (dbUser.id !== userId) throw new Error("Keine Berechtigung.");
  await prisma.calendarPersonalEntry.deleteMany({
    where: { id: entryId, userId },
  });
  revalidatePersonalCalendarPaths();
}

/** @deprecated Koristi createPersonalEntry / updatePersonalEntry. Ostaje za stare pozive. */
export async function upsertPersonalEntry(
  userId: string,
  date: Date,
  title: string,
  color?: string | null
) {
  const dayStart = normalizePersonalDayUtc(date);
  const existing = await prisma.calendarPersonalEntry.findFirst({
    where: { userId, date: dayStart },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (existing) {
    await updatePersonalEntry(existing.id, userId, { title, color });
  } else {
    await createPersonalEntry(userId, date, title, color);
  }
}

export async function deletePersonalEntry(userId: string, date: Date) {
  const dbUser = await getDbUserForAccess();
  if (dbUser.id !== userId) throw new Error("Keine Berechtigung.");
  const dayStart = normalizePersonalDayUtc(date);
  await prisma.calendarPersonalEntry.deleteMany({
    where: {
      userId,
      date: dayStart,
    },
  });
  revalidatePersonalCalendarPaths();
}

// --- Admin: persönliche Kalendereinträge eines Benutzers (users:manage) ---
export async function adminListPersonalCalendarEntries(targetUserId: string) {
  await requirePermission("users:manage");
  return prisma.calendarPersonalEntry.findMany({
    where: { userId: targetUserId },
    orderBy: [{ date: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    take: 500,
    select: { id: true, date: true, title: true, color: true, sortOrder: true },
  });
}

export async function adminCreatePersonalEntry(
  targetUserId: string,
  date: Date,
  title: string,
  color?: string | null
) {
  await requirePermission("users:manage");
  const dayStart = normalizePersonalDayUtc(date);
  const count = await prisma.calendarPersonalEntry.count({
    where: { userId: targetUserId, date: dayStart },
  });
  if (count >= MAX_PERSONAL_ENTRIES_PER_DAY) {
    throw new Error(`Maximal ${MAX_PERSONAL_ENTRIES_PER_DAY} persönliche Einträge pro Tag.`);
  }
  const normalizedColor =
    color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : undefined;
  await prisma.calendarPersonalEntry.create({
    data: {
      userId: targetUserId,
      date: dayStart,
      title: title.trim() || "Persönlich",
      color: normalizedColor ?? undefined,
      sortOrder: count,
    },
  });
  revalidatePersonalCalendarPaths();
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${targetUserId}`);
}

export async function adminUpdatePersonalEntry(
  targetUserId: string,
  entryId: string,
  data: PersonalEntryUpdateInput
) {
  await requirePermission("users:manage");
  await updatePersonalEntryForUserInternal(targetUserId, entryId, data);
  revalidatePersonalCalendarPaths();
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${targetUserId}`);
}

export async function adminDeletePersonalEntry(targetUserId: string, entryId: string) {
  await requirePermission("users:manage");
  await prisma.calendarPersonalEntry.deleteMany({
    where: { id: entryId, userId: targetUserId },
  });
  revalidatePersonalCalendarPaths();
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${targetUserId}`);
}
