import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getEasterForYear, addDaysToHoliday } from "@/lib/holidays";

export type HolidaysResponse = { d: number; m: number }[];

/**
 * GET /api/holidays?year=YYYY
 * Returns holidays for the given year: from DB (year null or = year) plus
 * computed Easter, Ostermontag (Easter+1), Pfingstmontag (Easter+60).
 * Requires session (internal app).
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
    if (Number.isNaN(year) || year < 1900 || year > 2100) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    const rows = await prisma.holiday.findMany({
      where: {
        OR: [{ year: null }, { year }],
      },
      select: { day: true, month: true },
    });

    const list: HolidaysResponse = rows.map((r) => ({ d: r.day, m: r.month }));

    const easter = getEasterForYear(year);
    list.push(easter);
    list.push(addDaysToHoliday(year, easter, 1));  // Ostermontag
    list.push(addDaysToHoliday(year, easter, 60)); // Pfingstmontag

    return NextResponse.json(list);
  } catch (e) {
    console.error("GET /api/holidays", e);
    return NextResponse.json(
      { error: "Failed to fetch holidays" },
      { status: 500 }
    );
  }
}
