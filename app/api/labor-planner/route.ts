import { NextResponse } from "next/server";
import { getLaborData, saveLaborData, deleteLaborData } from "@/app/actions/laborActions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { GOD_MODE_ROLES } from "@/lib/permissions";

async function userHasRestaurantAccess(restaurantId: string) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return false;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (!user) return false;
  if (GOD_MODE_ROLES.has(String(user.role))) return true;

  const rel = await prisma.restaurantUser.findFirst({
    where: { userId: user.id, restaurantId },
    select: { id: true },
  });
  return !!rel;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { year, month, restaurant, data } = body;
    if (!year || !month || !restaurant) {
      return NextResponse.json(
        { success: false, error: "Parameter fehlen." },
        { status: 400 }
      );
    }

    const canAccess = await userHasRestaurantAccess(String(restaurant));
    if (!canAccess) {
      return NextResponse.json(
        { success: false, error: "Kein Zugriff auf diesen Standort." },
        { status: 403 }
      );
    }

    const result = await saveLaborData(
      String(restaurant),
      Number(month),
      Number(year),
      data ?? { inputs: {}, rows: [] }
    );
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Labor POST:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Speichern." },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  const restaurant = searchParams.get("restaurant");

  if (!year || !month || !restaurant) {
    return NextResponse.json(
      { success: false, error: "Parameter fehlen." },
      { status: 400 }
    );
  }

  try {
    const canAccess = await userHasRestaurantAccess(restaurant);
    if (!canAccess) {
      return NextResponse.json(
        { success: false, error: "Kein Zugriff auf diesen Standort." },
        { status: 403 }
      );
    }

    const report = await getLaborData(restaurant, month, year);
    const data = report?.data ?? null;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Labor GET:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Laden." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  const restaurant = searchParams.get("restaurant");

  if (!year || !month || !restaurant) {
    return NextResponse.json(
      { success: false, error: "Parameter fehlen." },
      { status: 400 }
    );
  }

  try {
    const canAccess = await userHasRestaurantAccess(restaurant);
    if (!canAccess) {
      return NextResponse.json(
        { success: false, error: "Kein Zugriff auf diesen Standort." },
        { status: 403 }
      );
    }

    const result = await deleteLaborData(restaurant, month, year);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Labor DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Löschen." },
      { status: 500 }
    );
  }
}
