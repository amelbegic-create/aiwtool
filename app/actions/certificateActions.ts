"use server";

import prisma from "@/lib/prisma";
import { put } from "@vercel/blob";
import {
  getDbUserForAccess,
  hasPermission as hasPermissionForAccess,
  PermissionDeniedError,
} from "@/lib/access";
import { GOD_MODE_ROLES } from "@/lib/permissions";

/** Kreira tabelu UserCertificate ako ne postoji na live bazi (baza nema migracije). */
async function ensureUserCertificateTable() {
  try {
    await (prisma as any).$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UserCertificate" (
        "id"          TEXT NOT NULL,
        "userId"      TEXT NOT NULL,
        "title"       TEXT NOT NULL,
        "description" TEXT NOT NULL DEFAULT '',
        "pdfUrl"      TEXT,
        "pdfName"     TEXT,
        "pdfSize"     INTEGER,
        "imageUrl"    TEXT,
        "imageName"   TEXT,
        "imageSize"   INTEGER,
        "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UserCertificate_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "UserCertificate_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
      );
    `);
    await (prisma as any).$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "UserCertificate_userId_createdAt_idx"
        ON "UserCertificate"("userId", "createdAt");
    `);
  } catch {
    // Ignorišemo grešku ako tabela već postoji ili FK problem
  }
}

export type UserCertificateDto = {
  id: string;
  userId: string;
  title: string;
  description: string;
  pdfUrl: string | null;
  pdfName: string | null;
  pdfSize: number | null;
  imageUrl: string | null;
  imageName: string | null;
  imageSize: number | null;
  createdAt: Date;
};

function canManageAllUsers(role: string, permissions: string[]): boolean {
  if (GOD_MODE_ROLES.has(String(role))) return true;
  return hasPermissionForAccess(role, permissions, "users:manage");
}

async function ensureCanEditCertificates(targetUserId: string) {
  const dbUser = await getDbUserForAccess();

  if (canManageAllUsers(String(dbUser.role), dbUser.permissions || [])) {
    return dbUser;
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { supervisorId: true },
  });

  if (target && target.supervisorId === dbUser.id) {
    return dbUser;
  }

  throw new PermissionDeniedError();
}

async function ensureCanViewCertificates(targetUserId: string) {
  const dbUser = await getDbUserForAccess();

  if (dbUser.id === targetUserId) return dbUser;

  if (canManageAllUsers(String(dbUser.role), dbUser.permissions || [])) {
    return dbUser;
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { supervisorId: true },
  });

  if (target && target.supervisorId === dbUser.id) {
    return dbUser;
  }

  throw new PermissionDeniedError();
}

export async function getCertificatesForUser(
  userId: string
): Promise<{ ok: true; data: UserCertificateDto[] } | { ok: false; error: string }> {
  try {
    await ensureUserCertificateTable();
    await ensureCanViewCertificates(userId);

    const rows = await prisma.userCertificate.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return {
      ok: true,
      data: rows as UserCertificateDto[],
    };
  } catch (e) {
    const message =
      e instanceof PermissionDeniedError
        ? "Keine Berechtigung für Zertifikate dieser Person."
        : "Fehler beim Laden der Zertifikate.";
    return { ok: false, error: message };
  }
}

