"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { canEditDashboardChangelog } from "@/lib/permissions";

export type ChangelogEntry = {
  content: string;
  updatedAt: string;
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
      },
    });
    if (!row) return null;
    return {
      content: row.content,
      updatedAt: row.updatedAt.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function updateDashboardChangelog(content: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return { ok: false, error: "Nicht angemeldet." };

  const sessionRole = (session?.user as { role?: string })?.role;
  const sessionPerms = (session?.user as { permissions?: string[] })?.permissions ?? [];
  if (!canEditDashboardChangelog(sessionRole, sessionPerms)) {
    return { ok: false, error: "Keine Berechtigung für diese Seite." };
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
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler beim Speichern." };
  }
}
