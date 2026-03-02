"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/access";

export type BlockedDayRecord = {
  id: string;
  date: string;
  reason: string | null;
  restaurantId: string;
  restaurantCode: string;
  restaurantName: string | null;
};

export type RestaurantOption = {
  id: string;
  code: string;
  name: string | null;
};

export async function listBlockedDays(): Promise<BlockedDayRecord[]> {
  await requirePermission("holidays:manage");

  const rows = await prisma.blockedDay.findMany({
    include: {
      restaurant: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
    orderBy: [{ date: "asc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    reason: r.reason,
    restaurantId: r.restaurantId,
    restaurantCode: r.restaurant.code,
    restaurantName: r.restaurant.name ?? null,
  }));
}

export async function listRestaurantsForBlockedDays(): Promise<RestaurantOption[]> {
  await requirePermission("holidays:manage");

  const rows = await prisma.restaurant.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });

  return rows;
}

export async function createBlockedDay(input: {
  date: string;
  reason?: string | null;
  restaurantId: string | "all";
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("holidays:manage");

    const date = input.date?.trim();
    if (!date) return { ok: false, error: "Datum ist erforderlich." };

    const reason = input.reason?.trim() || null;

    if (input.restaurantId === "all") {
      // Za "sve restorane" prvo makni postojeće blokade za taj datum, zatim kreiraj nove.
      await prisma.blockedDay.deleteMany({ where: { date } });

      const restaurants = await prisma.restaurant.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      if (restaurants.length === 0) {
        return { ok: false, error: "Keine Restaurants gefunden." };
      }

      await prisma.blockedDay.createMany({
        data: restaurants.map((r) => ({
          date,
          reason,
          restaurantId: r.id,
        })),
      });
    } else {
      // Za jedan restoran: izbriši stare zapise za taj datum i restoran, pa dodaj novi.
      await prisma.blockedDay.deleteMany({
        where: { restaurantId: input.restaurantId, date },
      });

      await prisma.blockedDay.create({
        data: {
          date,
          reason,
          restaurantId: input.restaurantId,
        },
      });
    }

    revalidatePath("/admin/holidays");
    revalidatePath("/tools/vacations");
    revalidatePath("/tools/vacations/view/table");
    revalidatePath("/tools/vacations/view/plan");

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Fehler beim Speichern des gesperrten Tages.",
    };
  }
}

export async function deleteBlockedDay(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("holidays:manage");
    await prisma.blockedDay.delete({ where: { id } });

    revalidatePath("/admin/holidays");
    revalidatePath("/tools/vacations");
    revalidatePath("/tools/vacations/view/table");
    revalidatePath("/tools/vacations/view/plan");

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Fehler beim Löschen des gesperrten Tages.",
    };
  }
}

