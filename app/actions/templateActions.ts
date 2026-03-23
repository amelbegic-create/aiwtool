"use server";

import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { deriveTitleFromFileName, extractPdfPlainText } from "@/lib/extractPdfText";

const templatePublicSelect = {
  id: true,
  title: true,
  description: true,
  fileUrl: true,
  fileType: true,
  categoryId: true,
  createdAt: true,
  category: { select: { name: true, iconName: true } },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// KATEGORIJE
// ─────────────────────────────────────────────────────────────────────────────

export async function getCategories() {
  return prisma.templateCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { templates: true } } },
  });
}

export async function createCategory(data: { name: string; description?: string; iconName?: string }) {
  await requirePermission("vorlagen:manage");

  const category = await prisma.templateCategory.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      iconName: data.iconName?.trim() || null,
    },
  });

  revalidatePath("/admin/vorlagen");
  revalidatePath("/tools/vorlagen");
  return category;
}

export async function updateCategory(id: string, data: { name: string; description?: string; iconName?: string }) {
  await requirePermission("vorlagen:manage");

  const category = await prisma.templateCategory.update({
    where: { id },
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      iconName: data.iconName?.trim() || null,
    },
  });

  revalidatePath("/admin/vorlagen");
  revalidatePath("/tools/vorlagen");
  return category;
}

export async function deleteCategory(id: string) {
  await requirePermission("vorlagen:manage");

  const count = await prisma.templateItem.count({ where: { categoryId: id } });
  if (count > 0) {
    throw new Error("Kategorie enthält noch Vorlagen. Bitte zuerst alle Vorlagen löschen.");
  }

  await prisma.templateCategory.delete({ where: { id } });

  revalidatePath("/admin/vorlagen");
  revalidatePath("/tools/vorlagen");
}

/** Reihenfolge der Ordner (wie Besuchsberichte). */
export async function updateTemplateCategoryOrder(categoryIds: string[]) {
  await requirePermission("vorlagen:manage");
  if (categoryIds.length === 0) return;

  const existing = await prisma.templateCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true },
  });
  const validIds = new Set(existing.map((c) => c.id));
  if (validIds.size !== categoryIds.length) {
    throw new Error("Ungültige Ordner-Liste.");
  }

  await prisma.$transaction(
    categoryIds.map((id, index) =>
      prisma.templateCategory.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  revalidatePath("/admin/vorlagen");
  revalidatePath("/tools/vorlagen");
}

// ─────────────────────────────────────────────────────────────────────────────
// DOKUMENTI (Templates)
// ─────────────────────────────────────────────────────────────────────────────

export async function getTemplates(categoryId?: string) {
  return prisma.templateItem.findMany({
    where: categoryId ? { categoryId } : undefined,
    select: templatePublicSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function getTemplateById(id: string) {
  return prisma.templateItem.findUnique({
    where: { id },
    select: {
      ...templatePublicSelect,
      extractedText: true,
    },
  });
}

/** Pretraga u jednoj kategoriji (naslov, opis, tekst iz PDF-a). */
export async function searchTemplatesInCategory(categoryId: string, query: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return [];

  const q = query.trim();
  if (!q) {
    return getTemplates(categoryId);
  }

  return prisma.templateItem.findMany({
    where: {
      categoryId,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { extractedText: { contains: q, mode: "insensitive" } },
      ],
    },
    select: templatePublicSelect,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

/** Globalna pretraga za /tools/vorlagen (sve kategorije). */
export async function searchTemplatesGlobal(query: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return [];

  const q = query.trim();
  if (q.length < 2) return [];

  return prisma.templateItem.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { extractedText: { contains: q, mode: "insensitive" } },
      ],
    },
    select: templatePublicSelect,
    orderBy: [{ categoryId: "asc" }, { title: "asc" }],
    take: 50,
  });
}

/** Admin lista – pretraga kroz sve vorlagen. */
export async function searchTemplatesAdmin(query: string) {
  await requirePermission("vorlagen:manage");

  const q = query.trim();
  if (!q) {
    return getTemplates();
  }

  return prisma.templateItem.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { extractedText: { contains: q, mode: "insensitive" } },
        { category: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
    select: templatePublicSelect,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function createTemplate(formData: FormData) {
  await requirePermission("vorlagen:manage");

  const titleRaw = (formData.get("title") as string) ?? "";
  const description = formData.get("description") as string;
  const categoryId = formData.get("categoryId") as string;
  const file = formData.get("file") as File;

  if (!categoryId?.trim()) throw new Error("Kategorie ist erforderlich.");
  if (!file || file.size === 0) throw new Error("Datei ist erforderlich.");

  const finalTitle = titleRaw.trim() || deriveTitleFromFileName(file.name);

  const category = await prisma.templateCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new Error("Kategorie nicht gefunden.");

  const buffer = Buffer.from(await file.arrayBuffer());

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  let extractedText: string | null = null;
  if (isPdf) {
    extractedText = await extractPdfPlainText(buffer);
  }

  const blob = await put(`vorlagen/${Date.now()}-${file.name}`, buffer, {
    access: "public",
    addRandomSuffix: true,
  });

  const template = await prisma.templateItem.create({
    data: {
      title: finalTitle,
      description: description?.trim() || null,
      fileUrl: blob.url,
      fileType: file.type || "application/octet-stream",
      extractedText,
      categoryId,
    },
  });

  revalidatePath("/admin/vorlagen");
  revalidatePath("/tools/vorlagen");
  revalidatePath(`/tools/vorlagen/${categoryId}`);
  return template;
}

export async function updateTemplate(id: string, data: { title: string; description?: string; categoryId: string }) {
  await requirePermission("vorlagen:manage");

  const template = await prisma.templateItem.update({
    where: { id },
    data: {
      title: data.title.trim(),
      description: data.description?.trim() || null,
      categoryId: data.categoryId,
    },
  });

  revalidatePath("/admin/vorlagen");
  revalidatePath("/tools/vorlagen");
  revalidatePath(`/tools/vorlagen/${data.categoryId}`);
  return template;
}

export async function deleteTemplate(id: string) {
  await requirePermission("vorlagen:manage");

  const template = await prisma.templateItem.findUnique({ where: { id } });
  if (!template) throw new Error("Vorlage nicht gefunden.");

  try {
    await del(template.fileUrl);
  } catch (err) {
    console.error("Fehler beim Löschen der Datei von Vercel Blob:", err);
  }

  await prisma.templateItem.delete({ where: { id } });

  revalidatePath("/admin/vorlagen");
  revalidatePath("/tools/vorlagen");
  revalidatePath(`/tools/vorlagen/${template.categoryId}`);
}
