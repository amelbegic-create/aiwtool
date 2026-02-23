"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/access";
import { getEasterForYear, addDaysToHoliday } from "@/lib/holidays";

export type HolidayRecord = {
  id: string;
  day: number;
  month: number;
  label: string | null;
  year: number | null;
  createdAt: Date;
  updatedAt: Date;
};

function validateDayMonth(day: number, month: number): string | null {
  if (month < 1 || month > 12) return "Mjesec mora biti 1–12.";
  if (day < 1 || day > 31) return "Dan mora biti 1–31.";
  const daysInMonth = new Date(2000, month, 0).getDate();
  if (day > daysInMonth) return `Za ${month}. mjesec dan mora biti 1–${daysInMonth}.`;
  return null;
}

export async function listHolidays(): Promise<HolidayRecord[]> {
  await requirePermission("holidays:manage");
  try {
    const rows = await prisma.holiday.findMany({
      orderBy: [{ month: "asc" }, { day: "asc" }],
    });
    return rows;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("undefined") && msg.includes("findMany")) {
      throw new Error(
        "Prisma client nema Holiday model. U terminalu gdje radi 'npm run dev' pritisnite Ctrl+C da zaustavite server. Zatim u rootu projekta pokrenite: npx prisma generate. Na kraju ponovo: npm run dev."
      );
    }
    throw err;
  }
}

export async function createHoliday(data: {
  day: number;
  month: number;
  label?: string | null;
  year?: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("holidays:manage");
    const err = validateDayMonth(data.day, data.month);
    if (err) return { ok: false, error: err };
    const year = data.year === undefined || data.year === null ? null : data.year;
    await prisma.holiday.create({
      data: {
        day: data.day,
        month: data.month,
        label: data.label ?? null,
        year,
      },
    });
    revalidatePath("/admin/holidays");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Greška pri kreiranju." };
  }
}

export async function updateHoliday(
  id: string,
  data: { day: number; month: number; label?: string | null; year?: number | null }
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("holidays:manage");
    const err = validateDayMonth(data.day, data.month);
    if (err) return { ok: false, error: err };
    const year = data.year === undefined || data.year === null ? null : data.year;
    await prisma.holiday.update({
      where: { id },
      data: {
        day: data.day,
        month: data.month,
        label: data.label ?? null,
        year,
      },
    });
    revalidatePath("/admin/holidays");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Greška pri ažuriranju." };
  }
}

export async function deleteHoliday(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("holidays:manage");
    await prisma.holiday.delete({ where: { id } });
    revalidatePath("/admin/holidays");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Greška pri brisanju." };
  }
}

/** Standard austrijski fiksni datumi: 1.1., 2.1., 1.3., 1.5., 2.5., 25.11., 25.12., 26.12. – nur wenn Tabelle leer. */
const DEFAULT_AT_HOLIDAYS: { day: number; month: number; label: string }[] = [
  { day: 1, month: 1, label: "Neujahr" },
  { day: 2, month: 1, label: "Heilige Drei Könige" },
  { day: 1, month: 3, label: "1. März" },
  { day: 1, month: 5, label: "Staatsfeiertag" },
  { day: 2, month: 5, label: "2. Mai" },
  { day: 25, month: 11, label: "Kath. Feiertag" },
  { day: 25, month: 12, label: "Christtag" },
  { day: 26, month: 12, label: "Stefanitag" },
];

/** Dohvat praznika za godinu (DB + Uskrs, Ostermontag, Pfingstmontag). Za godišnji modul i ostale – bez provjere permisije. */
export async function getHolidaysForYear(year: number): Promise<{ d: number; m: number }[]> {
  const rows = await prisma.holiday.findMany({
    where: { OR: [{ year: null }, { year }] },
    select: { day: true, month: true },
  });
  const list = rows.map((r) => ({ d: r.day, m: r.month }));
  const easter = getEasterForYear(year);
  list.push(easter);
  list.push(addDaysToHoliday(year, easter, 1));
  list.push(addDaysToHoliday(year, easter, 60));
  return list;
}

export async function importDefaultHolidaysAT(): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("holidays:manage");
    const count = await prisma.holiday.count();
    if (count > 0) return { ok: false, error: "Import nur bei leerer Liste möglich." };
    await prisma.holiday.createMany({
      data: DEFAULT_AT_HOLIDAYS.map((h) => ({ day: h.day, month: h.month, label: h.label, year: null })),
    });
    revalidatePath("/admin/holidays");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Greška pri uvozu." };
  }
}
