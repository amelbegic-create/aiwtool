"use server";

import prisma from "@/lib/prisma";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/access";

const MAX_PDF_BYTES = 50 * 1024 * 1024;

export type DashboardPinnedDocPublic = {
  id: string;
  key: string;
  title: string;
  pdfUrl: string | null;
};

function assertPdfFile(file: File) {
  if (!file || file.size === 0) throw new Error("PDF: Datei fehlt.");
  if (file.size > MAX_PDF_BYTES) throw new Error("PDF: Max. 50 MB.");
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  const isPdf = type === "application/pdf" || name.endsWith(".pdf") || type.endsWith("/pdf");
  if (!isPdf) throw new Error("PDF: Nur PDF-Dateien erlaubt.");
}

async function uploadPdf(file: File, key: string): Promise<string> {
  assertPdfFile(file);
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN fehlt.");
  const originalName = file.name || `${key}.pdf`;
  const safeBase = originalName.replace(/\s+/g, "_").replace(/[^\w.\-]/g, "");
  const path = `dashboard-docs/${key}-${Date.now()}-${safeBase}`;
  const blob = await put(path, file, { access: "public", token, addRandomSuffix: true });
  return blob.url;
}

export async function getPinnedDocs(): Promise<DashboardPinnedDocPublic[]> {
  const rows = await prisma.dashboardPinnedDoc.findMany({
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, key: true, title: true, pdfUrl: true },
  });
  return rows.map((r) => ({ ...r, pdfUrl: r.pdfUrl ?? null }));
}

export async function createPinnedDoc(): Promise<{ ok: boolean; error?: string; doc?: DashboardPinnedDocPublic }> {
  try {
    await requirePermission("dashboard_docs:manage");
    const key = `doc_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const doc = await prisma.dashboardPinnedDoc.create({
      data: { key, title: "Neues Dokument", pdfUrl: null },
      select: { id: true, key: true, title: true, pdfUrl: true },
    });
    revalidatePath("/admin/dashboard-docs");
    return { ok: true, doc: { ...doc, pdfUrl: doc.pdfUrl ?? null } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}

export async function deletePinnedDoc(docId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("dashboard_docs:manage");
    await prisma.dashboardPinnedDoc.delete({ where: { id: docId } });
    revalidatePath("/dashboard");
    revalidatePath("/admin/dashboard-docs");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}

export async function updatePinnedDocMetadata(opts: {
  docId: string;
  title: string;
  pdfUrl?: string | null;
}): Promise<{ ok: boolean; error?: string; doc?: DashboardPinnedDocPublic }> {
  try {
    await requirePermission("dashboard_docs:manage");
    const docId = String(opts.docId ?? "").trim();
    if (!docId) return { ok: false, error: "Dokument fehlt." };

    const title = String(opts.title ?? "").trim();
    if (!title) return { ok: false, error: "Titel ist erforderlich." };

    const existing = await prisma.dashboardPinnedDoc.findUnique({
      where: { id: docId },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "Dokument nicht gefunden." };

    const pdfUrl = typeof opts.pdfUrl === "string" ? opts.pdfUrl : null;

    const doc = await prisma.dashboardPinnedDoc.update({
      where: { id: docId },
      data: { title, ...(pdfUrl ? { pdfUrl } : {}) },
      select: { id: true, key: true, title: true, pdfUrl: true },
    });

    revalidatePath("/dashboard");
    revalidatePath("/admin/dashboard-docs");
    return { ok: true, doc: { ...doc, pdfUrl: doc.pdfUrl ?? null } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}

