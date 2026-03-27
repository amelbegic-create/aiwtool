"use server";

import prisma from "@/lib/prisma";
import { getDbUserForAccess, requirePermission } from "@/lib/access";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const MAX_GALLERY_IMAGES = 50;

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

function assertImageFile(file: File, label: string) {
  if (!file || file.size === 0) throw new Error(`${label}: Datei fehlt.`);
  if (file.size > MAX_IMAGE_BYTES) throw new Error(`${label}: Max. 10 MB.`);
  if (!isImageFile(file)) throw new Error(`${label}: Nur Bilddateien erlaubt (inkl. GIF).`);
}

function assertVideoFile(file: File, label: string) {
  if (!file || file.size === 0) throw new Error(`${label}: Datei fehlt.`);
  if (file.size > MAX_VIDEO_BYTES) throw new Error(`${label}: Max. 200 MB.`);
  if (!isVideoFile(file)) throw new Error(`${label}: Nur Video-Dateien erlaubt.`);
}

async function uploadImage(file: File, folder: string, prefix: string): Promise<string> {
  assertImageFile(file, "Bild");
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN fehlt.");
  const originalName = file.name || "image.jpg";
  const ext = (originalName.split(".").pop() || "jpg").toLowerCase();
  const safeBase = originalName.replace(/\s+/g, "_").replace(/[^\w.\-]/g, "");
  const path = `${folder}/${prefix}-${Date.now()}-${safeBase}.${ext}`;
  const blob = await put(path, file, { access: "public", token, addRandomSuffix: true });
  return blob.url;
}

async function uploadVideo(file: File, folder: string, prefix: string): Promise<string> {
  assertVideoFile(file, "Video");
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN fehlt.");
  const originalName = file.name || "video.mp4";
  const ext = (originalName.split(".").pop() || "mp4").toLowerCase();
  const safeBase = originalName.replace(/\s+/g, "_").replace(/[^\w.\-]/g, "");
  const path = `${folder}/${prefix}-${Date.now()}-${safeBase}.${ext}`;
  const blob = await put(path, file, { access: "public", token, addRandomSuffix: true });
  return blob.url;
}

export type DashboardEventPublic = {
  id: string;
  title: string;
  subtitle: string | null;
  coverImageUrl: string;
  videoUrl: string | null;
  images: Array<{ id: string; imageUrl: string; sortOrder: number }>;
};