export async function createCertificate(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const userId = String(formData.get("userId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const pdfFile = formData.get("pdf") as File | null;
  const imageFile = formData.get("image") as File | null;

  if (!userId) return { ok: false, error: "Benutzer ist erforderlich." };
  if (!title) return { ok: false, error: "Titel ist erforderlich." };

  try {
    await ensureUserCertificateTable();
    await ensureCanEditCertificates(userId);

    const maxBytes = 10 * 1024 * 1024; // 10 MB
    const token = process.env.BLOB_READ_WRITE_TOKEN;

    let pdfUrl: string | null = null;
    let pdfName: string | null = null;
    let pdfSize: number | null = null;

    let imageUrl: string | null = null;
    let imageName: string | null = null;
    let imageSize: number | null = null;

    if (pdfFile && pdfFile.size > 0) {
      if (!token) {
        return { ok: false, error: "Datei-Upload ist nicht konfiguriert." };
      }

      pdfName = pdfFile.name || "zertifikat.pdf";
      pdfSize = pdfFile.size;

      if (pdfSize > maxBytes) {
        return { ok: false, error: "Die PDF-Datei ist zu groß (max. 10 MB)." };
      }

      const type = pdfFile.type || "";
      const isPdf = type === "application/pdf" || type.endsWith("/pdf");
      if (!isPdf) {
        return { ok: false, error: "Bitte nur PDF-Dateien hochladen." };
      }

      const ext = (pdfName.split(".").pop() || "").toLowerCase() || "pdf";
      const safeBase = pdfName.replace(/\s+/g, "_").replace(/[^\w.\-]/g, "");
      const path = `certificates/pdfs/${userId}-${Date.now()}-${safeBase}.${ext}`;

      const blob = await put(path, pdfFile, {
        access: "public",
        token,
        addRandomSuffix: true,
      });

      pdfUrl = blob.url;
    }

    if (imageFile && imageFile.size > 0) {
      if (!token) {
        return { ok: false, error: "Datei-Upload ist nicht konfiguriert." };
      }

      imageName = imageFile.name || "zertifikat-bild.jpg";
      imageSize = imageFile.size;

      if (imageSize > maxBytes) {
        return { ok: false, error: "Das Bild ist zu groß (max. 10 MB)." };
      }
      const type = imageFile.type || "";
      if (!type.startsWith("image/")) {
        return { ok: false, error: "Bitte nur Bilddateien hochladen." };
      }

      const ext = (imageName.split(".").pop() || "").toLowerCase() || "jpg";
      const safeBase = imageName.replace(/\s+/g, "_").replace(/[^\w.\-]/g, "");
      const imgPath = `certificates/images/${userId}-${Date.now()}-${safeBase}.${ext}`;

      const imgBlob = await put(imgPath, imageFile, {
        access: "public",
        token,
        addRandomSuffix: true,
      });

      imageUrl = imgBlob.url;
    }

    await prisma.userCertificate.create({
      data: {
        userId,
        title,
        description,
        pdfUrl,
        pdfName,
        pdfSize,
        imageUrl,
        imageName,
        imageSize,
      },
    });

    return { ok: true };
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return { ok: false, error: "Keine Berechtigung für diese Aktion." };
    }
    return { ok: false, error: "Fehler beim Speichern des Zertifikats." };
  }
}

export async function updateCertificate(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const pdfFile = formData.get("pdf") as File | null;
  const imageFile = formData.get("image") as File | null;

  if (!id) return { ok: false, error: "Zertifikat nicht gefunden." };
  if (!title) return { ok: false, error: "Titel ist erforderlich." };

  try {
    const existing = await prisma.userCertificate.findUnique({
      where: { id },
      select: {
        userId: true,
        pdfUrl: true,
        pdfName: true,
        pdfSize: true,
        imageUrl: true,
        imageName: true,
        imageSize: true,
      },
    });

    if (!existing) return { ok: false, error: "Zertifikat existiert nicht mehr." };

    await ensureCanEditCertificates(existing.userId);

    let pdfUrl = existing.pdfUrl;
    let pdfName = existing.pdfName;
    let pdfSize = existing.pdfSize;

    let imageUrl = existing.imageUrl;
    let imageName = existing.imageName;
    let imageSize = existing.imageSize;

    if (pdfFile && pdfFile.size > 0) {
      const maxBytes = 10 * 1024 * 1024; // 10 MB
      const token = process.env.BLOB_READ_WRITE_TOKEN;

      if (!token) {
        return { ok: false, error: "Datei-Upload ist nicht konfiguriert." };
      }

      pdfName = pdfFile.name || "zertifikat.pdf";
      pdfSize = pdfFile.size;

      if (pdfSize > maxBytes) {
        return { ok: false, error: "Die PDF-Datei ist zu groß (max. 10 MB)." };
      }

      const type = pdfFile.type || "";
      const isPdf = type === "application/pdf" || type.endsWith("/pdf");
      if (!isPdf) {
        return { ok: false, error: "Bitte nur PDF-Dateien hochladen." };
      }

      const ext = (pdfName.split(".").pop() || "").toLowerCase() || "pdf";
      const safeBase = pdfName.replace(/\s+/g, "_").replace(/[^\w.\-]/g, "");
      const path = `certificates/pdfs/${existing.userId}-${Date.now()}-${safeBase}.${ext}`;

      const blob = await put(path, pdfFile, {
        access: "public",
        token,
        addRandomSuffix: true,
      });

      pdfUrl = blob.url;
    }

    if (imageFile && imageFile.size > 0) {
      const maxBytes = 10 * 1024 * 1024; // 10 MB
      const token = process.env.BLOB_READ_WRITE_TOKEN;

      if (!token) {
        return { ok: false, error: "Datei-Upload ist nicht konfiguriert." };
      }

      imageName = imageFile.name || "zertifikat-bild.jpg";
      imageSize = imageFile.size;

      if (imageSize > maxBytes) {
        return { ok: false, error: "Das Bild ist zu groß (max. 10 MB)." };
      }
      const type = imageFile.type || "";
      if (!type.startsWith("image/")) {
        return { ok: false, error: "Bitte nur Bilddateien hochladen." };
      }

      const ext = (imageName.split(".").pop() || "").toLowerCase() || "jpg";
      const safeBase = imageName.replace(/\s+/g, "_").replace(/[^\w.\-]/g, "");
      const imgPath = `certificates/images/${existing.userId}-${Date.now()}-${safeBase}.${ext}`;

      const imgBlob = await put(imgPath, imageFile, {
        access: "public",
        token,
        addRandomSuffix: true,
      });

      imageUrl = imgBlob.url;
    }

    await prisma.userCertificate.update({
      where: { id },
      data: {
        title,
        description,
        pdfUrl,
        pdfName,
        pdfSize,
        imageUrl,
        imageName,
        imageSize,
      },
    });

    return { ok: true };
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return { ok: false, error: "Keine Berechtigung für diese Aktion." };
    }
    return { ok: false, error: "Fehler beim Aktualisieren des Zertifikats." };
  }
}

export async function deleteCertificate(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!id) return { ok: false, error: "Zertifikat nicht gefunden." };

  try {
    const existing = await prisma.userCertificate.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) return { ok: false, error: "Zertifikat existiert nicht mehr." };

    await ensureCanEditCertificates(existing.userId);

    await prisma.userCertificate.delete({ where: { id } });

    return { ok: true };
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return { ok: false, error: "Keine Berechtigung für diese Aktion." };
    }
    return { ok: false, error: "Fehler beim Löschen des Zertifikats." };
  }
}

