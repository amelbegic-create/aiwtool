"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import { cookies } from "next/headers";
import { getDbUserForAccess, requirePermission } from "@/lib/access";
import { GOD_MODE_ROLES } from "@/lib/permissions";
import { Role } from "@prisma/client";
import { extractPdfPlainText } from "@/lib/extractPdfText";

const visitReportSearchSelect = {
  id: true,
  title: true,
  description: true,
  fileUrl: true,
  fileType: true,
  categoryId: true,
  year: true,
  sortOrder: true,
  category: { select: { name: true, iconName: true } },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// RESTAURANT RESOLUTION & ALLOWED LIST
// ─────────────────────────────────────────────────────────────────────────────

function isGodModeRole(role: Role) {
  return GOD_MODE_ROLES.has(String(role));
}

/** For tools: resolve active restaurant from cookie or user's primary/first. */
export async function resolveRestaurantIdForUser(sessionUserId: string): Promise<string | null> {
  const cookieStore = await cookies();
  const activeRestaurantId = cookieStore.get("activeRestaurantId")?.value;

  if (activeRestaurantId && activeRestaurantId !== "all") {
    const allowed = await getAllowedRestaurantIdsForUser(sessionUserId);
    if (allowed.includes(activeRestaurantId)) return activeRestaurantId;
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { restaurants: { select: { restaurantId: true, isPrimary: true } } },
  });

  const primary = user?.restaurants.find((r) => r.isPrimary)?.restaurantId;
  if (primary) return primary;

  const first = user?.restaurants[0]?.restaurantId;
  if (first) return first;

  if (isGodModeRole((await prisma.user.findUnique({ where: { id: sessionUserId }, select: { role: true } }))?.role as Role)) {
    const anyRest = await prisma.restaurant.findFirst({ where: { isActive: true }, select: { id: true } });
    return anyRest?.id ?? null;
  }

  return null;
}

/** Restaurant IDs the user is allowed to see (for tools) or manage (for admin). */
export async function getAllowedRestaurantIdsForUser(sessionUserId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { role: true, restaurants: { select: { restaurantId: true } } },
  });
  if (!user) return [];

  if (isGodModeRole(user.role as Role)) {
    const rest = await prisma.restaurant.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    return rest.map((r) => r.id);
  }

  return user.restaurants.map((r) => r.restaurantId);
}

async function ensureCanManageRestaurant(restaurantId: string) {
  const dbUser = await requirePermission("besuchsberichte:manage");
  const allowed = await getAllowedRestaurantIdsForUser(dbUser.id);
  if (!allowed.includes(restaurantId)) {
    throw new Error("Sie haben keine Berechtigung für diesen Standort.");
  }
  return dbUser;
}

