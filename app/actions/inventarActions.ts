"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { put } from "@vercel/blob";
import { STANDARD_SECTIONS } from "@/lib/inventarStandardSections";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InventarItemData = {
  geraet: string;
  marke?: string | null;
  modell?: string | null;
  seriennummer?: string | null;
  anschaffungsjahr?: number | null;
  garantieUrl?: string | null;
  garantieName?: string | null;
};

export type InventarItemRow = InventarItemData & {
  id: string;
  sectionId: string;
  sortOrder: number;
  createdAt: string;
};

export type InventarSectionRow = {
  id: string;
  restaurantId: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  itemCount: number;
};

export type InventarSectionDetail = InventarSectionRow & {
  items: InventarItemRow[];
};

// STANDARD_SECTIONS imported from @/lib/inventarStandardSections (non-server file)

// ─── Auth helpers ─────────────────────────────────────────────────────────────

const EDIT_ROLES = ["SYSTEM_ARCHITECT", "ADMIN", "MANAGER"] as const;
type EditRole = (typeof EDIT_ROLES)[number];

async function getInventarUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true, permissions: true },
  });
}

function canEdit(user: { role: string; permissions: string[] }): boolean {
  if (user.role === "SYSTEM_ARCHITECT" || user.role === "ADMIN") return true;
  return (
    EDIT_ROLES.includes(user.role as EditRole) &&
    user.permissions.includes("inventory:edit")
  );
}

async function assertEditAccess() {
  const user = await getInventarUser();
  if (!user) throw new Error("Nicht angemeldet.");
  if (!canEdit(user)) throw new Error("Keine Berechtigung zum Bearbeiten.");
  return user;
}

// ─── Check restaurant access ──────────────────────────────────────────────────

async function userHasRestaurantAccess(
  userId: string,
  role: string,
  restaurantId: string
): Promise<boolean> {
  if (role === "SYSTEM_ARCHITECT" || role === "ADMIN") return true;
  const rel = await prisma.restaurantUser.findUnique({
    where: { userId_restaurantId: { userId, restaurantId } },
    select: { id: true },
  });
  return !!rel;
}

// ─── Pre-fill ─────────────────────────────────────────────────────────────────

export async function ensureInventarPrefilled(restaurantId: string): Promise<void> {
  const existing = await prisma.inventarSection.findMany({
    where: { restaurantId },
    select: { id: true, name: true },
  });

  const existingNames = new Set(existing.map((s) => s.name.toLowerCase()));

  // Rename legacy "Ostalo" → "Verschiedenes" (so we don't create duplicates)
  if (existingNames.has("ostalo") && !existingNames.has("verschiedenes")) {
    const legacy = existing.find((s) => s.name.toLowerCase() === "ostalo");
    if (legacy) {
      await prisma.inventarSection.update({
        where: { id: legacy.id },
        data: { name: "Verschiedenes", icon: "Package", sortOrder: 4 },
      });
      existingNames.delete("ostalo");
      existingNames.add("verschiedenes");
    }
  }

  for (const sec of STANDARD_SECTIONS) {
    if (existingNames.has(sec.name.toLowerCase())) continue;
    const section = await prisma.inventarSection.create({
      data: {
        restaurantId,
        name: sec.name,
        icon: sec.icon,
        sortOrder: sec.sortOrder,
      },
    });
    if (sec.devices.length > 0) {
      await prisma.inventarItem.createMany({
        data: sec.devices.map((geraet, i) => ({
          sectionId: section.id,
          geraet,
          sortOrder: i,
        })),
      });
    }
  }
}

// ─── Read actions ─────────────────────────────────────────────────────────────

export async function getInventarSections(
  restaurantId: string
): Promise<InventarSectionRow[]> {
  const sections = await prisma.inventarSection.findMany({
    where: { restaurantId },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { items: true } } },
  });
  return sections.map((s) => ({
    id: s.id,
    restaurantId: s.restaurantId,
    name: s.name,
    icon: s.icon,
    sortOrder: s.sortOrder,
    itemCount: s._count.items,
  }));
}

export async function getInventarSection(
  sectionId: string
): Promise<InventarSectionDetail | null> {
  const s = await prisma.inventarSection.findUnique({
    where: { id: sectionId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      _count: { select: { items: true } },
    },
  });
  if (!s) return null;
  return {
    id: s.id,
    restaurantId: s.restaurantId,
    name: s.name,
    icon: s.icon,
    sortOrder: s.sortOrder,
    itemCount: s._count.items,
    items: s.items.map((it) => ({
      id: it.id,
      sectionId: it.sectionId,
      geraet: it.geraet,
      marke: it.marke,
      modell: it.modell,
      seriennummer: it.seriennummer,
      anschaffungsjahr: it.anschaffungsjahr,
      garantieUrl: it.garantieUrl,
      garantieName: it.garantieName,
      sortOrder: it.sortOrder,
      createdAt: it.createdAt.toISOString(),
    })),
  };
}

// ─── Write actions ────────────────────────────────────────────────────────────

