"use server";

import prisma from "@/lib/prisma";
import { getDbUserForAccess, requirePermission } from "@/lib/access";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { DashboardNewsAttachmentKind } from "@prisma/client";

const MAX_IMAGE_PDF_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const MAX_NEWS_GALLERY_IMAGES = 50;

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
  /** Dodatne slike u modalu (pored attachmenta). */
  galleryUrls: string[];
  /** ISO string — za „NEU“ značku prvih 3 dana nakon objave. */
  createdAt: string;
  startsAt: string | null;
  endsAt: string | null;
  notifyAll: boolean;
  addToCalendar: boolean;
};

function parseDateStartUtc(dateStrRaw: unknown): Date | null {
  const s = typeof dateStrRaw === "string" ? dateStrRaw.trim() : "";
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Ungültiges Startdatum.");
  const t = Date.parse(`${s}T00:00:00.000Z`);
  if (!Number.isFinite(t)) throw new Error("Ungültiges Startdatum.");
  return new Date(t);
}

function parseDateEndUtc(dateStrRaw: unknown): Date | null {
  const s = typeof dateStrRaw === "string" ? dateStrRaw.trim() : "";
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Ungültiges Enddatum.");
  const t = Date.parse(`${s}T23:59:59.999Z`);
  if (!Number.isFinite(t)) throw new Error("Ungültiges Enddatum.");
  return new Date(t);
}

async function upsertCalendarEventsForNews(params: {
  newsId: string;
  ownerUserId: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
}) {
  // Calendar view currently displays events without filtering by userId,
  // so we must create exactly ONE event (not one per user).
  await prisma.calendarEvent.deleteMany({ where: { dashboardNewsItemId: params.newsId } });

  await prisma.calendarEvent.create({
    data: {
      userId: params.ownerUserId,
      dashboardNewsItemId: params.newsId,
      title: params.title,
      date: params.startsAt,
      endDate: params.endsAt ?? undefined,
      type: "Promotion",
      color: "#FFBC0D",
    },
  });
}

async function deleteCalendarEventsForNews(newsId: string) {
  await prisma.calendarEvent.deleteMany({ where: { dashboardNewsItemId: newsId } });
}

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

async function uploadNewsGalleryImage(file: File, prefix: string): Promise<string> {
  assertImageFile(file, "Galerie");
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN fehlt.");
  const originalName = file.name || "image.jpg";
  const ext = (originalName.split(".").pop() || "jpg").toLowerCase();
  const safeBase = originalName.replace(/\s+/g, "_").replace(/[^\w.\-]/g, "");
  const path = `dashboard-news/gallery/${prefix}-${Date.now()}-${safeBase}.${ext}`;
  const blob = await put(path, file, { access: "public", token, addRandomSuffix: true });
  return blob.url;
}

function normalizeExistingNewsGalleryUrls(formData: FormData): string[] {
  const values = formData
    .getAll("existingGalleryUrls")
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  return [...new Set(values)];
}

function getNewNewsGalleryFiles(formData: FormData): File[] {
  return formData
    .getAll("galleryImages")
    .filter((v): v is File => v instanceof File && v.size > 0);
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
  const now = new Date();
  const rows = await prisma.dashboardNewsItem.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      subtitle: true,
      coverImageUrl: true,
      attachmentUrl: true,
      attachmentKind: true,
      createdAt: true,
      startsAt: true,
      endsAt: true,
      notifyAll: true,
      addToCalendar: true,
      galleryImages: {
        select: { imageUrl: true, sortOrder: true, createdAt: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    coverImageUrl: r.coverImageUrl,
    attachmentUrl: r.attachmentUrl,
    attachmentKind: r.attachmentKind,
    galleryUrls: r.galleryImages.map((g) => g.imageUrl),
    createdAt: r.createdAt.toISOString(),
    startsAt: r.startsAt ? r.startsAt.toISOString() : null,
    endsAt: r.endsAt ? r.endsAt.toISOString() : null,
    notifyAll: r.notifyAll,
    addToCalendar: r.addToCalendar,
  }));
}

