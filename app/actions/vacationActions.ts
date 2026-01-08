"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// 1. DOHVATI PRAZNIKE ZA RESTORAN
export async function getBlockedDays(restaurantId: string) {
  try {
    const days = await prisma.blockedDay.findMany({
      where: { restaurantId },
    });
    // Pretvorimo u format koji frontend očekuje: Record<string, string>
    const blockedMap: Record<string, string> = {};
    days.forEach(day => {
      blockedMap[day.date] = day.reason || "Praznik";
    });
    return blockedMap;
  } catch (error) {
    return {};
  }
}

// 2. DODAJ PRAZNIK
export async function addBlockedDay(restaurantId: string, date: string, reason: string) {
  try {
    await prisma.blockedDay.create({
      data: { restaurantId, date, reason }
    });
    revalidatePath("/tools/vacations");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

// 3. OBRIŠI PRAZNIK
export async function removeBlockedDay(restaurantId: string, date: string) {
  try {
    await prisma.blockedDay.deleteMany({
      where: { restaurantId, date }
    });
    revalidatePath("/tools/vacations");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}