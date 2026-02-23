"use server";

import prisma from "@/lib/prisma";
import { getDbUserForAccess, requirePermission, tryRequirePermission } from "@/lib/access";

export type IdeaWithUser = {
  id: string;
  text: string;
  userId: string;
  isRead: boolean;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    restaurants: { restaurant: { id: string; name: string | null; code: string } }[];
  };
};

export async function submitIdea(text: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = (text || "").trim();
  if (!trimmed) return { ok: false, error: "Bitte Text eingeben." };

  try {
    const user = await getDbUserForAccess();
    await prisma.idea.create({
      data: { text: trimmed, userId: user.id },
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
