import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { GOD_MODE_ROLES } from "@/lib/permissions";
import LaborPlannerClient from "./LaborPlannerClient";

export default async function LaborPlannerPage() {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get("activeRestaurantId")?.value ?? null;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;

  const dbUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (!dbUser) return null;
  const role = String(dbUser.role);
  const canSeeAllRestaurants = GOD_MODE_ROLES.has(role);

  let allowedIds: string[] = [];
  let preferredRestaurantId: string | undefined;

  if (canSeeAllRestaurants) {
    const rests = await prisma.restaurant.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    allowedIds = rests.map((r) => r.id);
  } else {
    const relations = await prisma.restaurantUser.findMany({
      where: { userId: dbUser.id },
      select: { restaurantId: true, isPrimary: true },
    });
    allowedIds = Array.from(new Set(relations.map((r) => r.restaurantId)));
    preferredRestaurantId = relations.find((r) => r.isPrimary)?.restaurantId ?? allowedIds[0];
  }

  const defaultRestaurantId =
    (fromCookie && allowedIds.includes(fromCookie) ? fromCookie : preferredRestaurantId) ??
    allowedIds[0] ??
    null;

  return (
    <LaborPlannerClient defaultRestaurantId={defaultRestaurantId} />
  );
}
