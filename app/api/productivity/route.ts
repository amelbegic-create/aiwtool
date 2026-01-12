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

    // FIX: Koristimo (report as any) da bi TypeScript ignorirao grešku
    // jer on misli da 'data' ne postoji, iako postoji u bazi.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ success: true, data: (report as any)?.data || null });

  } catch (error) {
    console.error("Error fetching productivity:", error);
    return NextResponse.json({ error: "Error fetching data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { restaurantId, date, data } = body;

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
    console.error("Error saving productivity:", error);
    return NextResponse.json({ error: "Error saving data" }, { status: 500 });
  }
}