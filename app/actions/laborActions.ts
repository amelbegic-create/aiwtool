"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Definicija sučelja za ulazne podatke (zamjena za any)
interface LaborDayInput {
  umsatz?: string;
  prod?: string;
  sfStd?: string;
  hmStd?: string;
  nz?: string;
  extra?: string;
  [key: string]: string | undefined; // Fleksibilnost
}

// Dohvatanje podataka za određeni mjesec i godinu
export async function getLaborData(restaurantId: string, month: number, year: number) {
  try {
    const report = await prisma.laborReport.findUnique({
      where: {
        restaurantId_month_year: {
          restaurantId,
          month,
          year,
        },
      },
    });
    return report;
  } catch (error) {
    console.error("Greška pri dohvatu Labor podataka:", error);
    return null;
  }
}

// Čuvanje ili ažuriranje izvještaja (Upsert)
export async function saveLaborReport(
  restaurantId: string, 
  month: number, 
  year: number, 
  daysData: LaborDayInput[], 
  hourlyWage: number,
  budgetSales: number,
  budgetCost: number
) {
  try {
    const report = await prisma.laborReport.upsert({
      where: {
        restaurantId_month_year: { restaurantId, month, year }
      },
      update: {
        daysData,
        hourlyWage,
        budgetSales,
        budgetCost,
        updatedAt: new Date()
      },
      create: {
        restaurantId,
        month,
        year,
        daysData,
        hourlyWage,
        budgetSales,
        budgetCost
      }
    });
    
    revalidatePath("/tools/labor-planner");
    return { success: true, data: report };
  } catch (error) {
    console.error("Greška pri čuvanju Labor izvještaja:", error);
    return { success: false, error: "Neuspješno čuvanje u bazu." };
  }
}

// Dohvatanje svih podataka za godinu (za Godišnji PDF)
export async function getYearlyLaborData(restaurantId: string, year: number) {
  try {
    return await prisma.laborReport.findMany({
      where: { restaurantId, year },
      orderBy: { month: 'asc' }
    });
  } catch (error) {
    console.error("Greška pri dohvatu godišnjih podataka:", error);
    return [];
  }
}