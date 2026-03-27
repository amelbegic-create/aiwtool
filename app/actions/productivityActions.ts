"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { PermissionDeniedError, requirePermission } from "@/lib/access";
import { assertUserCanAccessRestaurant } from "@/lib/restaurantAccess";

async function guardProductivityRestaurant(restaurantId: string) {
  const dbUser = await requirePermission("productivity:access");
  const ok = await assertUserCanAccessRestaurant(dbUser.id, String(dbUser.role), restaurantId);
  if (!ok) throw new PermissionDeniedError("Kein Zugriff auf diesen Standort.");
  return dbUser;
}

// 1. DOHVATI IZVJEŠTAJ I KONFIGURACIJU
export async function getProductivityData(restaurantId: string, date: string) {
  try {
    await guardProductivityRestaurant(restaurantId);
    const report = await prisma.productivityReport.findUnique({
      where: { restaurantId_date: { restaurantId, date } },
    });

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { openingHours: true },
    });

    return {
      report,
      openingHours: restaurant?.openingHours ? JSON.parse(JSON.stringify(restaurant.openingHours)) : null,
    };
  } catch (e) {
    if (e instanceof PermissionDeniedError) throw e;
    return { report: null, openingHours: null };
  }
}

// 2. SPASI IZVJEŠTAJ
export async function saveProductivityReport(
  restaurantId: string,
  date: string,
  hourlyData: Prisma.InputJsonValue,
  targetProd: number,
  netCoeff: number
) {
  try {
    await guardProductivityRestaurant(restaurantId);
    await prisma.productivityReport.upsert({
      where: { restaurantId_date: { restaurantId, date } },
      update: { hourlyData, targetProd, netCoeff },
      create: { restaurantId, date, hourlyData, targetProd, netCoeff },
    });
    revalidatePath("/tools/productivity");
    return { success: true };
  } catch (e) {
    if (e instanceof PermissionDeniedError) throw e;
    console.error(e);
    return { success: false };
  }
}

// 3. SPASI RADNO VRIJEME (Globalno za restoran)
export async function saveOpeningHours(restaurantId: string, hoursConfig: Record<string, unknown>) {
  try {
    await guardProductivityRestaurant(restaurantId);
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { openingHours: hoursConfig as Prisma.InputJsonValue },
    });
    return { success: true };
  } catch (e) {
    if (e instanceof PermissionDeniedError) throw e;
    return { success: false };
  }
}

// 4. DOHVATI MJESEČNE PODATKE (NOVO)
export async function getMonthlyProductivityData(restaurantId: string, yearMonth: string) {
  try {
    await guardProductivityRestaurant(restaurantId);
    const reports = await prisma.productivityReport.findMany({
      where: {
        restaurantId,
        date: {
          startsWith: yearMonth,
        },
      },
      orderBy: {
        date: "asc",
      },
    });
    return reports;
  } catch (e) {
    if (e instanceof PermissionDeniedError) throw e;
    console.error("Monthly fetch error:", e);
    return [];
  }
}

