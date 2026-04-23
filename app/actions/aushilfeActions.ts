"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getDefaultStationsForAushilfe, type Station } from "@/lib/productivityStations";

const REVALIDATE = "/tools/aushilfe";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

export type HelpSlotRow = {
  id: string;
  positionId: string | null;
  workerName: string;
  providingRestaurantId: string;
  providingRestaurant: { code: string; name: string | null };
  providerManagerId: string | null;
  providerManager: { name: string | null; email: string | null } | null;
  createdAt: Date;
};

export type HelpRequestPositionRow = {
  id: string;
  sectorKey: string;
  sectorLabel: string;
  shiftTimeText: string;
  neededSpots: number;
  sortOrder: number;
  slots: HelpSlotRow[];
};

export type HelpRequestRow = {
  id: string;
  date: string;
  notes: string | null;
  isArchived: boolean;
  createdByUserId: string | null;
  createdByUser: { name: string | null; email: string | null } | null;
  createdAt: Date;
  requestingRestaurantId: string;
  requestingRestaurant: { id: string; code: string; name: string | null };
  positions: HelpRequestPositionRow[];
  /** slots NOT linked to a position (legacy) */
  slots: HelpSlotRow[];
};

export type SectorOption = { key: string; label: string; group: string; isCustom?: boolean };

export type PositionInput = {
  sectorKey: string;
  sectorLabel: string;
  shiftTimeText: string;
  neededSpots: number;
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

const slotInclude = {
  providingRestaurant: { select: { code: true, name: true } },
  providerManager: { select: { name: true, email: true } },
} as const;

const requestInclude = {
  requestingRestaurant: { select: { id: true, code: true, name: true } },
  createdByUser: { select: { name: true, email: true } },
  positions: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      slots: {
        include: slotInclude,
        orderBy: { createdAt: "asc" as const },
      },
    },
  },
  slots: {
    where: { positionId: null },
    include: slotInclude,
    orderBy: { createdAt: "asc" as const },
  },
} as const;

/* ─── Auto-archive expired requests (lazy, no cron needed) ──────────────────── */

async function autoArchiveExpired(): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 3);
  const cutoffStr = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD
  try {
    await prisma.helpRequest.updateMany({
      where: { isArchived: false, date: { lt: cutoffStr } },
      data: { isArchived: true },
    });
  } catch {
    // non-fatal
  }
}

/* ─── Sector options (merged) ────────────────────────────────────────────────── */

export async function getAushilfeSectorOptions(restaurantId: string): Promise<SectorOption[]> {
  const defaults = getDefaultStationsForAushilfe();

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
        prodCustom = (d.customStations as Station[]).filter((s) => s?.key && s?.label);
      }
    }
  } catch { /* no data */ }

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
  } catch { /* table may not exist in dev */ }

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
  positions: PositionInput[];
  notes?: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Nicht angemeldet." };
  const userId = (session.user as { id?: string }).id;
  const role   = (session.user as { role?: string }).role;

  if (!data.requestingRestaurantId || !data.date) {
    return { success: false, error: "Pflichtfelder fehlen." };
  }
  if (!data.positions || data.positions.length === 0) {
    return { success: false, error: "Mindestens eine Position angeben." };
  }
  for (const pos of data.positions) {
    if (!pos.sectorKey || !pos.sectorLabel) return { success: false, error: "Sektor fehlt." };
    if (!pos.shiftTimeText?.trim()) return { success: false, error: "Schichtzeit fehlt." };
    if (pos.neededSpots < 1 || pos.neededSpots > 50) return { success: false, error: "Anzahl Personen: 1–50." };
  }

  if (userId) {
    const allowed = await getRestaurantIdsUserCanRequestFor(userId, role);
    if (!allowed.includes(data.requestingRestaurantId)) {
      return { success: false, error: "Kein Zugriff auf dieses Restaurant." };
    }
  }

  try {
    const req = await prisma.helpRequest.create({
      data: {
        requestingRestaurantId: data.requestingRestaurantId,
        date: data.date,
        notes: data.notes?.trim() || null,
        createdByUserId: userId ?? null,
        // neededSpots kept at 0 on the parent; sum comes from positions
        positions: {
          create: data.positions.map((pos, i) => ({
            sectorKey: pos.sectorKey.trim(),
            sectorLabel: pos.sectorLabel.trim(),
            shiftTimeText: pos.shiftTimeText.trim(),
            neededSpots: pos.neededSpots,
            sortOrder: i,
          })),
        },
      },
    });
    revalidatePath(REVALIDATE);
    return { success: true, id: req.id };
  } catch (err) {
    console.error("createHelpRequest:", err);
    return { success: false, error: "Fehler beim Erstellen der Anfrage." };
  }
}

