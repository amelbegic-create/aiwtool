"use server";

import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { DashboardNewsAttachmentKind } from "@prisma/client";

const MAX_BYTES = 10 * 1024 * 1024;

/** MIME ili ekstenzija (npr. .gif kad browser pošalje prazan type). */
function isImageFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  const name = (file.name || "").toLowerCase();
  return /\.(gif|jpe?g|png|webp|bmp|svg|avif|heic|heif)$/i.test(name);
}

export type DashboardNewsPublic = {
  id: string;
  title: string;
  subtitle: string | null;
  coverImageUrl: string;
  attachmentUrl: string;
  attachmentKind: DashboardNewsAttachmentKind;
};

function assertImageFile(file: File, label: string) {
  if (!file || file.size === 0) throw new Error(`${label}: Datei fehlt.`);
  if (file.size > MAX_BYTES) throw new Error(`${label}: Max. 10 MB.`);
  if (!isImageFile(file)) throw new Error(`${label}: Nur Bilddateien erlaubt (inkl. GIF).`);
}

function assertAttachmentFile(file: File) {
  if (!file || file.size === 0) throw new Error("Anhang: Datei fehlt.");
  if (file.size > MAX_BYTES) throw new Error("Anhang: Max. 10 MB.");
  const type = file.type || "";
  const name = (file.name || "").toLowerCase();
  const isPdf = type === "application/pdf" || name.endsWith(".pdf");
  const isImage = isImageFile(file);
  if (!isPdf && !isImage) {
    throw new Error("Anhang: Nur PDF oder Bild erlaubt (inkl. GIF).");
  }
  return isPdf ? DashboardNewsAttachmentKind.PDF : DashboardNewsAttachmentKind.IMAGE;
}

async function uploadCover(file: File, prefix: string): Promise<string> {
  assertImageFile(file, "Titelbild");
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN fehlt.");
  const originalName = file.name || "cover.jpg";
  const ext = (originalName.split(".").pop() || "jpg").toLowerCase();
  const safeBase = originalName.replace(/\s+/g, "_").replace(/[^\w.\-]/g, "");
  const path = `dashboard-news/covers/${prefix}-${Date.now()}-${safeBase}.${ext}`;
  const blob = await put(path, file, { access: "public", token, addRandomSuffix: true });
  return blob.url;
}

async function uploadAttachment(file: File, prefix: string): Promise<{ url: string; kind: DashboardNewsAttachmentKind }> {
  const kind = assertAttachmentFile(file);
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN fehlt.");
  const originalName = file.name || (kind === DashboardNewsAttachmentKind.PDF ? "doc.pdf" : "image.jpg");
  const ext = (originalName.split(".").pop() || (kind === DashboardNewsAttachmentKind.PDF ? "pdf" : "jpg")).toLowerCase();
  const safeBase = originalName.replace(/\s+/g, "_").replace(/[^\w.\-]/g, "");
  const path = `dashboard-news/attachments/${prefix}-${Date.now()}-${safeBase}.${ext}`;
  const blob = await put(path, file, { access: "public", token, addRandomSuffix: true });
  return { url: blob.url, kind };
}

/** Öffentlich für eingeloggte Dashboard-Seite (keine Admin-Permission nötig). */
export async function getActiveDashboardNews(): Promise<DashboardNewsPublic[]> {
  const rows = await prisma.dashboardNewsItem.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      subtitle: true,
      coverImageUrl: true,
      attachmentUrl: true,
      attachmentKind: true,
    },
  });
  return rows;
}

export async function listDashboardNewsForAdmin() {
  await requirePermission("dashboard_news:manage");
  return prisma.dashboardNewsItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function getDashboardNewsById(id: string) {
  await requirePermission("dashboard_news:manage");
  const row = await prisma.dashboardNewsItem.findUnique({ where: { id } });
  return row;
}

export async function createDashboardNewsItem(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("dashboard_news:manage");
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { ok: false, error: "Titel ist erforderlich." };
    const subtitleRaw = formData.get("subtitle");
    const subtitle =
      typeof subtitleRaw === "string" && subtitleRaw.trim() ? subtitleRaw.trim() : null;
    const sortOrder = Math.max(0, parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0);
    const isActive = formData.get("isActive") === "true";

    const cover = formData.get("cover");
    const attachment = formData.get("attachment");
    if (!(cover instanceof File)) return { ok: false, error: "Titelbild erforderlich." };
    if (!(attachment instanceof File)) return { ok: false, error: "Anhang erforderlich." };

    const coverUrl = await uploadCover(cover, "new");
    const { url: attUrl, kind } = await uploadAttachment(attachment, "new");

    await prisma.dashboardNewsItem.create({
      data: {
        title,
        subtitle,
        coverImageUrl: coverUrl,
        attachmentUrl: attUrl,
        attachmentKind: kind,
        sortOrder,
        isActive,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/admin/dashboard-news");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler beim Speichern." };
  }
}

export async function updateDashboardNewsItem(
  id: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("dashboard_news:manage");
    const existing = await prisma.dashboardNewsItem.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Eintrag nicht gefunden." };

    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { ok: false, error: "Titel ist erforderlich." };
    const subtitleRaw = formData.get("subtitle");
    const subtitle =
      typeof subtitleRaw === "string" && subtitleRaw.trim() ? subtitleRaw.trim() : null;
    const sortOrder = Math.max(0, parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0);
    const isActive = formData.get("isActive") === "true";

    let coverImageUrl = existing.coverImageUrl;
    let attachmentUrl = existing.attachmentUrl;
    let attachmentKind = existing.attachmentKind;

    const cover = formData.get("cover");
    if (cover instanceof File && cover.size > 0) {
      coverImageUrl = await uploadCover(cover, id);
    }

    const attachment = formData.get("attachment");
    if (attachment instanceof File && attachment.size > 0) {
      const up = await uploadAttachment(attachment, id);
      attachmentUrl = up.url;
      attachmentKind = up.kind;
    }

    await prisma.dashboardNewsItem.update({
      where: { id },
      data: {
        title,
        subtitle,
        coverImageUrl,
        attachmentUrl,
        attachmentKind,
        sortOrder,
        isActive,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/admin/dashboard-news");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler beim Speichern." };
  }
}

export async function deleteDashboardNewsItem(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("dashboard_news:manage");
    await prisma.dashboardNewsItem.delete({ where: { id } });
    revalidatePath("/dashboard");
    revalidatePath("/admin/dashboard-news");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler beim Löschen." };
  }
}

export async function setDashboardNewsActive(
  id: string,
  isActive: boolean
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("dashboard_news:manage");
    await prisma.dashboardNewsItem.update({ where: { id }, data: { isActive } });
    revalidatePath("/dashboard");
    revalidatePath("/admin/dashboard-news");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}
