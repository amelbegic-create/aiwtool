"use server";

import prisma from "@/lib/prisma";

/**
 * Robuster Parser für Europäische Zahlen (de-AT/de-DE):
 * "90.000"   → 90000  (Punkt = Tausendertrennzeichen)
 * "90.000,50" → 90000.5
 * "12,50"    → 12.5
 * "12.5"     → 12.5   (Punkt = Dezimal wenn nicht 3 Stellen danach)
 */
function parseEuroInput(v: string | null | undefined): number {
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
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
  type LaborPlanPayload,
  type LaborAuthContext,
  type LaborClClientState,
  type LaborDataApiResult,
  canBypassClLock,
  CL_LOCK_ENABLED,
  defaultClState,
} from "@/lib/laborPlannerCl";
import { stealthArchitectWhere } from "@/lib/userVisibility";

export type {
  LaborDayInput,
  LaborInputs,
  LaborPlanPayload,
  LaborAuthContext,
  LaborClClientState,
  LaborDataApiResult,
} from "@/lib/laborPlannerCl";

/** Hours — edit grant after unlock approval */
const CL_EDIT_GRANT_HOURS = 72;

async function viewerHasLaborRestaurantAccess(
  viewerId: string,
  viewerRole: string,
  restaurantId: string
): Promise<boolean> {
  if (canBypassClLock(viewerRole)) return true;
  const rel = await prisma.restaurantUser.findFirst({
    where: { userId: viewerId, restaurantId },
    select: { id: true },
  });
  return !!rel;
}

function grantIsActive(report: {
  clEditGrantUserId: string | null;
  clEditGrantUntil: Date | null;
}): boolean {
  if (!report.clEditGrantUserId || !report.clEditGrantUntil) return false;
  return new Date() < report.clEditGrantUntil;
}

async function expireClGrantIfNeeded(
  report: { id: string; clEditGrantUntil: Date | null; clEditGrantUserId: string | null }
): Promise<void> {
  if (!report.clEditGrantUntil || !report.clEditGrantUserId) return;
  if (new Date() < report.clEditGrantUntil) return;
  await prisma.laborReport.update({
    where: { id: report.id },
    data: { clEditGrantUserId: null, clEditGrantUntil: null },
  });
}

async function buildLaborClClientState(
  report: {
    id: string;
    restaurantId: string;
    clLocked: boolean;
    clLockedAt: Date | null;
    clLockedByUserId: string | null;
    clUnlockRequestedAt: Date | null;
    clUnlockRequestedByUserId: string | null;
    clUnlockRequestNote: string | null;
    clEditGrantUserId: string | null;
    clEditGrantUntil: Date | null;
  },
  viewerId: string,
  viewerRole: string
): Promise<LaborClClientState> {
  if (!CL_LOCK_ENABLED) return defaultClState();
  await expireClGrantIfNeeded(report);
  const fresh = await prisma.laborReport.findUnique({
    where: { id: report.id },
    select: {
      id: true,
      clLocked: true,
      clLockedAt: true,
      clLockedByUserId: true,
      clUnlockRequestedAt: true,
      clUnlockRequestedByUserId: true,
      clUnlockRequestNote: true,
      clEditGrantUserId: true,
      clEditGrantUntil: true,
    },
  });
  if (!fresh) return defaultClState();

  const bypass = canBypassClLock(viewerRole);
  const pending =
    !!fresh.clUnlockRequestedAt &&
    !!fresh.clUnlockRequestedByUserId &&
    !fresh.clEditGrantUserId;

  let requesterSupervisorId: string | null = null;
  if (pending && fresh.clUnlockRequestedByUserId) {
    const u = await prisma.user.findUnique({
      where: { id: fresh.clUnlockRequestedByUserId },
      select: { supervisorId: true },
    });
    requesterSupervisorId = u?.supervisorId ?? null;
  }

  const activeGrant = grantIsActive(fresh);
  const canEdit =
    bypass ||
    !fresh.clLocked ||
    (activeGrant && fresh.clEditGrantUserId === viewerId);

  const canApproveUnlock =
    pending &&
    (bypass || (requesterSupervisorId !== null && requesterSupervisorId === viewerId));

  let canRevokeClEdit = false;
  if (fresh.clLocked && activeGrant && fresh.clEditGrantUserId) {
    const grantee = await prisma.user.findUnique({
      where: { id: fresh.clEditGrantUserId },
      select: { supervisorId: true },
    });
    canRevokeClEdit = bypass || grantee?.supervisorId === viewerId;
  }

  let canGrantClEdit = false;
  if (fresh.clLocked && !pending && !activeGrant) {
    if (bypass) {
      canGrantClEdit = true;
    } else {
      const subCount = await prisma.user.count({
        where: {
          supervisorId: viewerId,
          isActive: true,
          restaurants: { some: { restaurantId: report.restaurantId } },
        },
      });
      canGrantClEdit = subCount > 0;
    }
  }

  return {
    reportId: fresh.id,
    clLocked: fresh.clLocked,
    clLockedAt: fresh.clLockedAt?.toISOString() ?? null,
    clLockedByUserId: fresh.clLockedByUserId,
    clUnlockRequestedAt: fresh.clUnlockRequestedAt?.toISOString() ?? null,
    clUnlockRequestedByUserId: fresh.clUnlockRequestedByUserId,
    clUnlockRequestNote: fresh.clUnlockRequestNote,
    clEditGrantUserId: fresh.clEditGrantUserId,
    clEditGrantUntil: fresh.clEditGrantUntil?.toISOString() ?? null,
    hasPendingUnlockRequest: pending,
    canEdit,
    canApproveUnlock,
    canRevokeClEdit,
    canGrantClEdit,
    canBypassClLock: bypass,
  };
}