export async function listDashboardNewsForAdmin() {
  await requirePermission("dashboard_news:manage");
  return prisma.dashboardNewsItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function getDashboardNewsById(id: string) {
  await requirePermission("dashboard_news:manage");
  const cleanId = String(id ?? "").trim();
  if (!cleanId) return null;

  const row = await prisma.dashboardNewsItem.findUnique({ where: { id: cleanId } });
  if (!row) return null;

  const galleryImages = await prisma.dashboardNewsGalleryImage.findMany({
    where: { newsId: cleanId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return { ...row, galleryImages };
}

export async function createDashboardNewsItem(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const dbUser = await requirePermission("dashboard_news:manage");
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { ok: false, error: "Titel ist erforderlich." };
    const subtitleRaw = formData.get("subtitle");
    const subtitle =
      typeof subtitleRaw === "string" && subtitleRaw.trim() ? subtitleRaw.trim() : null;
    const sortOrder = Math.max(0, parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0);
    const isActive = formData.get("isActive") === "true";

    const startsAt = parseDateStartUtc(formData.get("startsAt"));
    const endsAt = parseDateEndUtc(formData.get("endsAt"));
    const notifyAll = Boolean(formData.get("notifyAll"));
    const addToCalendar = Boolean(formData.get("addToCalendar"));

    if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
      return { ok: false, error: "Enddatum darf nicht vor dem Startdatum liegen." };
    }
    if (addToCalendar && !startsAt) {
      return { ok: false, error: "Für „In Kalender“ muss „Gültig ab“ gesetzt sein." };
    }

    const cover = formData.get("cover");
    const attachment = formData.get("attachment");
    if (!(cover instanceof File)) return { ok: false, error: "Titelbild erforderlich." };
    if (!(attachment instanceof File)) return { ok: false, error: "Anhang erforderlich." };

    const galleryFiles = getNewNewsGalleryFiles(formData);
    if (galleryFiles.length > MAX_NEWS_GALLERY_IMAGES) {
      return { ok: false, error: `Maximal ${MAX_NEWS_GALLERY_IMAGES} Galeriebilder erlaubt.` };
    }

    const coverUrl = await uploadCover(cover, "new");
    const { url: attUrl, kind } = await uploadAttachment(attachment, "new");
    const galleryUrls =
      galleryFiles.length > 0
        ? await Promise.all(
            galleryFiles.map((file, idx) => uploadNewsGalleryImage(file, `new-${idx + 1}`))
          )
        : [];

    const created = await prisma.dashboardNewsItem.create({
      data: {
        title,
        subtitle,
        coverImageUrl: coverUrl,
        attachmentUrl: attUrl,
        attachmentKind: kind,
        sortOrder,
        isActive,
        startsAt,
        endsAt,
        notifyAll,
        addToCalendar,
        ...(galleryUrls.length > 0
          ? {
              galleryImages: {
                create: galleryUrls.map((url, idx) => ({ imageUrl: url, sortOrder: idx })),
              },
            }
          : {}),
      },
    });

    if (addToCalendar && startsAt) {
      await upsertCalendarEventsForNews({
        newsId: created.id,
        ownerUserId: dbUser.id,
        title,
        startsAt,
        endsAt,
      });
    }

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
    const dbUser = await requirePermission("dashboard_news:manage");
    const existing = await prisma.dashboardNewsItem.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Eintrag nicht gefunden." };

    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { ok: false, error: "Titel ist erforderlich." };
    const subtitleRaw = formData.get("subtitle");
    const subtitle =
      typeof subtitleRaw === "string" && subtitleRaw.trim() ? subtitleRaw.trim() : null;
    const sortOrder = Math.max(0, parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0);
    const isActive = formData.get("isActive") === "true";

    const startsAt = parseDateStartUtc(formData.get("startsAt"));
    const endsAt = parseDateEndUtc(formData.get("endsAt"));
    const notifyAll = Boolean(formData.get("notifyAll"));
    const addToCalendar = Boolean(formData.get("addToCalendar"));

    if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
      return { ok: false, error: "Enddatum darf nicht vor dem Startdatum liegen." };
    }
    if (addToCalendar && !startsAt) {
      return { ok: false, error: "Für „In Kalender“ muss „Gültig ab“ gesetzt sein." };
    }

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

    const existingGalleryUrls = normalizeExistingNewsGalleryUrls(formData);
    const newGalleryFiles = getNewNewsGalleryFiles(formData);
    if (existingGalleryUrls.length + newGalleryFiles.length > MAX_NEWS_GALLERY_IMAGES) {
      return { ok: false, error: `Maximal ${MAX_NEWS_GALLERY_IMAGES} Galeriebilder erlaubt.` };
    }
    const uploadedGalleryUrls = await Promise.all(
      newGalleryFiles.map((file, idx) => uploadNewsGalleryImage(file, `${id}-g-${idx + 1}`))
    );
    const finalGalleryUrls = [...existingGalleryUrls, ...uploadedGalleryUrls];

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
        startsAt,
        endsAt,
        notifyAll,
        addToCalendar,
        galleryImages: {
          deleteMany: {},
          create: finalGalleryUrls.map((url, idx) => ({ imageUrl: url, sortOrder: idx })),
        },
      },
    });

    if (addToCalendar && startsAt) {
      await upsertCalendarEventsForNews({ newsId: id, ownerUserId: dbUser.id, title, startsAt, endsAt });
    } else {
      await deleteCalendarEventsForNews(id);
    }

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
    await deleteCalendarEventsForNews(id);
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
  const now = new Date();
  await prisma.dashboardNewsView.upsert({
    where: {
      userId_newsItemId: {
        userId: dbUser.id,
        newsItemId,
      },
    },
    create: { userId: dbUser.id, newsItemId, viewedAt: now },
    update: { viewedAt: now },
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
