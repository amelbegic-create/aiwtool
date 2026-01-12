import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Prilagodi putanju ako ti je prisma drugdje (npr. ../../lib/prisma)

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { year, month, restaurant, data } = body;

    // Spremi ili Ažuriraj (Upsert)
    const plan = await prisma.laborPlan.upsert({
      where: {
        year_month_restaurant: {
          year,
          month,
          restaurant: String(restaurant),
        },
      },
      update: {
        data: data, // Ažuriraj JSON ako postoji
      },
      create: {
        year,
        month,
        restaurant: String(restaurant),
        data: data, // Kreiraj novi ako ne postoji
      },
    });

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    console.error("Greška pri spremanju:", error);
    return NextResponse.json({ success: false, error: "Failed to save" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  const restaurant = searchParams.get("restaurant");

  if (!year || !month || !restaurant) {
    return NextResponse.json({ success: false, error: "Missing params" }, { status: 400 });
  }

  try {
    const plan = await prisma.laborPlan.findUnique({
      where: {
        year_month_restaurant: {
          year,
          month,
          restaurant,
        },
      },
    });

    // Ako nema plana, vraćamo null (frontend će znati da je prazno)
    return NextResponse.json({ success: true, data: plan?.data || null });
  } catch (error) {
    console.error("Greška pri učitavanju:", error);
    return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 });
  }
}