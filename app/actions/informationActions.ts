"use server";

import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { deriveTitleFromFileName, extractPdfPlainText } from "@/lib/extractPdfText";

const informationPublicSelect = {
  id: true,
  title: true,
  description: true,
  fileUrl: true,
  fileType: true,
  categoryId: true,
  createdAt: true,
  category: { select: { name: true, iconName: true } },
} as const;

const PATHS = ["/tools/informationen", "/admin/informationen"] as const;
function revalidateAll() {
  PATHS.forEach((p) => revalidatePath(p));
}

// ─────────────────────────────────────────────────────────────────────────────
// KATEGORIEN
// ─────────────────────────────────────────────────────────────────────────────

export async function getInformationCategories() {
  return prisma.informationCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { items: true } } },
  });
}

export async function createInformationCategory(data: {
  name: string;
  description?: string;
  iconName?: string;
}) {
  await requirePermission("information:manage");

  const category = await prisma.informationCategory.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      iconName: data.iconName?.trim() || null,
    },
  });

  revalidateAll();
  return category;
}

export async function updateInformationCategory(
  id: string,
  data: { name: string; description?: string; iconName?: string }
) {
  await requirePermission("information:manage");

  const category = await prisma.informationCategory.update({
    where: { id },
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      iconName: data.iconName?.trim() || null,
    },
  });

  revalidateAll();
  return category;
}

export async function deleteInformationCategory(id: string) {
  await requirePermission("information:manage");

  const count = await prisma.informationItem.count({ where: { categoryId: id } });
  if (count > 0) {
    throw new Error(
      "Kategorie enthält noch Informationen. Bitte zuerst alle Informationen löschen."
    );
  }

  await prisma.informationCategory.delete({ where: { id } });
  revalidateAll();
}

export async function updateInformationCategoryOrder(categoryIds: string[]) {
  await requirePermission("information:manage");
  if (categoryIds.length === 0) return;

  const existing = await prisma.informationCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true },
  });
  const validIds = new Set(existing.map((c) => c.id));
  if (validIds.size !== categoryIds.length) {
    throw new Error("Ungültige Ordner-Liste.");
  }

  await prisma.$transaction(
    categoryIds.map((id, index) =>
      prisma.informationCategory.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  revalidateAll();
}

// ─────────────────────────────────────────────────────────────────────────────
// INFORMATIONEN (Items)
// ─────────────────────────────────────────────────────────────────────────────

export async function getInformationItems(categoryId?: string) {
  return prisma.informationItem.findMany({
    where: categoryId ? { categoryId } : undefined,
    select: informationPublicSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function getInformationItemById(id: string) {
  return prisma.informationItem.findUnique({
    where: { id },
    select: {
      ...informationPublicSelect,
      extractedText: true,
    },
  });
}

export async function searchInformationInCategory(categoryId: string, query: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return [];

  const q = query.trim();
  if (!q) {
    return getInformationItems(categoryId);
  }

  return prisma.informationItem.findMany({
    where: {
      categoryId,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { extractedText: { contains: q, mode: "insensitive" } },
      ],
    },
    select: informationPublicSelect,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function searchInformationGlobal(query: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return [];

  const q = query.trim();
  if (q.length < 2) return [];

  return prisma.informationItem.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { extractedText: { contains: q, mode: "insensitive" } },
      ],
    },
    select: informationPublicSelect,
    orderBy: [{ categoryId: "asc" }, { title: "asc" }],
    take: 50,
  });
}

export async function searchInformationAdmin(query: string) {
  await requirePermission("information:manage");

  const q = query.trim();
  if (!q) {
    return getInformationItems();
  }

  return prisma.informationItem.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { extractedText: { contains: q, mode: "insensitive" } },
        { category: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
    select: informationPublicSelect,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function createInformationItem(formData: FormData) {
  await requirePermission("information:manage");

  const titleRaw = (formData.get("title") as string) ?? "";
  const description = formData.get("description") as string;
  const categoryId = formData.get("categoryId") as string;
  const file = formData.get("file") as File;

  if (!categoryId?.trim()) throw new Error("Kategorie ist erforderlich.");
  if (!file || file.size === 0) throw new Error("Datei ist erforderlich.");

  const finalTitle = titleRaw.trim() || deriveTitleFromFileName(file.name);

  const category = await prisma.informationCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new Error("Kategorie nicht gefunden.");

  const buffer = Buffer.from(await file.arrayBuffer());

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  let extractedText: string | null = null;
  if (isPdf) {
    extractedText = await extractPdfPlainText(buffer);
  }

  const blob = await put(`informationen/${Date.now()}-${file.name}`, buffer, {
    access: "public",
    addRandomSuffix: true,
  });

  const item = await prisma.informationItem.create({
    data: {
      title: finalTitle,
      description: description?.trim() || null,
      fileUrl: blob.url,
      fileType: file.type || "application/octet-stream",
      extractedText,
      categoryId,
    },
  });

  revalidateAll();
  return item;
}

export async function deleteInformationItem(id: string) {
  await requirePermission("information:manage");

  const item = await prisma.informationItem.findUnique({ where: { id } });
  if (!item) throw new Error("Information nicht gefunden.");

  try {
    await del(item.fileUrl);
  } catch {
    // Blob deletion is best-effort
  }

  await prisma.informationItem.delete({ where: { id } });
  revalidateAll();
}
