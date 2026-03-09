"use server";

import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";

// ─────────────────────────────────────────────────────────────────────────────
// KATEGORIJE
// ─────────────────────────────────────────────────────────────────────────────

export async function getCategories() {
  return prisma.templateCategory.findMany({
    orderBy: { name: "asc" },
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

// ─────────────────────────────────────────────────────────────────────────────
// DOKUMENTI (Templates)
// ─────────────────────────────────────────────────────────────────────────────

export async function getTemplates(categoryId?: string) {
  return prisma.templateItem.findMany({
    where: categoryId ? { categoryId } : undefined,
    include: { category: { select: { name: true, iconName: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTemplateById(id: string) {
  return prisma.templateItem.findUnique({
    where: { id },
    include: { category: { select: { name: true } } },
  });
}

export async function createTemplate(formData: FormData) {
  await requirePermission("vorlagen:manage");

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const categoryId = formData.get("categoryId") as string;
  const file = formData.get("file") as File;

  if (!title?.trim()) throw new Error("Titel ist erforderlich.");
  if (!categoryId?.trim()) throw new Error("Kategorie ist erforderlich.");
  if (!file || file.size === 0) throw new Error("Datei ist erforderlich.");

  const category = await prisma.templateCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new Error("Kategorie nicht gefunden.");

  const blob = await put(`vorlagen/${Date.now()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  const template = await prisma.templateItem.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      fileUrl: blob.url,
      fileType: file.type || "application/octet-stream",
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
