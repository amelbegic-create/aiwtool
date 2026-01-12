import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
    // Vraćamo spremljene podatke ili prazan objekt ako nema zapisa
    return NextResponse.json({ success: true, data: report?.data || null });
  } catch (error) {
    console.error("Error fetching productivity:", error);
    return NextResponse.json({ error: "Error fetching data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { restaurantId, date, data } = body;

    if (!restaurantId || !date || !data) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    await prisma.productivityReport.upsert({
      where: {
        restaurantId_date: {
          restaurantId,
          date,
        },
      },
      update: { data },
      create: {
        restaurantId,
        date,
        data,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving productivity:", error);
    return NextResponse.json({ error: "Error saving data" }, { status: 500 });
  }
}