export async function createInventarItem(
  sectionId: string,
  data: InventarItemData
): Promise<{ success: true; item: InventarItemRow } | { success: false; error: string }> {
  try {
    const user = await assertEditAccess();

    // Verify section exists and user has restaurant access
    const section = await prisma.inventarSection.findUnique({
      where: { id: sectionId },
      select: { restaurantId: true },
    });
    if (!section) return { success: false, error: "Sektion nicht gefunden." };

    const hasAccess = await userHasRestaurantAccess(
      user.id,
      user.role,
      section.restaurantId
    );
    if (!hasAccess) return { success: false, error: "Kein Zugriff auf dieses Restaurant." };

    if (!data.geraet?.trim())
      return { success: false, error: "Gerätename ist erforderlich." };

    const maxOrder = await prisma.inventarItem.aggregate({
      where: { sectionId },
      _max: { sortOrder: true },
    });

    const item = await prisma.inventarItem.create({
      data: {
        sectionId,
        geraet: data.geraet.trim(),
        marke: data.marke?.trim() || null,
        modell: data.modell?.trim() || null,
        seriennummer: data.seriennummer?.trim() || null,
        anschaffungsjahr: data.anschaffungsjahr ?? null,
        garantieUrl: data.garantieUrl?.trim() || null,
        garantieName: data.garantieName?.trim() || null,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    revalidatePath(`/tools/inventar/${sectionId}`);
    revalidatePath(`/tools/inventar`);

    return {
      success: true,
      item: {
        id: item.id,
        sectionId: item.sectionId,
        geraet: item.geraet,
        marke: item.marke,
        modell: item.modell,
        seriennummer: item.seriennummer,
        anschaffungsjahr: item.anschaffungsjahr,
        garantieUrl: item.garantieUrl,
        garantieName: item.garantieName,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt.toISOString(),
      },
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Fehler beim Erstellen." };
  }
}

export async function updateInventarItem(
  itemId: string,
  data: InventarItemData
): Promise<{ success: true; item: InventarItemRow } | { success: false; error: string }> {
  try {
    const user = await assertEditAccess();

    const existing = await prisma.inventarItem.findUnique({
      where: { id: itemId },
      include: { section: { select: { restaurantId: true } } },
    });
    if (!existing) return { success: false, error: "Gerät nicht gefunden." };

    const hasAccess = await userHasRestaurantAccess(
      user.id,
      user.role,
      existing.section.restaurantId
    );
    if (!hasAccess) return { success: false, error: "Kein Zugriff auf dieses Restaurant." };

    if (!data.geraet?.trim())
      return { success: false, error: "Gerätename ist erforderlich." };

    const item = await prisma.inventarItem.update({
      where: { id: itemId },
      data: {
        geraet: data.geraet.trim(),
        marke: data.marke?.trim() || null,
        modell: data.modell?.trim() || null,
        seriennummer: data.seriennummer?.trim() || null,
        anschaffungsjahr: data.anschaffungsjahr ?? null,
        garantieUrl: data.garantieUrl !== undefined ? (data.garantieUrl?.trim() || null) : undefined,
        garantieName: data.garantieName !== undefined ? (data.garantieName?.trim() || null) : undefined,
      },
    });

    revalidatePath(`/tools/inventar/${existing.sectionId}`);

    return {
      success: true,
      item: {
        id: item.id,
        sectionId: item.sectionId,
        geraet: item.geraet,
        marke: item.marke,
        modell: item.modell,
        seriennummer: item.seriennummer,
        anschaffungsjahr: item.anschaffungsjahr,
        garantieUrl: item.garantieUrl,
        garantieName: item.garantieName,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt.toISOString(),
      },
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Fehler beim Speichern." };
  }
}

export async function deleteInventarItem(
  itemId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await assertEditAccess();

    const existing = await prisma.inventarItem.findUnique({
      where: { id: itemId },
      include: { section: { select: { restaurantId: true, id: true } } },
    });
    if (!existing) return { success: false, error: "Gerät nicht gefunden." };

    const hasAccess = await userHasRestaurantAccess(
      user.id,
      user.role,
      existing.section.restaurantId
    );
    if (!hasAccess) return { success: false, error: "Kein Zugriff auf dieses Restaurant." };

    await prisma.inventarItem.delete({ where: { id: itemId } });

    revalidatePath(`/tools/inventar/${existing.section.id}`);
    revalidatePath(`/tools/inventar`);

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Fehler beim Löschen." };
  }
}

export async function uploadGarantie(
  formData: FormData,
  restaurantId: string
): Promise<
  | { success: true; url: string; fileName: string }
  | { success: false; error: string }
> {
  try {
    await assertEditAccess();

    const file = formData.get("file") as File | null;
    if (!file?.size) return { success: false, error: "Keine Datei ausgewählt." };

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return { success: false, error: "Blob nicht konfiguriert." };

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const blob = await put(
      `inventar/${restaurantId}/${Date.now()}-${safeName}`,
      file,
      { access: "public", token, addRandomSuffix: true }
    );

    return { success: true, url: blob.url, fileName: file.name };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Upload fehlgeschlagen." };
  }
}

export async function reorderInventarItems(
  sectionId: string,
  orderedIds: string[]
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await assertEditAccess();

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.inventarItem.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    revalidatePath(`/tools/inventar/${sectionId}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Fehler bei Sortierung." };
  }
}