/** Dohvat podataka za restoran + mjesec + godinu (+ CL lock stanje za viewer). */
export async function getLaborData(
  restaurantId: string,
  month: number,
  year: number,
  viewer: LaborAuthContext
): Promise<LaborDataApiResult | null> {
  if (!restaurantId) return null;
  try {
    const report = await prisma.laborReport.findUnique({
      where: {
        restaurantId_month_year: { restaurantId, month, year },
      },
    });
    if (!report) {
      return { data: { inputs: {}, rows: [] }, cl: defaultClState() };
    }

    await expireClGrantIfNeeded(report);

    const daysData = report.daysData as LaborPlanPayload | null;
    let data: LaborPlanPayload = daysData ?? { inputs: {}, rows: [] };

    // Fallback: wenn avgWage im JSON fehlt, aber hourlyWage-Spalte in DB gesetzt ist
    if (report.hourlyWage > 0 && !data.inputs?.avgWage) {
      data = {
        ...data,
        inputs: {
          ...data.inputs,
          avgWage: report.hourlyWage.toFixed(2).replace(".", ","),
        },
      };
    }

    const cl = await buildLaborClClientState(report, viewer.userId, viewer.role);
    return { data, cl };
  } catch (error) {
    console.error("getLaborData:", error);
    return null;
  }
}

async function assertCanSaveLabor(
  report: {
    id: string;
    clLocked: boolean;
    clEditGrantUserId: string | null;
    clEditGrantUntil: Date | null;
  } | null,
  userId: string,
  role: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!CL_LOCK_ENABLED) return { ok: true };
  if (canBypassClLock(role)) return { ok: true };
  if (!report || !report.clLocked) return { ok: true };
  if (grantIsActive(report) && report.clEditGrantUserId === userId) return { ok: true };
  return { ok: false, error: "Monat ist gesperrt. Bearbeitung nicht möglich." };
}

