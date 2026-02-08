"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface LaborDayInput {
  umsatz?: string;
  prod?: string;
  sfStd?: string;
  hmStd?: string;
  nz?: string;
  extra?: string;
  [key: string]: string | undefined;
}

export interface LaborInputs {
  avgWage?: string;
  vacationStd?: string;
  sickStd?: string;
  extraUnprodStd?: string;
  taxAustria?: string;
  budgetUmsatz?: string;
  budgetCL?: string;
  budgetCLPct?: string;
}

export interface LaborPlanPayload {
  inputs?: LaborInputs;
  rows?: LaborDayInput[];
}

/** Dohvat podataka za restoran + mjesec + godinu (samo taj restoran). */
export async function getLaborData(restaurantId: string, month: number, year: number) {
  if (!restaurantId) return null;
  try {
    const report = await prisma.laborReport.findUnique({
      where: {
        restaurantId_month_year: { restaurantId, month, year },
      },
    });
    if (!report) return null;
    const daysData = report.daysData as LaborPlanPayload | null;
    return { ...report, data: daysData ?? { inputs: {}, rows: [] } };
  } catch (error) {
    console.error("getLaborData:", error);
    return null;
  }
}

/** Spremanje cijelog payloada (inputs + rows) u LaborReport. */
export async function saveLaborData(
  restaurantId: string,
  month: number,
  year: number,
  payload: LaborPlanPayload
) {
  if (!restaurantId) return { success: false, error: "Restaurant fehlt." };
  try {
    const inputs = payload.inputs ?? {};
    const rows = payload.rows ?? [];
    const hourlyWage = parseFloat(String(inputs.avgWage || "0").replace(",", ".")) || 0;
    const budgetSales = parseFloat(String(inputs.budgetUmsatz || "0").replace(",", ".")) || 0;
    const budgetCost = parseFloat(String(inputs.budgetCL || "0").replace(",", ".")) || 0;

    await prisma.laborReport.upsert({
      where: { restaurantId_month_year: { restaurantId, month, year } },
      update: {
        daysData: payload as object,
        hourlyWage,
        budgetSales,
        budgetCost,
      },
      create: {
        restaurantId,
        month,
        year,
        daysData: payload as object,
        hourlyWage,
        budgetSales,
        budgetCost,
      },
    });
    revalidatePath("/tools/labor-planner");
    return { success: true };
  } catch (error) {
    console.error("saveLaborData:", error);
    return { success: false, error: "Fehler beim Speichern." };
  }
}

/** Dohvat svih mjeseci za godinu (za godišnji PDF). */
export async function getYearlyLaborData(restaurantId: string, year: number) {
  try {
    return await prisma.laborReport.findMany({
      where: { restaurantId, year },
      orderBy: { month: "asc" },
    });
  } catch (error) {
    console.error("getYearlyLaborData:", error);
    return [];
  }
}