"use server";

import prisma from "@/lib/prisma";

/* ─────────────────────────────────────────────────────────────────── */
/* Types                                                               */
/* ─────────────────────────────────────────────────────────────────── */

export type CLMonthRow = {
  restaurantId: string;
  restaurantName: string;
  restaurantCode: string;
  year: number;
  month: number;
  /** Budget CL € (LaborReport.budgetCost) */
  budgetCL: number;
  /** Budget Umsatz (LaborReport.budgetSales) */
  budgetUmsatz: number;
  /** Budget CL % (aus daysData.inputs.budgetCLPct) */
  budgetCLPct: number;
  /** Tatsächlicher CL € — berechnet aus daysData */
  actualCL: number;
  /** Tatsächlicher Netto-Umsatz — berechnet aus daysData */
  actualUmsatz: number;
  /** CL % tatsächlich */
  actualCLPct: number;
  /** Differenz: budgetCL − actualCL (positiv = Einsparung, negativ = Überschreitung) */
  diffCL: number;
  /** Differenz Prozentpunkte: budgetCLPct − actualCLPct */
  diffPct: number;
  /** Gesamt Stunden tatsächlich */
  actualGesamtStd: number;
  /** Hat Daten (daysData befüllt) */
  hasData: boolean;
};

export type RestaurantOption = {
  id: string;
  code: string;
  name: string | null;
};

/* ─────────────────────────────────────────────────────────────────── */
/* Helpers (identische Formeln wie LaborPlannerClient.tsx)            */
/* ─────────────────────────────────────────────────────────────────── */

/**
 * Robuster Parser für Europäische Zahlen (de-AT/de-DE).
 * "90.000"    → 90000  (Punkt = Tausendertrennzeichen)
 * "90.000,50" → 90000.5
 * "12,50"     → 12.5
 * "12.5"      → 12.5   (Punkt = Dezimal wenn ≠ 3 Stellen danach)
 */
function parseDE(v: string | null | undefined): number {
  if (!v) return 0;
  const str = String(v).trim().replace(/\s/g, "");
  if (!str) return 0;
  const hasComma = str.includes(",");
  if (hasComma) {
    const clean = str.replace(/\./g, "").replace(",", ".");
    return parseFloat(clean) || 0;
  }
  const lastDot = str.lastIndexOf(".");
  if (lastDot === -1) return parseInt(str.replace(/\D/g, ""), 10) || 0;
  const afterDot = str.slice(lastDot + 1);
  const beforeDot = str.slice(0, lastDot).replace(/\./g, "");
  if (/^\d{3}$/.test(afterDot) && /^\d{1,3}$/.test(beforeDot)) {
    return parseInt(str.replace(/\./g, ""), 10) || 0;
  }
  return parseFloat(beforeDot + "." + afterDot.replace(/\D/g, "")) || 0;
}

type DayRow = {
  bruttoUmsatz?: string;
  umsatz?: string;        // deprecated alias
  nettoUmsatz?: string;   // fallback netto
  geplanteProduktivitaetPct?: string; // needed for recalculation
  produktiveStd?: string; // saved rounded value — only used as last fallback
  sfStd?: string;
  hmStd?: string;
  nzEuro?: string;
  nz?: string;    // deprecated alias
  extraStd?: string;
  extra?: string; // deprecated alias
};

/**
 * Identische Formel wie calcProduktiveStdForDay in LaborPlannerClient.tsx:
 * produktiveStd = (netto / geplanteProduktivitaetPct) − sfStd
 * Nur so stimmt der Wert exakt mit dem Labour Planner überein.
 */
function calcProduktiveStd(row: DayRow, koeff: number): number {
  const brutto = parseDE(row.bruttoUmsatz ?? row.umsatz);
  const fallbackNetto = parseDE(row.nettoUmsatz);
  const netto = koeff > 0 && brutto > 0 ? brutto / koeff : fallbackNetto;
  const geplanteProd = parseDE(row.geplanteProduktivitaetPct);
  const sf = parseDE(row.sfStd);
  if (netto <= 0 || geplanteProd <= 0) {
    // Fallback: use saved produktiveStd if formula inputs unavailable
    return parseDE(row.produktiveStd);
  }
  const result = netto / geplanteProd - sf;
  return Number.isFinite(result) && result >= 0 ? result : 0;
}

type Inputs = {
  avgWage?: string;
  vacationStd?: string;
  sickStd?: string;
  foerderung?: string;
  koefficientBruttoNetto?: string;
  budgetCLPct?: string;
  /** Originaler Eingabestring für Budget CL € (inkl. Tausenderpunkte) */
  budgetCL?: string;
  /** Originaler Eingabestring für Budget Umsatz € */
  budgetUmsatz?: string;
};

type DaysDataPayload = {
  inputs?: Inputs;
  rows?: DayRow[];
};

