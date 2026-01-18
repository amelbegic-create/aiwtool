import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const date = searchParams.get("date");

  if (!restaurantId || !date) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  try {
    const report = await prisma.productivityReport.findUnique({
      where: {
        restaurantId_date: {
          restaurantId,
          date,
        },
      },
    });

    return NextResponse.json({ success: true, data: report?.data || null });
  } catch (error) {
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
  } catch (error) {
    return NextResponse.json({ error: "Save error" }, { status: 500 });
  }
}