/** Admin: list of restaurants the current user can manage (for dropdown). */
export async function getRestaurantsForBesuchsberichteAdmin() {
  const dbUser = await requirePermission("besuchsberichte:manage");
  const allowedIds = await getAllowedRestaurantIdsForUser(dbUser.id);
  if (allowedIds.length === 0) return [];

  return prisma.restaurant.findMany({
    where: { id: { in: allowedIds }, isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
}

/** Admin: active restaurant from top nav (cookie). Use this for Besuchsberichte admin – no dropdown. */
export async function getActiveRestaurantIdForBesuchsberichteAdmin(): Promise<string | null> {
  const dbUser = await requirePermission("besuchsberichte:manage");
  const cookieStore = await cookies();
  const activeId = cookieStore.get("activeRestaurantId")?.value;
  const allowedIds = await getAllowedRestaurantIdsForUser(dbUser.id);
  if (allowedIds.length === 0) return null;
  if (activeId && activeId !== "all" && allowedIds.includes(activeId)) return activeId;
  return allowedIds[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// KATEGORIJE
// ─────────────────────────────────────────────────────────────────────────────

export async function getCategories(restaurantId: string) {
  const dbUser = await getDbUserForAccess();
  const allowed = await getAllowedRestaurantIdsForUser(dbUser.id);
  if (!allowed.includes(restaurantId)) {
    return [];
  }
  return prisma.visitReportCategory.findMany({
    where: { restaurantId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { items: true } } },
  });
}

export async function createCategory(restaurantId: string, data: { name: string; description?: string; iconName?: string }) {
  await ensureCanManageRestaurant(restaurantId);

  const maxOrder = await prisma.visitReportCategory.aggregate({
    where: { restaurantId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const category = await prisma.visitReportCategory.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      iconName: data.iconName?.trim() || null,
      sortOrder,
      restaurantId,
    },
  });

  revalidatePath("/admin/besuchsberichte");
  revalidatePath("/tools/besuchsberichte");
  return category;
}

/** Create the same category (name, description) for multiple restaurants. */
export async function createCategoryForRestaurants(
  restaurantIds: string[],
  data: { name: string; description?: string; iconName?: string }
) {
  if (restaurantIds.length === 0) return [];
  const dbUser = await requirePermission("besuchsberichte:manage");
  const allowed = await getAllowedRestaurantIdsForUser(dbUser.id);
  const ids = restaurantIds.filter((id) => allowed.includes(id));
  if (ids.length === 0) throw new Error("Sie haben keine Berechtigung für die gewählten Standorte.");

  const created: Awaited<ReturnType<typeof prisma.visitReportCategory.create>>[] = [];
  for (const restaurantId of ids) {
    const maxOrder = await prisma.visitReportCategory.aggregate({
      where: { restaurantId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    const category = await prisma.visitReportCategory.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        iconName: data.iconName?.trim() || null,
        sortOrder,
        restaurantId,
      },
    });
    created.push(category);
  }

  revalidatePath("/admin/besuchsberichte");
  revalidatePath("/tools/besuchsberichte");
  return created;
}

export async function updateCategoryOrder(restaurantId: string, categoryIds: string[]) {
  await ensureCanManageRestaurant(restaurantId);
  if (categoryIds.length === 0) return;

  const existing = await prisma.visitReportCategory.findMany({
    where: { id: { in: categoryIds }, restaurantId },
    select: { id: true },
  });
  const validIds = new Set(existing.map((c) => c.id));
  if (validIds.size !== categoryIds.length) {
    throw new Error("Einige Kategorien gehören nicht zu diesem Standort.");
  }

  await prisma.$transaction(
    categoryIds.map((id, index) =>
      prisma.visitReportCategory.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  revalidatePath("/admin/besuchsberichte");
  revalidatePath("/tools/besuchsberichte");
}

export async function updateCategory(
  id: string,
  restaurantId: string,
  data: { name: string; description?: string; iconName?: string }
) {
  await ensureCanManageRestaurant(restaurantId);

  const category = await prisma.visitReportCategory.findFirst({
    where: { id, restaurantId },
  });
  if (!category) throw new Error("Kategorie nicht gefunden oder kein Zugriff.");

  await prisma.visitReportCategory.update({
    where: { id },
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      iconName: data.iconName?.trim() || null,
    },
  });

  revalidatePath("/admin/besuchsberichte");
  revalidatePath("/tools/besuchsberichte");
}

export async function deleteCategory(id: string, restaurantId: string) {
  await ensureCanManageRestaurant(restaurantId);

  const category = await prisma.visitReportCategory.findFirst({
    where: { id, restaurantId },
    include: { _count: { select: { items: true } } },
  });
  if (!category) throw new Error("Kategorie nicht gefunden oder kein Zugriff.");
  if (category._count.items > 0) {
    throw new Error("Kategorie enthält noch Dokumente. Bitte zuerst alle Dokumente löschen.");
  }

  await prisma.visitReportCategory.delete({ where: { id } });

  revalidatePath("/admin/besuchsberichte");
  revalidatePath("/tools/besuchsberichte");
}

// ─────────────────────────────────────────────────────────────────────────────
// DOKUMENTE (Items, mit Jahr; Anzeige-Reihenfolge: sortOrder)
// ─────────────────────────────────────────────────────────────────────────────

export async function getItems(categoryId: string, restaurantId: string) {
  const dbUser = await getDbUserForAccess();
  const allowed = await getAllowedRestaurantIdsForUser(dbUser.id);
  if (!allowed.includes(restaurantId)) {
    return [];
  }

  const category = await prisma.visitReportCategory.findFirst({
    where: { id: categoryId, restaurantId },
  });
  if (!category) return [];

  const rows = await prisma.visitReportItem.findMany({
    where: { categoryId },
    orderBy: { createdAt: "desc" },
    include: { category: { select: { name: true, iconName: true } } },
  });
  // Reihenfolge: sortOrder (Admin-DnD), sonst createdAt — ohne sortOrder in orderBy (ältere Prisma/DB)
  return [...rows].sort((a, b) => {
    const da = a.sortOrder ?? 0;
    const db = b.sortOrder ?? 0;
    if (da !== db) return da - db;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export async function updateVisitReportItemOrder(
  restaurantId: string,
  categoryId: string,
  itemIds: string[]
) {
  await ensureCanManageRestaurant(restaurantId);

  const category = await prisma.visitReportCategory.findFirst({
    where: { id: categoryId, restaurantId },
  });
  if (!category) throw new Error("Kategorie nicht gefunden.");

  const existing = await prisma.visitReportItem.findMany({
    where: { categoryId },
    select: { id: true },
  });
  const valid = new Set(existing.map((e) => e.id));
  if (itemIds.length !== valid.size || itemIds.some((id) => !valid.has(id))) {
    throw new Error("Ungültige Reihenfolge: alle Dokumente der Kategorie müssen enthalten sein.");
  }

  await prisma.$transaction(
    itemIds.map((id, index) =>
      prisma.visitReportItem.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  revalidatePath("/admin/besuchsberichte");
  revalidatePath("/tools/besuchsberichte");
  revalidatePath(`/tools/besuchsberichte/${categoryId}`);
}

export async function getCategoryById(categoryId: string, restaurantId: string) {
  const dbUser = await getDbUserForAccess();
  const allowed = await getAllowedRestaurantIdsForUser(dbUser.id);
  if (!allowed.includes(restaurantId)) return null;

  return prisma.visitReportCategory.findFirst({
    where: { id: categoryId, restaurantId },
  });
}

/**
 * Tools: pretraga samo PDF dokumenata unutar jednog restorana (naslov, opis, tekst iz PDF-a).
 * Uvijek filtrira po category.restaurantId – nema curenja u druge standorte.
 */
export async function searchVisitReportPdfsForRestaurant(restaurantId: string, query: string) {
  const dbUser = await getDbUserForAccess();
  const allowed = await getAllowedRestaurantIdsForUser(dbUser.id);
  if (!allowed.includes(restaurantId)) {
    return [];
  }

  const q = query.trim();
  if (q.length < 2) return [];

  return prisma.visitReportItem.findMany({
    where: {
      category: { restaurantId },
      AND: [
        {
          OR: [
            { fileType: { contains: "pdf", mode: "insensitive" } },
            { fileType: { equals: "application/pdf" } },
          ],
        },
        {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { extractedText: { contains: q, mode: "insensitive" } },
          ],
        },
      ],
    },
    select: visitReportSearchSelect,
    orderBy: [{ sortOrder: "asc" }, { year: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
}

/** Admin: all items for a restaurant (with category). */
export async function getAllItemsForRestaurant(restaurantId: string) {
  await requirePermission("besuchsberichte:manage");
  const dbUser = await getDbUserForAccess();
  const allowed = await getAllowedRestaurantIdsForUser(dbUser.id);
  if (!allowed.includes(restaurantId)) return [];

  return prisma.visitReportItem.findMany({
    where: { category: { restaurantId } },
    include: { category: { select: { name: true, iconName: true } } },
    orderBy: [{ category: { name: "asc" } }, { year: "desc" }, { createdAt: "desc" }],
  });
}

export async function createItem(formData: FormData) {
  const restaurantId = formData.get("restaurantId") as string;
  const categoryId = formData.get("categoryId") as string;
  const yearStr = formData.get("year") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const file = formData.get("file") as File;

  if (!restaurantId?.trim() || !categoryId?.trim()) throw new Error("Standort und Kategorie sind erforderlich.");
  const year = parseInt(String(yearStr), 10);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) throw new Error("Ungültiges Jahr.");
  if (!title?.trim()) throw new Error("Titel ist erforderlich.");
  if (!file || file.size === 0) throw new Error("Datei ist erforderlich.");

  await ensureCanManageRestaurant(restaurantId);

  const category = await prisma.visitReportCategory.findFirst({
    where: { id: categoryId, restaurantId },
  });
  if (!category) throw new Error("Kategorie nicht gefunden oder kein Zugriff.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  let extractedText: string | null = null;
  if (isPdf) {
    extractedText = await extractPdfPlainText(buffer);
  }

  const blob = await put(`besuchsberichte/${Date.now()}-${file.name}`, buffer, {
    access: "public",
    addRandomSuffix: true,
  });

  const maxOrder = await prisma.visitReportItem.aggregate({
    where: { categoryId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const item = await prisma.visitReportItem.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      fileUrl: blob.url,
      fileType: file.type || "application/octet-stream",
      extractedText,
      categoryId,
      year,
      sortOrder,
    },
  });

  revalidatePath("/admin/besuchsberichte");
  revalidatePath("/tools/besuchsberichte");
  revalidatePath(`/tools/besuchsberichte/${categoryId}`);
  return item;
}

export async function updateItem(
  id: string,
  restaurantId: string,
  data: { title: string; description?: string; categoryId: string; year: number }
) {
  await ensureCanManageRestaurant(restaurantId);

  const existing = await prisma.visitReportItem.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!existing || existing.category.restaurantId !== restaurantId) {
    throw new Error("Dokument nicht gefunden oder kein Zugriff.");
  }

  const category = await prisma.visitReportCategory.findFirst({
    where: { id: data.categoryId, restaurantId },
  });
  if (!category) throw new Error("Kategorie nicht gefunden.");

  await prisma.visitReportItem.update({
    where: { id },
    data: {
      title: data.title.trim(),
      description: data.description?.trim() || null,
      categoryId: data.categoryId,
      year: data.year,
    },
  });

  revalidatePath("/admin/besuchsberichte");
  revalidatePath("/tools/besuchsberichte");
  revalidatePath(`/tools/besuchsberichte/${existing.categoryId}`);
  revalidatePath(`/tools/besuchsberichte/${data.categoryId}`);
}

/** Replace the file of an existing item (title, description, category, year stay the same). */
export async function replaceItemFile(itemId: string, restaurantId: string, formData: FormData) {
  const file = formData.get("file") as File;
  if (!file || file.size === 0) throw new Error("Datei ist erforderlich.");

  await ensureCanManageRestaurant(restaurantId);

  const item = await prisma.visitReportItem.findUnique({
    where: { id: itemId },
    include: { category: true },
  });
  if (!item || item.category.restaurantId !== restaurantId) {
    throw new Error("Dokument nicht gefunden oder kein Zugriff.");
  }

  try {
    await del(item.fileUrl);
  } catch (err) {
    console.error("Fehler beim Löschen der alten Datei von Vercel Blob:", err);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  let extractedText: string | null = null;
  if (isPdf) {
    extractedText = await extractPdfPlainText(buffer);
  }

  const blob = await put(`besuchsberichte/${Date.now()}-${file.name}`, buffer, {
    access: "public",
    addRandomSuffix: true,
  });

  await prisma.visitReportItem.update({
    where: { id: itemId },
    data: {
      fileUrl: blob.url,
      fileType: file.type || "application/octet-stream",
      extractedText: isPdf ? extractedText : null,
    },
  });

  revalidatePath("/admin/besuchsberichte");
  revalidatePath("/tools/besuchsberichte");
  revalidatePath(`/tools/besuchsberichte/${item.categoryId}`);
}

export async function deleteItem(id: string, restaurantId: string) {
  await ensureCanManageRestaurant(restaurantId);

  const item = await prisma.visitReportItem.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!item || item.category.restaurantId !== restaurantId) {
    throw new Error("Dokument nicht gefunden oder kein Zugriff.");
  }

  try {
    await del(item.fileUrl);
  } catch (err) {
    console.error("Fehler beim Löschen der Datei von Vercel Blob:", err);
  }

  await prisma.visitReportItem.delete({ where: { id } });

  revalidatePath("/admin/besuchsberichte");
  revalidatePath("/tools/besuchsberichte");
  revalidatePath(`/tools/besuchsberichte/${item.categoryId}`);
}