export async function getActiveDashboardEvents(): Promise<DashboardEventPublic[]> {
  const rows = await prisma.dashboardEventItem.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      subtitle: true,
      coverImageUrl: true,
      videoUrl: true,
      images: {
        select: { id: true, imageUrl: true, sortOrder: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  return rows;
}

export async function listDashboardEventsForAdmin() {
  await requirePermission("dashboard_events:manage");
  return prisma.dashboardEventItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
}

export async function getDashboardEventById(id: string) {
  await requirePermission("dashboard_events:manage");
  return prisma.dashboardEventItem.findUnique({
    where: { id },
    include: { images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
}

function parseCommonForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Titel ist erforderlich.");
  const subtitleRaw = formData.get("subtitle");
  const subtitle = typeof subtitleRaw === "string" && subtitleRaw.trim() ? subtitleRaw.trim() : null;
  const sortOrder = Math.max(0, parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0);
  const isActive = formData.get("isActive") === "true";
  return { title, subtitle, sortOrder, isActive };
}

function normalizeExistingImageUrls(formData: FormData): string[] {
  const values = formData
    .getAll("existingGalleryUrls")
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  return [...new Set(values)];
}

function getNewGalleryFiles(formData: FormData): File[] {
  return formData
    .getAll("galleryImages")
    .filter((v): v is File => v instanceof File && v.size > 0);
}

export async function createDashboardEventItem(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("dashboard_events:manage");
    const { title, subtitle, sortOrder, isActive } = parseCommonForm(formData);

    const cover = formData.get("cover");
    if (!(cover instanceof File)) return { ok: false, error: "Titelbild erforderlich." };

    const galleryFiles = getNewGalleryFiles(formData);
    if (galleryFiles.length === 0) {
      return { ok: false, error: "Mindestens 1 Galeriebild ist erforderlich." };
    }
    if (galleryFiles.length > MAX_GALLERY_IMAGES) {
      return { ok: false, error: `Maximal ${MAX_GALLERY_IMAGES} Bilder erlaubt.` };
    }

    const coverImageUrl = await uploadImage(cover, "dashboard-events/covers", "new");
    const galleryUrls = await Promise.all(
      galleryFiles.map((file, idx) => uploadImage(file, "dashboard-events/gallery", `new-${idx + 1}`))
    );

    let videoUrl: string | null = null;
    const video = formData.get("video");
    if (video instanceof File && video.size > 0) {
      videoUrl = await uploadVideo(video, "dashboard-events/video", "new");
    }

    await prisma.dashboardEventItem.create({
      data: {
        title,
        subtitle,
        coverImageUrl,
        sortOrder,
        isActive,
        videoUrl,
        images: {
          create: galleryUrls.map((url, idx) => ({ imageUrl: url, sortOrder: idx })),
        },
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/admin/dashboard-events");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler beim Speichern." };
  }
}

export async function updateDashboardEventItem(
  id: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("dashboard_events:manage");
    const existing = await prisma.dashboardEventItem.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!existing) return { ok: false, error: "Eintrag nicht gefunden." };

    const { title, subtitle, sortOrder, isActive } = parseCommonForm(formData);

    let coverImageUrl = existing.coverImageUrl;
    let videoUrl = existing.videoUrl ?? null;
    const cover = formData.get("cover");
    if (cover instanceof File && cover.size > 0) {
      coverImageUrl = await uploadImage(cover, "dashboard-events/covers", id);
    }

    const video = formData.get("video");
    if (video instanceof File && video.size > 0) {
      videoUrl = await uploadVideo(video, "dashboard-events/video", id);
    }

    const existingGalleryUrls = normalizeExistingImageUrls(formData);
    const newGalleryFiles = getNewGalleryFiles(formData);
    const uploadedGalleryUrls = await Promise.all(
      newGalleryFiles.map((file, idx) => uploadImage(file, "dashboard-events/gallery", `${id}-${idx + 1}`))
    );

    const finalUrls = [...existingGalleryUrls, ...uploadedGalleryUrls];
    if (finalUrls.length === 0) {
      return { ok: false, error: "Mindestens 1 Galeriebild ist erforderlich." };
    }
    if (finalUrls.length > MAX_GALLERY_IMAGES) {
      return { ok: false, error: `Maximal ${MAX_GALLERY_IMAGES} Bilder erlaubt.` };
    }

    await prisma.$transaction([
      prisma.dashboardEventItem.update({
        where: { id },
        data: {
          title,
          subtitle,
          coverImageUrl,
          sortOrder,
          isActive,
          videoUrl,
        },
      }),
      prisma.dashboardEventImage.deleteMany({ where: { eventId: id } }),
      prisma.dashboardEventImage.createMany({
        data: finalUrls.map((url, idx) => ({ eventId: id, imageUrl: url, sortOrder: idx })),
      }),
    ]);

    revalidatePath("/dashboard");
    revalidatePath("/admin/dashboard-events");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler beim Speichern." };
  }
}

export async function deleteDashboardEventItem(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("dashboard_events:manage");
    await prisma.dashboardEventItem.delete({ where: { id } });
    revalidatePath("/dashboard");
    revalidatePath("/admin/dashboard-events");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler beim Löschen." };
  }
}

export async function setDashboardEventActive(
  id: string,
  isActive: boolean
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("dashboard_events:manage");
    await prisma.dashboardEventItem.update({ where: { id }, data: { isActive } });
    revalidatePath("/dashboard");
    revalidatePath("/admin/dashboard-events");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}

export async function recordDashboardEventView(eventItemId: string) {
  const dbUser = await getDbUserForAccess();
  await prisma.dashboardEventView.createMany({
    data: [{ userId: dbUser.id, eventItemId }],
    skipDuplicates: true,
  });
  return { ok: true as const };
}

export async function listDashboardEventsActivityForAdmin() {
  await requirePermission("dashboard_events:manage");

  const [users, items] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, image: true },
      orderBy: { name: "asc" },
    }),
    prisma.dashboardEventItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: { id: true, title: true, coverImageUrl: true, isActive: true },
    }),
  ]);

  const itemIds = items.map((i) => i.id);
  const viewRows = itemIds.length
    ? await prisma.dashboardEventView.findMany({
        where: { eventItemId: { in: itemIds } },
        select: { eventItemId: true, userId: true },
      })
    : [];

  const viewedByItem = new Map<string, Set<string>>();
  for (const v of viewRows) {
    const set = viewedByItem.get(v.eventItemId) ?? new Set<string>();
    set.add(v.userId);
    viewedByItem.set(v.eventItemId, set);
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

export async function getDashboardEventStatsSummary(eventItemId: string) {
  await requirePermission("dashboard_events:manage");
  const [totalCount, readCount] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.dashboardEventView.count({ where: { eventItemId } }),
  ]);
  return { readCount, totalCount };
}

export type DashboardItemStatsResult = {
  read: Array<{ id: string; name: string | null; email: string | null; readAt: string | null }>;
  unread: Array<{ id: string; name: string | null; email: string | null }>;
};

export async function getDashboardEventStats(eventItemId: string): Promise<DashboardItemStatsResult> {
  await requirePermission("dashboard_events:manage");
  const [users, reads] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.dashboardEventView.findMany({
      where: { eventItemId },
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

