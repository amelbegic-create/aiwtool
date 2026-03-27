import prisma from "@/lib/prisma";
import { GOD_MODE_ROLES } from "@/lib/permissions";

/** ADMIN / SYSTEM_ARCHITECT: svi aktivni restorani; inače samo veze iz `RestaurantUser`. */
export async function getAccessibleRestaurantIdsForUser(
  userId: string,
  role: string
): Promise<string[]> {
  if (GOD_MODE_ROLES.has(String(role))) {
    const rests = await prisma.restaurant.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    return rests.map((r) => r.id);
  }
  const relations = await prisma.restaurantUser.findMany({
    where: { userId },
    select: { restaurantId: true },
  });
  return Array.from(new Set(relations.map((r) => r.restaurantId)));
}

/** God-mode ili `RestaurantUser` (ista logika kao `/api/productivity`). */
export async function userHasRestaurantAccessByEmail(
  email: string,
  restaurantId: string
): Promise<boolean> {
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

export async function assertUserCanAccessRestaurant(
  userId: string,
  role: string,
  restaurantId: string
): Promise<boolean> {
  if (GOD_MODE_ROLES.has(String(role))) return true;
  const rel = await prisma.restaurantUser.findFirst({
    where: { userId, restaurantId },
    select: { id: true },
  });
  return !!rel;
}
