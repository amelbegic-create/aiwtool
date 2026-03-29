"use server";

import prisma from "@/lib/prisma";
import { IdeaStatus } from "@prisma/client";
import { getDbUserForAccess, requirePermission, tryRequirePermission } from "@/lib/access";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";

export type IdeaWithUser = {
  id: string;
  text: string;
  userId: string;
  status: IdeaStatus;
  adminReply: string | null;
  repliedAt: Date | null;
  isRead: boolean;
  createdAt: Date;
  // Legacy single attachment
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentSize: number | null;
  // New multi-attachment fields
  imageUrls: string[];
  imageNames: string[];
  pdfUrl: string | null;
  pdfName: string | null;
  pdfSize: number | null;
  isArchived: boolean;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    restaurants: { restaurant: { id: string; name: string | null; code: string } }[];
  };
  repliedBy: {
    id: string;
    name: string | null;
    image: string | null;
    email: string | null;
  } | null;
};

export type MyIdeaRow = {
  id: string;
  text: string;
  createdAt: Date;
  status: IdeaStatus;
  adminReply: string | null;
  repliedAt: Date | null;
  isArchived: boolean;
  imageUrls: string[];
  imageNames: string[];
  pdfUrl: string | null;
  pdfName: string | null;
  repliedBy: { name: string | null } | null;
};

export async function submitIdea(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const text = (formData.get("text") ?? "") as string;
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Bitte Text eingeben." };

  try {
    const user = await getDbUserForAccess();

    // NOVO: više slika (polje "images") + jedan PDF ("pdf")
    const imageFiles = formData.getAll("images").filter((f) => f instanceof File) as File[];
    const pdfFile = formData.get("pdf") as File | null;

    const imageUrls: string[] = [];
    const imageNames: string[] = [];

    const maxBytes = 10 * 1024 * 1024; // 10 MB po fajlu
    const token = process.env.BLOB_READ_WRITE_TOKEN;

    if ((imageFiles.length > 0 || pdfFile) && !token) {
      return { ok: false, error: "Datei-Upload ist nicht konfiguriert." };
    }

    // Upload slika
    for (const file of imageFiles) {
      if (!file || file.size === 0) continue;
      if (file.size > maxBytes) {
        return { ok: false, error: "Ein Bild ist zu groß (max. 10 MB pro Datei)." };
      }
      if (!file.type.startsWith("image/")) {
        return { ok: false, error: "Nur Bilddateien sind als Bilder erlaubt." };
      }

      const originalName = file.name || "bild";
      const ext = (originalName.split(".").pop() || "").toLowerCase() || "jpg";
      const safeBase = originalName.replace(/\s+/g, "_").replace(/[^\w.\-]/g, "");
      const path = `ideas/images/${user.id}-${Date.now()}-${safeBase}.${ext}`;

      const blob = await put(path, file, {
        access: "public",
        token,
        addRandomSuffix: true,
      });

      imageUrls.push(blob.url);
      imageNames.push(originalName);
    }

    // Upload PDF-a
    let pdfUrl: string | null = null;
    let pdfName: string | null = null;
    let pdfSize: number | null = null;

    if (pdfFile && pdfFile.size > 0) {
      pdfName = pdfFile.name || "dokument.pdf";
      pdfSize = pdfFile.size;

      if (pdfSize > maxBytes) {
        return { ok: false, error: "Die PDF-Datei ist zu groß (max. 10 MB)." };
      }
      const type = pdfFile.type || "";
      const isPdf = type === "application/pdf" || type.endsWith("/pdf");
      if (!isPdf) {
        return { ok: false, error: "Nur PDF-Dateien sind als Dokument erlaubt." };
      }

      const ext = (pdfName.split(".").pop() || "").toLowerCase() || "pdf";
      const safeBase = pdfName.replace(/\s+/g, "_").replace(/[^\w.\-]/g, "");
      const path = `ideas/pdfs/${user.id}-${Date.now()}-${safeBase}.${ext}`;

      const blob = await put(path, pdfFile, {
        access: "public",
        token,
        addRandomSuffix: true,
      });

      pdfUrl = blob.url;
    }

    await prisma.idea.create({
      data: {
        text: trimmed,
        userId: user.id,
        status: IdeaStatus.SENT,
        imageUrls,
        imageNames,
        pdfUrl,
        pdfName,
        pdfSize,
      },
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler beim Speichern." };
  }
}

function ideaListInclude() {
  return {
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        restaurants: { include: { restaurant: { select: { id: true, name: true, code: true } } } },
      },
    },
    repliedBy: {
      select: { id: true, name: true, image: true, email: true },
    },
  };
}

