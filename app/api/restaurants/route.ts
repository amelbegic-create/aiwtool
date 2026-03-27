// app/api/restaurants/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getAccessibleRestaurantIdsForUser } from "@/lib/restaurantAccess";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, isActive: true },
  });
  if (!user?.isActive) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 403 });
  }

  const allowedIds = await getAccessibleRestaurantIdsForUser(user.id, String(user.role));
  if (allowedIds.length === 0) {
    return NextResponse.json([]);
  }

  const restaurants = await prisma.restaurant.findMany({
    where: { id: { in: allowedIds } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(restaurants);
}

