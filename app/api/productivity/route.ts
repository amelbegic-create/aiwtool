import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const date = searchParams.get("date");
  const month = searchParams.get("month"); // YYYY-MM

  if (!restaurantId) {
    return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });
  }

  try {
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const reports = await prisma.productivityReport.findMany({
        where: {
          restaurantId,
          date: { startsWith: month },
        },
        orderBy: { date: "asc" },
      });
      const byDate: Record<string, unknown> = {};
      for (const r of reports) {
        byDate[r.date] = r.data;
      }
      return NextResponse.json({ success: true, data: byDate });
    }

    if (!date) {
      return NextResponse.json({ error: "Missing date or month" }, { status: 400 });
    }

    const report = await prisma.productivityReport.findUnique({
      where: {
        restaurantId_date: {
          restaurantId,
          date,
        },
      },
    });

    return NextResponse.json({ success: true, data: report?.data || null });
  } catch {
    return NextResponse.json({ error: "Fetch error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { restaurantId, date, data } = body;

    if (!restaurantId || !date) {
      return NextResponse.json({ error: "Identification failed" }, { status: 400 });
    }

    const report = await prisma.productivityReport.upsert({
      where: {
        restaurantId_date: {
          restaurantId,
          date,
        },
      },
      update: {
        data: data, 
      },
      create: {
        restaurantId,
        date,
        data: data,
      },
    });

    return NextResponse.json({ success: true, data: report });
  } catch {
    return NextResponse.json({ error: "Save error" }, { status: 500 });
  }
}