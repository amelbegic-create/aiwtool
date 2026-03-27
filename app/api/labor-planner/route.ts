import { NextResponse } from "next/server";
import { getLaborData, saveLaborData, deleteLaborData } from "@/app/actions/laborActions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { userHasRestaurantAccessByEmail } from "@/lib/restaurantAccess";

async function userHasRestaurantAccess(restaurantId: string) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return false;
  return userHasRestaurantAccessByEmail(email, restaurantId);
}

async function getSessionAuth(): Promise<{ userId: string; role: string } | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (!user) return null;
  return { userId: user.id, role: String(user.role) };
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

    const auth = await getSessionAuth();
    if (!auth) {
      return NextResponse.json({ success: false, error: "Nicht angemeldet." }, { status: 401 });
    }

    const result = await saveLaborData(
      String(restaurant),
      Number(month),
      Number(year),
      data ?? { inputs: {}, rows: [] },
      auth
    );
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error?.includes("gesperrt") ? 403 : 500 }
      );
    }
    const fresh = await getLaborData(String(restaurant), Number(month), Number(year), auth);
    return NextResponse.json({ success: true, cl: fresh?.cl });
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

    const auth = await getSessionAuth();
    if (!auth) {
      return NextResponse.json({ success: false, error: "Nicht angemeldet." }, { status: 401 });
    }

    const result = await getLaborData(restaurant, month, year, auth);
    if (!result) {
      return NextResponse.json(
        { success: false, error: "Fehler beim Laden." },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      data: result.data,
      cl: result.cl,
    });
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

    const auth = await getSessionAuth();
    if (!auth) {
      return NextResponse.json({ success: false, error: "Nicht angemeldet." }, { status: 401 });
    }

    const result = await deleteLaborData(restaurant, month, year, auth);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error?.includes("Gesperrt") ? 403 : 500 }
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

