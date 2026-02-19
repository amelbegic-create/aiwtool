"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export type ChangelogEntry = {
  content: string;
  updatedAt: string;
  updatedByName?: string | null;
};

/** Erstellt die Tabelle, falls sie fehlt (z. B. bei neuem Deployment). */
async function ensureTable() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "dashboard_changelog" (
      "id" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedById" TEXT,
      CONSTRAINT "dashboard_changelog_pkey" PRIMARY KEY ("id")
    );
  `);
}

export async function getDashboardChangelog(): Promise<ChangelogEntry | null> {
  try {
    const row = await prisma.dashboardChangelog.findFirst({
      orderBy: { updatedAt: "desc" },
      select: {
        content: true,
        updatedAt: true,
        updatedBy: { select: { name: true } },
      },
    });
    if (!row) return null;
    return {
      content: row.content,
      updatedAt: row.updatedAt.toISOString(),
      updatedByName: row.updatedBy?.name ?? null,
    };
  } catch {
    return null;
  }
}

export async function updateDashboardChangelog(content: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return { ok: false, error: "Nicht angemeldet." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role !== "SYSTEM_ARCHITECT") {
    return { ok: false, error: "Nur System Architect darf die Änderungen bearbeiten." };
  }

  try {
    await ensureTable();

    const existing = await prisma.dashboardChangelog.findFirst({ orderBy: { updatedAt: "desc" }, select: { id: true } });
    if (existing) {
      await prisma.dashboardChangelog.update({
        where: { id: existing.id },
        data: { content, updatedById: userId },
      });
    } else {
      await prisma.dashboardChangelog.create({
        data: { content, updatedById: userId },
      });
    }
    revalidatePath("/dashboard");
    revalidatePath("/admin/dashboard-text");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler beim Speichern." };
  }
}