function computeCLFromDaysData(
  daysData: unknown,
  budgetSales: number,
  budgetCost: number,
  fallbackHourlyWage = 0
): Omit<CLMonthRow, "restaurantId" | "restaurantName" | "restaurantCode" | "year" | "month"> {
  const payload = daysData as DaysDataPayload | null;
  const inputs = payload?.inputs ?? {};
  const rows: DayRow[] = Array.isArray(payload?.rows) ? (payload!.rows as DayRow[]) : [];

  // Fallback to DB hourlyWage column wenn inputs.avgWage fehlt
  const avgWage = parseDE(inputs.avgWage) || fallbackHourlyWage;
  const vacationStd = parseDE(inputs.vacationStd);
  const sickStd = parseDE(inputs.sickStd);
  const foerderung = parseDE(inputs.foerderung);
  const budgetCLPct = parseDE(inputs.budgetCLPct);

  // Prefer JSON input strings for budget values — they contain the original user entry
  // (e.g. "90.000") which our parser handles correctly, while the DB column may have
  // been saved with the old broken parseFloat("90.000") = 90.
  const budgetCLFromInputs = inputs.budgetCL ? parseDE(inputs.budgetCL) : 0;
  const budgetUmsatzFromInputs = inputs.budgetUmsatz ? parseDE(inputs.budgetUmsatz) : 0;
  const effectiveBudgetCost = budgetCLFromInputs > 0 ? budgetCLFromInputs : budgetCost;
  const effectiveBudgetSales = budgetUmsatzFromInputs > 0 ? budgetUmsatzFromInputs : budgetSales;
  const koeff =
    inputs.koefficientBruttoNetto && parseDE(inputs.koefficientBruttoNetto) > 0
      ? parseDE(inputs.koefficientBruttoNetto)
      : 1.118;

  let sumBrutto = 0;
  let sumProduktiveStd = 0;
  let sumHM = 0;
  let sumNZ = 0;
  let sumExtra = 0;

  for (const row of rows) {
    const brutto = parseDE(row.bruttoUmsatz ?? row.umsatz);
    sumBrutto += brutto;
    // Use formula (identical to Labour Planner) instead of the saved rounded integer
    sumProduktiveStd += calcProduktiveStd(row, koeff);
    sumHM += parseDE(row.hmStd);
    sumNZ += parseDE(row.nzEuro ?? row.nz);
    sumExtra += parseDE(row.extraStd ?? row.extra);
  }

  const actualUmsatz = koeff > 0 ? sumBrutto / koeff : 0;
  const gesamtStd = sumProduktiveStd + sumHM + vacationStd + sickStd + sumExtra;
  const actualCL =
    avgWage > 0 && (gesamtStd > 0 || sumNZ > 0)
      ? Math.max(0, gesamtStd * avgWage + sumNZ - foerderung)
      : 0;
  const actualCLPct = actualUmsatz > 0 ? (actualCL / actualUmsatz) * 100 : 0;
  const diffCL = effectiveBudgetCost - actualCL;
  const diffPct = budgetCLPct - actualCLPct;

  const hasData = rows.length > 0 && sumBrutto > 0;

  return {
    budgetCL: effectiveBudgetCost,
    budgetUmsatz: effectiveBudgetSales,
    budgetCLPct,
    actualCL,
    actualUmsatz,
    actualCLPct,
    diffCL,
    diffPct,
    actualGesamtStd: gesamtStd,
    hasData,
  };
}

/* ─────────────────────────────────────────────────────────────────── */
/* Server Actions                                                      */
/* ─────────────────────────────────────────────────────────────────── */

/** Alle aktiven Restaurants (für Filter-Dropdown). */
export async function getActiveRestaurantsForCLAnalyse(): Promise<RestaurantOption[]> {
  const restaurants = await prisma.restaurant.findMany({
    where: {
      isActive: true,
      // Exclude the internal AIW Office entry
      NOT: { code: { contains: "OFFICE" } },
    },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
  return restaurants;
}

/**
 * Hauptabfrage: LaborReport-Daten für gewählte Restaurants und Jahre.
 * Berechnet Ist-CL server-seitig aus daysData JSON.
 */
export async function getClAnalyseData(
  restaurantIds: string[],
  years: number[]
): Promise<CLMonthRow[]> {
  if (restaurantIds.length === 0 || years.length === 0) return [];

  const reports = await prisma.laborReport.findMany({
    where: {
      restaurantId: { in: restaurantIds },
      year: { in: years },
    },
    include: {
      restaurant: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ restaurantId: "asc" }, { year: "asc" }, { month: "asc" }],
  });

  return reports.map((r) => {
    const computed = computeCLFromDaysData(r.daysData, r.budgetSales, r.budgetCost, r.hourlyWage);
    return {
      restaurantId: r.restaurantId,
      restaurantName: r.restaurant.name ?? r.restaurant.code,
      restaurantCode: r.restaurant.code,
      year: r.year,
      month: r.month,
      ...computed,
    };
  });
}
