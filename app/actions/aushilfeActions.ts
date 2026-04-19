"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { DEFAULT_STATIONS, getDefaultStationsForAushilfe, type Station } from "@/lib/productivityStations";

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
  /** Legacy field – only set on old requests created before the Schicht/Sektor update. */
  shiftTime: string | null;
  /** 1 = Frühschicht, 2 = Mittelschicht, 3 = Spätschicht */
  shiftNumber: number;
  sectorKey: string;
  sectorLabel: string;
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

export type SectorOption = { key: string; label: string; group: string; isCustom?: boolean };

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

/* ─── Sector options (merged) ────────────────────────────────────────────────── */

/**
 * Returns the merged list of sector options for a given restaurant:
 *   1. Default stations (from productivityStations.ts, minus "pause")
 *   2. Custom stations from the latest ProductivityReport for that restaurant
 *   3. Admin-created custom sectors (AushilfeCustomSector table)
 * Deduplicates by key, default order: defaults first, then custom.
 */
export async function getAushilfeSectorOptions(restaurantId: string): Promise<SectorOption[]> {
  const defaults = getDefaultStationsForAushilfe();

  // Latest custom stations from Productivity
  let prodCustom: Station[] = [];
  try {
    const latestReport = await prisma.productivityReport.findFirst({
      where: { restaurantId },
      orderBy: { updatedAt: "desc" },
      select: { data: true },
    });
    if (latestReport?.data) {
      const d = latestReport.data as Record<string, unknown>;
      if (Array.isArray(d.customStations)) {
        prodCustom = (d.customStations as Station[]).filter(
          (s) => s?.key && s?.label
        );
      }
    }
  } catch {
    // no productivity data – silently skip
  }

  // Admin-created custom sectors
  let adminCustom: SectorOption[] = [];
  try {
    const dbSectors = await prisma.aushilfeCustomSector.findMany({
      where: { restaurantId },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });
    adminCustom = dbSectors.map((s) => ({
      key: s.key,
      label: s.label,
      group: s.group,
      isCustom: true,
    }));
  } catch {
    // table might not exist yet in dev – silently skip
  }

  // Merge with deduplication by key (defaults win label for their keys)
  const seen = new Set<string>();
  const merged: SectorOption[] = [];

  for (const s of defaults) {
    if (!seen.has(s.key)) { seen.add(s.key); merged.push({ key: s.key, label: s.label, group: s.group }); }
  }
  for (const s of prodCustom) {
    if (!seen.has(s.key)) { seen.add(s.key); merged.push({ key: s.key, label: s.label, group: s.group, isCustom: true }); }
  }
  for (const s of adminCustom) {
    if (!seen.has(s.key)) { seen.add(s.key); merged.push(s); }
  }

  return merged;
}

/* ─── 1. Create Help Request ─────────────────────────────────────────────────── */

export async function createHelpRequest(data: {
  requestingRestaurantId: string;
  date: string;
  shiftNumber: number;
  sectorKey: string;
  sectorLabel: string;
  neededSpots: number;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Nicht angemeldet." };
  const userId = (session.user as { id?: string }).id;
  const role   = (session.user as { role?: string }).role;

  if (!data.requestingRestaurantId || !data.date || !data.sectorKey) {
    return { success: false, error: "Pflichtfelder fehlen." };
  }
  if (![1, 2, 3].includes(data.shiftNumber)) {
    return { success: false, error: "Ungültige Schichtnummer (1–3)." };
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
        shiftNumber: data.shiftNumber,
        sectorKey: data.sectorKey.trim(),
        sectorLabel: data.sectorLabel.trim(),
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

  const userId = (session.user as { id?: string }).id;
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

  const userId = (session.user as { id?: string }).id;
  const role   = (session.user as { role?: string }).role;
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
    return rows as unknown as HelpRequestRow[];
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
    return rows as unknown as HelpRequestRow[];
  } catch (err) {
    console.error("getArchivedByMonth:", err);
    return [];
  }
}

/* ─── 7. Admin: Custom Sector CRUD ──────────────────────────────────────────── */

export async function listAushilfeCustomSectors(restaurantId: string) {
  return prisma.aushilfeCustomSector.findMany({
    where: { restaurantId },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
}

export async function createAushilfeCustomSector(data: {
  restaurantId: string;
  key: string;
  label: string;
  group?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Nicht angemeldet." };
  const role = (session.user as { role?: string }).role;
  if (!["SYSTEM_ARCHITECT", "ADMIN", "MANAGER"].includes(role ?? "")) {
    return { success: false, error: "Keine Berechtigung." };
  }

  const slug = data.key.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (!slug || !data.label.trim() || !data.restaurantId) {
    return { success: false, error: "Pflichtfelder fehlen." };
  }

  try {
    await prisma.aushilfeCustomSector.create({
      data: {
        restaurantId: data.restaurantId,
        key: slug,
        label: data.label.trim(),
        group: data.group?.trim() || "Sonstiges",
      },
    });
    revalidatePath("/admin/aushilfe/sectors");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint")) {
      return { success: false, error: "Dieser Schlüssel existiert bereits für dieses Restaurant." };
    }
    console.error("createAushilfeCustomSector:", err);
    return { success: false, error: "Fehler beim Erstellen." };
  }
}

export async function updateAushilfeCustomSector(
  id: string,
  data: { label?: string; group?: string; sortOrder?: number }
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Nicht angemeldet." };
  const role = (session.user as { role?: string }).role;
  if (!["SYSTEM_ARCHITECT", "ADMIN", "MANAGER"].includes(role ?? "")) {
    return { success: false, error: "Keine Berechtigung." };
  }

  try {
    await prisma.aushilfeCustomSector.update({
      where: { id },
      data: {
        ...(data.label !== undefined && { label: data.label.trim() }),
        ...(data.group !== undefined && { group: data.group.trim() }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
    revalidatePath("/admin/aushilfe/sectors");
    return { success: true };
  } catch (err) {
    console.error("updateAushilfeCustomSector:", err);
    return { success: false, error: "Fehler beim Aktualisieren." };
  }
}

export async function deleteAushilfeCustomSector(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Nicht angemeldet." };
  const role = (session.user as { role?: string }).role;
  if (!["SYSTEM_ARCHITECT", "ADMIN", "MANAGER"].includes(role ?? "")) {
    return { success: false, error: "Keine Berechtigung." };
  }

  try {
    await prisma.aushilfeCustomSector.delete({ where: { id } });
    revalidatePath("/admin/aushilfe/sectors");
    return { success: true };
  } catch (err) {
    console.error("deleteAushilfeCustomSector:", err);
    return { success: false, error: "Fehler beim Löschen." };
  }
}
