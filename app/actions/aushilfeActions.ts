"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

const REVALIDATE = "/tools/aushilfe";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

export type HelpSlotRow = {
  id: string;
  workerName: string;
  providingRestaurantId: string;
  providingRestaurant: { code: string; name: string | null };
  providerManagerId: string | null;
  providerManager: { name: string | null; email: string | null } | null;
  createdAt: Date;
};

export type HelpRequestRow = {
  id: string;
  date: string;
  shiftTime: string;
  neededSpots: number;
  notes: string | null;
  isArchived: boolean;
  createdByUserId: string | null;
  createdByUser: { name: string | null; email: string | null } | null;
  createdAt: Date;
  requestingRestaurantId: string;
  requestingRestaurant: { id: string; code: string; name: string | null };
  slots: HelpSlotRow[];
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

async function getRestaurantIdsUserCanRequestFor(
  userId: string,
  role: string | undefined
): Promise<string[]> {
  if (role === "ADMIN" || role === "SYSTEM_ARCHITECT") {
    const rows = await prisma.restaurant.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
  const rel = await prisma.restaurantUser.findMany({
    where: { userId },
    select: { restaurantId: true },
  });
  return rel.map((r) => r.restaurantId);
}

const requestInclude = {
  requestingRestaurant: { select: { id: true, code: true, name: true } },
  createdByUser: { select: { name: true, email: true } },
  slots: {
    include: {
      providingRestaurant: { select: { code: true, name: true } },
      providerManager: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

/* ─── 1. Create Help Request ─────────────────────────────────────────────────── */

export async function createHelpRequest(data: {
  requestingRestaurantId: string;
  date: string;
  shiftTime: string;
  neededSpots: number;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Nicht angemeldet." };
  const userId = (session.user as any).id as string | undefined;
  const role = (session.user as any).role as string | undefined;

  if (!data.requestingRestaurantId || !data.date || !data.shiftTime || !data.neededSpots) {
    return { success: false, error: "Pflichtfelder fehlen." };
  }
  if (data.neededSpots < 1 || data.neededSpots > 50) {
    return { success: false, error: "Anzahl Personen muss zwischen 1 und 50 liegen." };
  }

  if (userId) {
    const allowed = await getRestaurantIdsUserCanRequestFor(userId, role);
    if (!allowed.includes(data.requestingRestaurantId)) {
      return { success: false, error: "Kein Zugriff auf dieses Restaurant." };
    }
  }

  try {
    await prisma.helpRequest.create({
      data: {
        requestingRestaurantId: data.requestingRestaurantId,
        date: data.date,
        shiftTime: data.shiftTime.trim(),
        neededSpots: data.neededSpots,
        notes: data.notes?.trim() || null,
        createdByUserId: userId ?? null,
      },
    });
    revalidatePath(REVALIDATE);
    return { success: true };
  } catch (err) {
    console.error("createHelpRequest:", err);
    return { success: false, error: "Fehler beim Erstellen der Anfrage." };
  }
}

/* ─── 2. Fill Help Slot ──────────────────────────────────────────────────────── */

export async function fillHelpSlot(
  requestId: string,
  providingRestaurantId: string,
  workerName: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Nicht angemeldet." };

  const userId = (session.user as any).id as string | undefined;
  const trimmedName = workerName.trim();
  if (!trimmedName) return { success: false, error: "Name des Mitarbeiters fehlt." };
  if (!requestId || !providingRestaurantId) return { success: false, error: "Ungültige Anfrage." };

  try {
    const helpRequest = await prisma.helpRequest.findUnique({
      where: { id: requestId },
      select: { id: true, neededSpots: true, isArchived: true, _count: { select: { slots: true } } },
    });
    if (!helpRequest) return { success: false, error: "Anfrage nicht gefunden." };
    if (helpRequest.isArchived) return { success: false, error: "Diese Anfrage ist bereits abgeschlossen." };
    if (helpRequest._count.slots >= helpRequest.neededSpots) {
      return { success: false, error: "Alle Plätze sind bereits belegt." };
    }

    await prisma.helpSlot.create({
      data: {
        helpRequestId: requestId,
        providingRestaurantId,
        workerName: trimmedName,
        providerManagerId: userId ?? null,
      },
    });

    revalidatePath(REVALIDATE);
    return { success: true };
  } catch (err) {
    console.error("fillHelpSlot:", err);
    return { success: false, error: "Fehler beim Eintragen." };
  }
}

/* ─── 3. Archive a Request Manually ─────────────────────────────────────────── */

export async function archiveHelpRequest(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Nicht angemeldet." };

  try {
    await prisma.helpRequest.update({
      where: { id: requestId },
      data: { isArchived: true },
    });
    revalidatePath(REVALIDATE);
    return { success: true };
  } catch (err) {
    console.error("archiveHelpRequest:", err);
    return { success: false, error: "Fehler beim Archivieren." };
  }
}

/* ─── 4. Delete a Request (with permission check) ───────────────────────────── */

export async function deleteHelpRequest(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Nicht angemeldet." };

  const userId = (session.user as any).id as string | undefined;
  const role = (session.user as any).role as string | undefined;

  const isPrivileged = role === "ADMIN" || role === "SYSTEM_ARCHITECT";

  try {
    const helpRequest = await prisma.helpRequest.findUnique({
      where: { id: requestId },
      select: { id: true, createdByUserId: true },
    });
    if (!helpRequest) return { success: false, error: "Anfrage nicht gefunden." };

    if (!isPrivileged && helpRequest.createdByUserId !== userId) {
      return { success: false, error: "Keine Berechtigung zum Löschen dieser Anfrage." };
    }

    await prisma.helpRequest.delete({ where: { id: requestId } });
    revalidatePath(REVALIDATE);
    return { success: true };
  } catch (err) {
    console.error("deleteHelpRequest:", err);
    return { success: false, error: "Fehler beim Löschen der Anfrage." };
  }
}

/* ─── 5. Get Active or Archived Requests ────────────────────────────────────── */

export async function getHelpRequests(archived: boolean): Promise<HelpRequestRow[]> {
  try {
    const rows = await prisma.helpRequest.findMany({
      where: { isArchived: archived },
      include: requestInclude,
      orderBy: { date: "asc" },
    });
    return rows as HelpRequestRow[];
  } catch (err) {
    console.error("getHelpRequests:", err);
    return [];
  }
}

/* ─── 6. Get Archived Requests Filtered by Month/Year ───────────────────────── */

export async function getArchivedByMonth(
  month: number,
  year: number
): Promise<HelpRequestRow[]> {
  const monthStr = String(month).padStart(2, "0");
  const prefix = `${year}-${monthStr}-`;
  try {
    const rows = await prisma.helpRequest.findMany({
      where: {
        isArchived: true,
        date: { startsWith: prefix },
      },
      include: requestInclude,
      orderBy: { date: "asc" },
    });
    return rows as HelpRequestRow[];
  } catch (err) {
    console.error("getArchivedByMonth:", err);
    return [];
  }
}
