"use server";

import prisma from "@/lib/prisma";
import { getDbUserForAccess, requirePermission } from "@/lib/access";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { DashboardNewsAttachmentKind } from "@prisma/client";

const MAX_IMAGE_PDF_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

/** MIME ili ekstenzija (npr. .gif kad browser pošalje prazan type). */
function isImageFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  const name = (file.name || "").toLowerCase();
  return /\.(gif|jpe?g|png|webp|bmp|svg|avif|heic|heif)$/i.test(name);
}

function isVideoFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("video/")) return true;
  const name = (file.name || "").toLowerCase();
  return /\.(mp4|webm|ogg|mov|m4v|avi|wmv|mpeg|mpg)$/i.test(name);
}

export type DashboardNewsPublic = {
  id: string;
  title: string;
  subtitle: string | null;
  coverImageUrl: string;
  attachmentUrl: string;
  attachmentKind: DashboardNewsAttachmentKind;
  /** ISO string — za „NEU“ značku prvih 3 dana nakon objave. */
  createdAt: string;
};

function assertImageFile(file: File, label: string) {
  if (!file || file.size === 0) throw new Error(`${label}: Datei fehlt.`);
  if (file.size > MAX_IMAGE_PDF_BYTES) throw new Error(`${label}: Max. 10 MB.`);
  if (!isImageFile(file)) throw new Error(`${label}: Nur Bilddateien erlaubt (inkl. GIF).`);
}

function assertAttachmentFile(file: File) {
  if (!file || file.size === 0) throw new Error("Anhang: Datei fehlt.");
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();

  const isPdf = type === "application/pdf" || name.endsWith(".pdf");
  const isImage = isImageFile(file);
  const isVideo = isVideoFile(file);

  if (isVideo) {
    if (file.size > MAX_VIDEO_BYTES) throw new Error("Anhang (Video): Max. 200 MB.");
    return DashboardNewsAttachmentKind.VIDEO;
  }
  if (isPdf) {
    if (file.size > MAX_IMAGE_PDF_BYTES) throw new Error("Anhang (PDF): Max. 10 MB.");
    return DashboardNewsAttachmentKind.PDF;
  }
  if (isImage) {
    if (file.size > MAX_IMAGE_PDF_BYTES) throw new Error("Anhang (Bild): Max. 10 MB.");
    return DashboardNewsAttachmentKind.IMAGE;
  }

  throw new Error("Anhang: Nur PDF, Bild (inkl. GIF) oder Video erlaubt.");
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
  const originalName =
    file.name ||
    (kind === DashboardNewsAttachmentKind.PDF ? "doc.pdf" : kind === DashboardNewsAttachmentKind.VIDEO ? "video.mp4" : "image.jpg");
  const ext = (
    originalName.split(".").pop() ||
    (kind === DashboardNewsAttachmentKind.PDF ? "pdf" : kind === DashboardNewsAttachmentKind.VIDEO ? "mp4" : "jpg")
  ).toLowerCase();
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
      createdAt: true,
    },
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
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

export async function recordDashboardNewsView(newsItemId: string) {
  const dbUser = await getDbUserForAccess();
  await prisma.dashboardNewsView.createMany({
    data: [{ userId: dbUser.id, newsItemId }],
    skipDuplicates: true,
  });
  return { ok: true as const };
}

export async function listDashboardNewsActivityForAdmin() {
  await requirePermission("dashboard_news:manage");

  const [users, items] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, image: true },
      orderBy: { name: "asc" },
    }),
    prisma.dashboardNewsItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: { id: true, title: true, coverImageUrl: true, isActive: true },
    }),
  ]);

  const itemIds = items.map((i) => i.id);
  const viewRows = itemIds.length
    ? await prisma.dashboardNewsView.findMany({
        where: { newsItemId: { in: itemIds } },
        select: { newsItemId: true, userId: true, viewedAt: true },
      })
    : [];

  const viewedByItem = new Map<string, Set<string>>();
  for (const v of viewRows) {
    const set = viewedByItem.get(v.newsItemId) ?? new Set<string>();
    set.add(v.userId);
    viewedByItem.set(v.newsItemId, set);
  }

  const userById = new Map(users.map((u) => [u.id, u]));

  return items.map((item) => {
    const viewedSet = viewedByItem.get(item.id) ?? new Set<string>();
    const viewedUsers = [...viewedSet]
      .map((uid) => userById.get(uid))
      .filter((u): u is (typeof users)[number] => Boolean(u));
    const notViewedUsers = users.filter((u) => !viewedSet.has(u.id));

    return {
      itemId: item.id,
      title: item.title,
      coverImageUrl: item.coverImageUrl,
      isActive: item.isActive,
      viewedCount: viewedUsers.length,
      notViewedCount: notViewedUsers.length,
      viewedUsers,
      notViewedUsers,
    };
  });
}

export async function getDashboardNewsStatsSummary(newsItemId: string) {
  await requirePermission("dashboard_news:manage");
  const [totalCount, readCount] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.dashboardNewsView.count({ where: { newsItemId } }),
  ]);
  return { readCount, totalCount };
}

export type DashboardItemStatsResult = {
  read: Array<{ id: string; name: string | null; email: string | null; readAt: string | null }>;
  unread: Array<{ id: string; name: string | null; email: string | null }>;
};

export async function getDashboardNewsStats(newsItemId: string): Promise<DashboardItemStatsResult> {
  await requirePermission("dashboard_news:manage");
  const [users, reads] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.dashboardNewsView.findMany({
      where: { newsItemId },
      select: { userId: true, viewedAt: true },
    }),
  ]);

  const readByUser = new Map<string, Date>();
  for (const r of reads) readByUser.set(r.userId, r.viewedAt);

  const read: DashboardItemStatsResult["read"] = [];
  const unread: DashboardItemStatsResult["unread"] = [];
  for (const u of users) {
    const at = readByUser.get(u.id) ?? null;
    if (at) read.push({ ...u, readAt: at.toISOString() });
    else unread.push(u);
  }
  return { read, unread };
}