/** Aktivne ideje (ne arhivirane). */
export async function getIdeas(): Promise<IdeaWithUser[]> {
  await requirePermission("ideenbox:access");
  const rows = await prisma.idea.findMany({
    where: { isArchived: false },
    orderBy: { createdAt: "desc" },
    include: ideaListInclude(),
  });
  return rows as unknown as IdeaWithUser[];
}

/** Arhivirane ideje. */
export async function getArchivedIdeas(): Promise<IdeaWithUser[]> {
  await requirePermission("ideenbox:access");
  const rows = await prisma.idea.findMany({
    where: { isArchived: true },
    orderBy: { createdAt: "desc" },
    include: ideaListInclude(),
  });
  return rows as unknown as IdeaWithUser[];
}

/** Eingereichte Ideen des aktuellen Nutzers (Archiv-Ansicht). */
export async function getMyIdeas(): Promise<MyIdeaRow[]> {
  const user = await getDbUserForAccess();
  const rows = await prisma.idea.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      text: true,
      createdAt: true,
      status: true,
      adminReply: true,
      repliedAt: true,
      isArchived: true,
      imageUrls: true,
      imageNames: true,
      pdfUrl: true,
      pdfName: true,
      repliedBy: { select: { name: true } },
    },
  });
  return rows;
}

export async function replyToIdea(
  id: string,
  data: { status: IdeaStatus; adminReply: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("ideenbox:access");
    const admin = await getDbUserForAccess();
    const replyTrim = data.adminReply.trim();
    const prev = await prisma.idea.findUnique({
      where: { id },
      select: { userId: true, adminReply: true },
    });
    if (!prev) return { ok: false, error: "Nicht gefunden." };

    const prevReply = (prev.adminReply ?? "").trim();
    const replyChanged = replyTrim !== prevReply;

    await prisma.idea.update({
      where: { id },
      data: {
        status: data.status,
        isRead: true,
        ...(replyTrim
          ? {
              adminReply: replyTrim,
              repliedById: admin.id,
              ...(replyChanged ? { repliedAt: new Date() } : {}),
            }
          : {
              adminReply: null,
              repliedAt: null,
              repliedById: null,
            }),
      },
    });

    if (replyTrim && replyChanged) {
      await prisma.notificationRead.deleteMany({
        where: { userId: prev.userId, notifKey: `idea-reply:${id}` },
      });
    }

    revalidatePath("/admin/ideenbox");
    revalidatePath("/admin");
    revalidatePath("/dashboard/meine-ideen");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}

export async function markIdeaAsRead(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("ideenbox:access");
    await prisma.idea.update({ where: { id }, data: { isRead: true } });
    revalidatePath("/admin/ideenbox");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}

export async function archiveIdea(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("ideenbox:access");
    await prisma.idea.update({ where: { id }, data: { isArchived: true, isRead: true } });
    revalidatePath("/admin/ideenbox");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}

export async function unarchiveIdea(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("ideenbox:access");
    await prisma.idea.update({ where: { id }, data: { isArchived: false } });
    revalidatePath("/admin/ideenbox");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}

export async function getUnreadIdeasCount(): Promise<number> {
  const result = await tryRequirePermission("ideenbox:access");
  if (!result.ok) return 0;
  return prisma.idea.count({ where: { isRead: false, isArchived: false } });
}