/** Spremanje cijelog payloada (inputs + rows) u LaborReport — s CL lock provjerom. */
export async function saveLaborData(
  restaurantId: string,
  month: number,
  year: number,
  payload: LaborPlanPayload,
  auth: LaborAuthContext
) {
  if (!restaurantId) return { success: false, error: "Restaurant fehlt." };
  try {
    const existing = await prisma.laborReport.findUnique({
      where: { restaurantId_month_year: { restaurantId, month, year } },
      select: {
        id: true,
        clLocked: true,
        clEditGrantUserId: true,
        clEditGrantUntil: true,
      },
    });

    if (existing) await expireClGrantIfNeeded(existing);

    const existing2 = existing
      ? await prisma.laborReport.findUnique({
          where: { id: existing.id },
          select: {
            id: true,
            clLocked: true,
            clEditGrantUserId: true,
            clEditGrantUntil: true,
          },
        })
      : null;

    const gate = await assertCanSaveLabor(existing2, auth.userId, auth.role);
    if (!gate.ok) return { success: false, error: gate.error };

    const inputs = payload.inputs ?? {};
    const rows = payload.rows ?? [];
    const hourlyWage = parseEuroInput(inputs.avgWage);
    const budgetSales = parseEuroInput(inputs.budgetUmsatz);
    const budgetCost = parseEuroInput(inputs.budgetCL);

    const wasGranteeSave =
      existing2?.clLocked &&
      existing2.clEditGrantUserId === auth.userId &&
      grantIsActive(existing2);

    const lockUpdate = wasGranteeSave
      ? {
          clEditGrantUserId: null as string | null,
          clEditGrantUntil: null as Date | null,
          clLocked: true,
          clLockedAt: new Date(),
          clLockedByUserId: auth.userId,
        }
      : {};

    await prisma.laborReport.upsert({
      where: { restaurantId_month_year: { restaurantId, month, year } },
      update: {
        daysData: payload as object,
        hourlyWage,
        budgetSales,
        budgetCost,
        ...lockUpdate,
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
    const message = error instanceof Error ? error.message : "Fehler beim Speichern.";
    return { success: false, error: message };
  }
}

/** Brisanje podataka za restoran + mjesec + godinu. */
export async function deleteLaborData(
  restaurantId: string,
  month: number,
  year: number,
  auth: LaborAuthContext
) {
  if (!restaurantId) return { success: false, error: "Restaurant fehlt." };
  try {
    const existing = await prisma.laborReport.findUnique({
      where: { restaurantId_month_year: { restaurantId, month, year } },
      select: { id: true, clLocked: true, clEditGrantUserId: true, clEditGrantUntil: true },
    });
    if (existing) await expireClGrantIfNeeded(existing);
    const ex2 = existing
      ? await prisma.laborReport.findUnique({
          where: { id: existing.id },
          select: { clLocked: true, clEditGrantUserId: true, clEditGrantUntil: true },
        })
      : null;
    if (ex2?.clLocked && !canBypassClLock(auth.role)) {
      return { success: false, error: "Gesperrter Monat kann nicht gelöscht werden." };
    }

    await prisma.laborReport.deleteMany({
      where: { restaurantId, month, year },
    });
    revalidatePath("/tools/labor-planner");
    return { success: true };
  } catch (error: unknown) {
    const isNotFound = error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2025";
    if (isNotFound) return { success: true };
    console.error("deleteLaborData:", error);
    return { success: false, error: "Fehler beim Löschen." };
  }
}

/** Završi mjesec: spremi podatke + zaključaj. */
export async function finishClMonth(
  restaurantId: string,
  month: number,
  year: number,
  payload: LaborPlanPayload
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = String((session?.user as { role?: string })?.role ?? "");
  if (!userId) return { success: false, error: "Nicht angemeldet." };

  try {
    const inputs = payload.inputs ?? {};
    const rows = payload.rows ?? [];
    const hourlyWage = parseEuroInput(inputs.avgWage);
    const budgetSales = parseEuroInput(inputs.budgetUmsatz);
    const budgetCost = parseEuroInput(inputs.budgetCL);

    await prisma.laborReport.upsert({
      where: { restaurantId_month_year: { restaurantId, month, year } },
      update: {
        daysData: payload as object,
        hourlyWage,
        budgetSales,
        budgetCost,
        clLocked: true,
        clLockedAt: new Date(),
        clLockedByUserId: userId,
        clUnlockRequestedAt: null,
        clUnlockRequestedByUserId: null,
        clUnlockRequestNote: null,
        clEditGrantUserId: null,
        clEditGrantUntil: null,
      },
      create: {
        restaurantId,
        month,
        year,
        daysData: payload as object,
        hourlyWage,
        budgetSales,
        budgetCost,
        clLocked: true,
        clLockedAt: new Date(),
        clLockedByUserId: userId,
      },
    });
    revalidatePath("/tools/labor-planner");
    return { success: true };
  } catch (e) {
    console.error("finishClMonth:", e);
    return { success: false, error: "Fehler beim Sperren des Monats." };
  }
}

/** Zahtjev za otključavanje (locked mora biti true). */
export async function requestClUnlock(
  restaurantId: string,
  month: number,
  year: number,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return { success: false, error: "Nicht angemeldet." };

  const report = await prisma.laborReport.findUnique({
    where: { restaurantId_month_year: { restaurantId, month, year } },
    select: {
      id: true,
      clLocked: true,
      clUnlockRequestedAt: true,
      clEditGrantUserId: true,
    },
  });
  if (!report || !report.clLocked) {
    return { success: false, error: "Monat ist nicht gesperrt." };
  }
  const pending =
    !!report.clUnlockRequestedAt && !report.clEditGrantUserId;
  if (pending) {
    return { success: false, error: "Entsperranfrage bereits gesendet." };
  }

  await prisma.laborReport.update({
    where: { id: report.id },
    data: {
      clUnlockRequestedAt: new Date(),
      clUnlockRequestedByUserId: userId,
      clUnlockRequestNote: note?.trim() || null,
    },
  });
  revalidatePath("/tools/labor-planner");
  return { success: true };
}

/** Odobri privremeno uređivanje za korisnika koji je tražio. */
export async function approveClUnlock(
  restaurantId: string,
  month: number,
  year: number
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  const viewerId = (session?.user as { id?: string })?.id;
  const viewerRole = String((session?.user as { role?: string })?.role ?? "");
  if (!viewerId) return { success: false, error: "Nicht angemeldet." };

  const report = await prisma.laborReport.findUnique({
    where: { restaurantId_month_year: { restaurantId, month, year } },
    select: {
      id: true,
      clLocked: true,
      clUnlockRequestedAt: true,
      clUnlockRequestedByUserId: true,
      clEditGrantUserId: true,
    },
  });
  if (!report?.clLocked || !report.clUnlockRequestedByUserId || !report.clUnlockRequestedAt) {
    return { success: false, error: "Keine offene Entsperranfrage." };
  }
  if (report.clEditGrantUserId) {
    return { success: false, error: "Bereits freigegeben." };
  }

  const requester = await prisma.user.findUnique({
    where: { id: report.clUnlockRequestedByUserId },
    select: { supervisorId: true },
  });
  const can =
    canBypassClLock(viewerRole) ||
    (requester?.supervisorId && requester.supervisorId === viewerId);
  if (!can) {
    return { success: false, error: "Keine Berechtigung zur Freigabe." };
  }

  const until = new Date(Date.now() + CL_EDIT_GRANT_HOURS * 60 * 60 * 1000);
  await prisma.laborReport.update({
    where: { id: report.id },
    data: {
      clEditGrantUserId: report.clUnlockRequestedByUserId,
      clEditGrantUntil: until,
      clUnlockRequestedAt: null,
      clUnlockRequestedByUserId: null,
      clUnlockRequestNote: null,
    },
  });
  revalidatePath("/tools/labor-planner");
  return { success: true };
}

/** Lista korisnika koje supervisor vidi kao podređene u restoranu; God-mode vidi sve (osim stealth arhitekta). */
export async function listLaborClGrantCandidates(
  restaurantId: string
): Promise<{ id: string; name: string | null; email: string | null }[]> {
  const session = await getServerSession(authOptions);
  const viewerId = (session?.user as { id?: string })?.id;
  const viewerRole = String((session?.user as { role?: string })?.role ?? "");
  if (!viewerId || !restaurantId) return [];

  const ok = await viewerHasLaborRestaurantAccess(viewerId, viewerRole, restaurantId);
  if (!ok) return [];

  if (canBypassClLock(viewerRole)) {
    return prisma.user.findMany({
      where: {
        ...stealthArchitectWhere(viewerRole),
        isActive: true,
        restaurants: { some: { restaurantId } },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
  }

  return prisma.user.findMany({
    where: {
      supervisorId: viewerId,
      isActive: true,
      restaurants: { some: { restaurantId } },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Nadređeni ili God-mode: dodijeli privremeno uređivanje odabranom korisniku (bez čekanja unlock zahtjeva).
 * Mjesec mora biti zaključan, bez aktivnog granta.
 */
export async function grantClTemporaryEdit(
  restaurantId: string,
  month: number,
  year: number,
  granteeUserId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  const viewerId = (session?.user as { id?: string })?.id;
  const viewerRole = String((session?.user as { role?: string })?.role ?? "");
  if (!viewerId) return { success: false, error: "Nicht angemeldet." };
  if (!granteeUserId) return { success: false, error: "Mitarbeiter fehlt." };

  const access = await viewerHasLaborRestaurantAccess(viewerId, viewerRole, restaurantId);
  if (!access) return { success: false, error: "Kein Zugriff auf diesen Standort." };

  const grantee = await prisma.user.findUnique({
    where: { id: granteeUserId },
    select: { id: true, supervisorId: true },
  });
  if (!grantee) return { success: false, error: "Benutzer nicht gefunden." };

  const atRestaurant = await prisma.restaurantUser.findFirst({
    where: { userId: granteeUserId, restaurantId },
    select: { id: true },
  });
  if (!atRestaurant) {
    return { success: false, error: "Mitarbeiter gehört nicht zu diesem Restaurant." };
  }

  const allowed =
    canBypassClLock(viewerRole) || grantee.supervisorId === viewerId;
  if (!allowed) return { success: false, error: "Keine Berechtigung." };

  const existing = await prisma.laborReport.findUnique({
    where: { restaurantId_month_year: { restaurantId, month, year } },
    select: {
      id: true,
      clLocked: true,
      clEditGrantUserId: true,
      clEditGrantUntil: true,
    },
  });
  if (!existing) return { success: false, error: "Kein CL-Bericht für diesen Monat." };

  if (existing.clLocked) await expireClGrantIfNeeded(existing);

  const ex2 = await prisma.laborReport.findUnique({
    where: { id: existing.id },
    select: { id: true, clLocked: true, clEditGrantUserId: true, clEditGrantUntil: true },
  });
  if (!ex2?.clLocked) return { success: false, error: "Monat ist nicht gesperrt." };
  if (grantIsActive(ex2)) {
    return { success: false, error: "Bearbeitung ist bereits freigegeben." };
  }

  const until = new Date(Date.now() + CL_EDIT_GRANT_HOURS * 60 * 60 * 1000);
  await prisma.laborReport.update({
    where: { id: ex2.id },
    data: {
      clEditGrantUserId: granteeUserId,
      clEditGrantUntil: until,
      clUnlockRequestedAt: null,
      clUnlockRequestedByUserId: null,
      clUnlockRequestNote: null,
    },
  });
  revalidatePath("/tools/labor-planner");
  return { success: true };
}

/** Nadređeni korisnika s grantom ili God-mode: opozove aktivnu privremenu freigabe (odmah ponovo read-only za tog korisnika). */
export async function revokeClEditGrant(
  restaurantId: string,
  month: number,
  year: number
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  const viewerId = (session?.user as { id?: string })?.id;
  const viewerRole = String((session?.user as { role?: string })?.role ?? "");
  if (!viewerId) return { success: false, error: "Nicht angemeldet." };

  const access = await viewerHasLaborRestaurantAccess(viewerId, viewerRole, restaurantId);
  if (!access) return { success: false, error: "Kein Zugriff auf diesen Standort." };

  const report = await prisma.laborReport.findUnique({
    where: { restaurantId_month_year: { restaurantId, month, year } },
    select: {
      id: true,
      clLocked: true,
      clEditGrantUserId: true,
      clEditGrantUntil: true,
    },
  });
  if (!report?.clLocked || !report.clEditGrantUserId || !report.clEditGrantUntil) {
    return { success: false, error: "Keine aktive Bearbeitungsfreigabe." };
  }
  if (!grantIsActive(report)) {
    return { success: false, error: "Freigabe ist abgelaufen." };
  }

  const grantee = await prisma.user.findUnique({
    where: { id: report.clEditGrantUserId },
    select: { supervisorId: true },
  });
  const can =
    canBypassClLock(viewerRole) || grantee?.supervisorId === viewerId;
  if (!can) return { success: false, error: "Keine Berechtigung." };

  await prisma.laborReport.update({
    where: { id: report.id },
    data: {
      clEditGrantUserId: null,
      clEditGrantUntil: null,
    },
  });
  revalidatePath("/tools/labor-planner");
  return { success: true };
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