/* ─── 2. Fill Help Slot (by position) ───────────────────────────────────────── */

export async function fillHelpSlot(
  requestId: string,
  positionId: string,
  providingRestaurantId: string,
  workerName: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Nicht angemeldet." };
  const userId = (session.user as { id?: string }).id;

  const trimmedName = workerName.trim();
  if (!trimmedName) return { success: false, error: "Name des Mitarbeiters fehlt." };
  if (!requestId || !positionId || !providingRestaurantId) return { success: false, error: "Ungültige Anfrage." };

  try {
    const position = await prisma.helpRequestPosition.findUnique({
      where: { id: positionId },
      include: {
        helpRequest: { select: { id: true, isArchived: true } },
        _count: { select: { slots: true } },
      },
    });

    if (!position) return { success: false, error: "Position nicht gefunden." };
    if (position.helpRequest.id !== requestId) return { success: false, error: "Ungültige Anfrage." };
    if (position.helpRequest.isArchived) return { success: false, error: "Diese Anfrage ist bereits abgeschlossen." };
    if (position._count.slots >= position.neededSpots) {
      return { success: false, error: "Alle Plätze für diese Position sind belegt." };
    }

    await prisma.helpSlot.create({
      data: {
        helpRequestId: requestId,
        positionId,
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

/* ─── 3. Archive a Request (owner or admin only) ────────────────────────────── */

export async function archiveHelpRequest(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Nicht angemeldet." };
  const userId = (session.user as { id?: string }).id;
  const role   = (session.user as { role?: string }).role;
  const isPrivileged = role === "ADMIN" || role === "SYSTEM_ARCHITECT";

  try {
    const req = await prisma.helpRequest.findUnique({
      where: { id: requestId },
      select: { id: true, createdByUserId: true },
    });
    if (!req) return { success: false, error: "Anfrage nicht gefunden." };
    if (!isPrivileged && req.createdByUserId !== userId) {
      return { success: false, error: "Nur der Ersteller oder Admin kann diese Anfrage abschließen." };
    }

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

/* ─── 4. Delete a Request (owner or admin) ──────────────────────────────────── */

export async function deleteHelpRequest(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Nicht angemeldet." };
  const userId = (session.user as { id?: string }).id;
  const role   = (session.user as { role?: string }).role;
  const isPrivileged = role === "ADMIN" || role === "SYSTEM_ARCHITECT";

  try {
    const req = await prisma.helpRequest.findUnique({
      where: { id: requestId },
      select: { id: true, createdByUserId: true },
    });
    if (!req) return { success: false, error: "Anfrage nicht gefunden." };
    if (!isPrivileged && req.createdByUserId !== userId) {
      return { success: false, error: "Keine Berechtigung zum Löschen dieser Anfrage." };
    }

    await prisma.helpRequest.delete({ where: { id: requestId } });
    revalidatePath(REVALIDATE);
    return { success: true };
  } catch (err) {
    console.error("deleteHelpRequest:", err);
    return { success: false, error: "Fehler beim Löschen." };
  }
}

/* ─── 5. Get Active Requests ────────────────────────────────────────────────── */

export async function getHelpRequests(archived: boolean): Promise<HelpRequestRow[]> {
  await autoArchiveExpired();
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

/* ─── 6. Get Archived Requests by Month ─────────────────────────────────────── */

export async function getArchivedByMonth(
  month: number,
  year: number
): Promise<HelpRequestRow[]> {
  await autoArchiveExpired();
  const monthStr = String(month).padStart(2, "0");
  const prefix = `${year}-${monthStr}-`;
  try {
    const rows = await prisma.helpRequest.findMany({
      where: { isArchived: true, date: { startsWith: prefix } },
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
