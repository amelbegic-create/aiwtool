"use server";

import prisma from "@/lib/prisma";
import { getDbUserForAccess, requirePermission, tryRequirePermission } from "@/lib/access";
import { put } from "@vercel/blob";

export type IdeaWithUser = {
  id: string;
  text: string;
  userId: string;
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
  user: {
    id: string;
    name: string | null;
    email: string | null;
    restaurants: { restaurant: { id: string; name: string | null; code: string } }[];
  };
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

    // Legacy polja ostavljamo prazna za nove ideje
    await prisma.idea.create({
      data: {
        text: trimmed,
        userId: user.id,
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

export async function getIdeas(): Promise<IdeaWithUser[]> {
  await requirePermission("ideenbox:access");
  const rows = await prisma.idea.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          restaurants: { include: { restaurant: { select: { id: true, name: true, code: true } } } },
        },
      },
    },
  });
  return rows as IdeaWithUser[];
}

export async function markIdeaAsRead(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("ideenbox:access");
    await prisma.idea.update({ where: { id }, data: { isRead: true } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}

export async function getUnreadIdeasCount(): Promise<number> {
  const result = await tryRequirePermission("ideenbox:access");
  if (!result.ok) return 0;
  return prisma.idea.count({ where: { isRead: false } });
}
