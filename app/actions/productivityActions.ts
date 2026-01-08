"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// 1. DOHVATI IZVJEŠTAJ I KONFIGURACIJU
export async function getProductivityData(restaurantId: string, date: string) {
  try {
    // Dohvati izvještaj za taj dan
    const report = await prisma.productivityReport.findUnique({
      where: { restaurantId_date: { restaurantId, date } }
    });

    // Dohvati restoran za radno vrijeme
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { openingHours: true }
    });

    return { 
      report, 
      openingHours: restaurant?.openingHours ? JSON.parse(JSON.stringify(restaurant.openingHours)) : null 
    };
  } catch (error) {
    return { report: null, openingHours: null };
  }
}

// 2. SPASI IZVJEŠTAJ
export async function saveProductivityReport(
  restaurantId: string, 
  date: string, 
  hourlyData: any, 
  targetProd: number,
  netCoeff: number
) {
  try {
    await prisma.productivityReport.upsert({
      where: { restaurantId_date: { restaurantId, date } },
      update: { hourlyData, targetProd, netCoeff },
      create: { restaurantId, date, hourlyData, targetProd, netCoeff }
    });
    revalidatePath("/tools/productivity");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false };
  }
}

// 3. SPASI RADNO VRIJEME (Globalno za restoran)
export async function saveOpeningHours(restaurantId: string, hoursConfig: any) {
  try {
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { openingHours: hoursConfig }
    });
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}
// ... (postojeći kod) ...

// 4. DOHVATI MJESEČNE PODATKE (NOVO)
export async function getMonthlyProductivityData(restaurantId: string, yearMonth: string) {
  // yearMonth format: "YYYY-MM" (npr. "2026-01")
  try {
    const reports = await prisma.productivityReport.findMany({
      where: {
        restaurantId,
        date: {
          startsWith: yearMonth // Daj sve koji počinju sa ovim mjesecom
        }
      },
      orderBy: {
        date: 'asc' // Poredaj od 1. do 31.
      }
    });
    return reports;
  } catch (error) {
    console.error("Monthly fetch error:", error);
    return [];
  }
}