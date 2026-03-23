"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { resolveActiveRestaurantId } from "@/app/actions/restaurantContext";

function cookieOptions() {
  return {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

/**
 * Vraća aktivni restoran nakon iste logike kao layout (cookie samo ako je u dozvoljenim ID-ovima).
 * Ne mijenja cookie – sigurno u Server Componentima.
 */
export async function getResolvedActiveRestaurantIdForSession(): Promise<string | undefined> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = String((session?.user as { role?: string })?.role ?? "");
  if (!userId) return undefined;

  const canSeeAllRestaurants = ["SYSTEM_ARCHITECT", "ADMIN"].includes(role);

  let allowedRestaurantIds: string[];
  let preferredRestaurantId: string | undefined;

  if (canSeeAllRestaurants) {
    const allRests = await prisma.restaurant.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    allowedRestaurantIds = allRests.map((r) => r.id);
  } else {
    const relations = await prisma.restaurantUser.findMany({
      where: { userId },
      select: { restaurantId: true, isPrimary: true },
    });
    allowedRestaurantIds = relations.map((r) => r.restaurantId);
    preferredRestaurantId = relations.find((r) => r.isPrimary)?.restaurantId;
  }

  if (allowedRestaurantIds.length === 0) return undefined;

  const resolved = await resolveActiveRestaurantId({
    allowedRestaurantIds,
    preferredRestaurantId,
    allowAll: canSeeAllRestaurants,
  });

  return resolved && resolved !== "all" ? resolved : undefined;
}

/**
 * Ako cookie sadrži restoran kojem korisnik nema pristup (npr. ostatak od prethodnog admin logina),
 * postavi cookie na primarni / prvi dozvoljeni. Pozivati samo iz Clienta → Server Action.
 */
export async function syncActiveRestaurantCookieWithSession(): Promise<{ changed: boolean }> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = String((session?.user as { role?: string })?.role ?? "");
  if (!userId) return { changed: false };

  const canSeeAllRestaurants = ["SYSTEM_ARCHITECT", "ADMIN"].includes(role);

  let allowedRestaurantIds: string[];
  let preferredRestaurantId: string | undefined;

  if (canSeeAllRestaurants) {
    const allRests = await prisma.restaurant.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    allowedRestaurantIds = allRests.map((r) => r.id);
  } else {
    const relations = await prisma.restaurantUser.findMany({
      where: { userId },
      select: { restaurantId: true, isPrimary: true },
    });
    allowedRestaurantIds = relations.map((r) => r.restaurantId);
    preferredRestaurantId = relations.find((r) => r.isPrimary)?.restaurantId;
  }

  if (allowedRestaurantIds.length === 0) return { changed: false };

  const cookieStore = await cookies();
  const current = cookieStore.get("activeRestaurantId")?.value;

  if (current === "all" && canSeeAllRestaurants) {
    return { changed: false };
  }

  if (current && allowedRestaurantIds.includes(current)) {
    return { changed: false };
  }

  const next =
    (preferredRestaurantId && allowedRestaurantIds.includes(preferredRestaurantId)
      ? preferredRestaurantId
      : allowedRestaurantIds[0]) || null;

  if (!next) return { changed: false };

  cookieStore.set("activeRestaurantId", next, cookieOptions());
  revalidatePath("/", "layout");
  return { changed: true };
}
