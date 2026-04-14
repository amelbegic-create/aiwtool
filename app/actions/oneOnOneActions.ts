"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { revalidatePath } from "next/cache";
import type { OneOnOneTopicStatus } from "@prisma/client";

const GOD_ROLES = new Set(["SYSTEM_ARCHITECT", "ADMIN"]);

async function getCallingUser() {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, name: true, supervisorId: true },
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type OneOnOneTopicRow = {
  id: string;
  title: string;
  details: string | null;
  isUrgent: boolean;
  status: OneOnOneTopicStatus;
  supervisorNotes: string | null;
  agreedActions: string | null;
  isArchivedByRequester: boolean;
  isArchivedBySupervisor: boolean;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdByUser: { id: string; name: string | null; email: string | null; image: string | null };
  supervisor: { id: string; name: string | null; email: string | null; image: string | null };
};

const TOPIC_SELECT = {
  id: true,
  title: true,
  details: true,
  isUrgent: true,
  status: true,
  supervisorNotes: true,
  agreedActions: true,
  isArchivedByRequester: true,
  isArchivedBySupervisor: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true, email: true, image: true } },
  supervisor: { select: { id: true, name: true, email: true, image: true } },
} as const;

function mapRow(r: {
  id: string; title: string; details: string | null; isUrgent: boolean;
  status: OneOnOneTopicStatus; supervisorNotes: string | null; agreedActions: string | null;
  isArchivedByRequester: boolean; isArchivedBySupervisor: boolean; resolvedAt: Date | null;
  createdAt: Date; updatedAt: Date;
  createdBy: { id: string; name: string | null; email: string | null; image: string | null };
  supervisor: { id: string; name: string | null; email: string | null; image: string | null };
}): OneOnOneTopicRow {
  return { ...r, createdByUser: r.createdBy };
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createOneOnOneTopic(data: {
  title: string;
  details?: string;
  isUrgent?: boolean;
}): Promise<{ ok: true; topic: OneOnOneTopicRow } | { ok: false; error: string }> {
  const caller = await getCallingUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };
  if (!caller.supervisorId)
    return { ok: false, error: "Kein Vorgesetzter zugewiesen. Bitte Admin kontaktieren." };

  const title = data.title.trim();
  if (!title) return { ok: false, error: "Titel darf nicht leer sein." };

  const created = await prisma.oneOnOneTopic.create({
    data: {
      createdByUserId: caller.id,
      supervisorUserId: caller.supervisorId,
      title,
      details: data.details?.trim() || null,
      isUrgent: data.isUrgent ?? false,
    },
    select: TOPIC_SELECT,
  });

  revalidatePath("/profile");
  return { ok: true, topic: mapRow(created) };
}

// ─── List (requester's own) ───────────────────────────────────────────────────

export async function getMyOneOnOneTopics(opts?: {
  archived?: boolean;
}): Promise<OneOnOneTopicRow[]> {
  const caller = await getCallingUser();
  if (!caller) return [];

  const rows = await prisma.oneOnOneTopic.findMany({
    where: {
      createdByUserId: caller.id,
      isArchivedByRequester: opts?.archived ?? false,
    },
    select: TOPIC_SELECT,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(mapRow);
}

// ─── List (supervisor's inbox) ────────────────────────────────────────────────

export async function getMySubordinateTopics(opts?: {
  archived?: boolean;
}): Promise<OneOnOneTopicRow[]> {
  const caller = await getCallingUser();
  if (!caller) return [];

  const rows = await prisma.oneOnOneTopic.findMany({
    where: {
      supervisorUserId: caller.id,
      isArchivedBySupervisor: opts?.archived ?? false,
    },
    select: TOPIC_SELECT,
    orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(mapRow);
}

// ─── Count helpers (for Overview tab) ────────────────────────────────────────

export async function getMyOneOnOneOpenCount(): Promise<number> {
  const caller = await getCallingUser();
  if (!caller) return 0;
  return prisma.oneOnOneTopic.count({
    where: {
      createdByUserId: caller.id,
      status: { in: ["OPEN", "IN_PROGRESS"] },
      isArchivedByRequester: false,
    },
  });
}

export async function getSupervisorInboxCount(): Promise<number> {
  const caller = await getCallingUser();
  if (!caller) return 0;
  return prisma.oneOnOneTopic.count({
    where: {
      supervisorUserId: caller.id,
      status: { in: ["OPEN", "IN_PROGRESS"] },
      isArchivedBySupervisor: false,
    },
  });
}

// ─── Update status (supervisor) ───────────────────────────────────────────────

export async function updateTopicStatus(
  topicId: string,
  newStatus: "IN_PROGRESS" | "DONE" | "CANCELLED",
  notes?: { supervisorNotes?: string; agreedActions?: string }
): Promise<{ ok: boolean; error?: string }> {
  const caller = await getCallingUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const topic = await prisma.oneOnOneTopic.findUnique({
    where: { id: topicId },
    select: { supervisorUserId: true, createdByUserId: true, status: true },
  });
  if (!topic) return { ok: false, error: "Thema nicht gefunden." };

  const isSupervisor = topic.supervisorUserId === caller.id;
  const isRequester = topic.createdByUserId === caller.id;
  const isGod = GOD_ROLES.has(caller.role);

  if (!isSupervisor && !isGod)
    return { ok: false, error: "Keine Berechtigung." };

  // Requester can only cancel their own OPEN topics
  if (newStatus === "CANCELLED" && isRequester && !isSupervisor && !isGod) {
    if (topic.status !== "OPEN") return { ok: false, error: "Nur offene Themen können storniert werden." };
  }

  await prisma.oneOnOneTopic.update({
    where: { id: topicId },
    data: {
      status: newStatus,
      supervisorNotes: notes?.supervisorNotes !== undefined
        ? notes.supervisorNotes.trim() || null
        : undefined,
      agreedActions: notes?.agreedActions !== undefined
        ? notes.agreedActions.trim() || null
        : undefined,
      resolvedAt: newStatus === "DONE" ? new Date() : undefined,
      updatedAt: new Date(),
    },
  });

  revalidatePath("/profile");
  return { ok: true };
}

// ─── Requester: cancel own topic ─────────────────────────────────────────────

export async function cancelMyTopic(
  topicId: string
): Promise<{ ok: boolean; error?: string }> {
  const caller = await getCallingUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const topic = await prisma.oneOnOneTopic.findUnique({
    where: { id: topicId },
    select: { createdByUserId: true, status: true },
  });
  if (!topic) return { ok: false, error: "Thema nicht gefunden." };
  if (topic.createdByUserId !== caller.id && !GOD_ROLES.has(caller.role))
    return { ok: false, error: "Keine Berechtigung." };
  if (topic.status !== "OPEN")
    return { ok: false, error: "Nur offene Themen können storniert werden." };

  await prisma.oneOnOneTopic.update({
    where: { id: topicId },
    data: { status: "CANCELLED", updatedAt: new Date() },
  });

  revalidatePath("/profile");
  return { ok: true };
}

// ─── Archive (both sides can archive their own view) ─────────────────────────

export async function archiveTopic(
  topicId: string
): Promise<{ ok: boolean; error?: string }> {
  const caller = await getCallingUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const topic = await prisma.oneOnOneTopic.findUnique({
    where: { id: topicId },
    select: { createdByUserId: true, supervisorUserId: true, status: true },
  });
  if (!topic) return { ok: false, error: "Thema nicht gefunden." };

  const isRequester = topic.createdByUserId === caller.id;
  const isSupervisor = topic.supervisorUserId === caller.id;
  const isGod = GOD_ROLES.has(caller.role);

  if (!isRequester && !isSupervisor && !isGod)
    return { ok: false, error: "Keine Berechtigung." };

  const data: Record<string, boolean> = {};
  if (isRequester || isGod) data.isArchivedByRequester = true;
  if (isSupervisor || isGod) data.isArchivedBySupervisor = true;

  await prisma.oneOnOneTopic.update({ where: { id: topicId }, data });
  revalidatePath("/profile");
  return { ok: true };
}

// ─── Unarchive ────────────────────────────────────────────────────────────────

export async function unarchiveTopic(
  topicId: string
): Promise<{ ok: boolean; error?: string }> {
  const caller = await getCallingUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const topic = await prisma.oneOnOneTopic.findUnique({
    where: { id: topicId },
    select: { createdByUserId: true, supervisorUserId: true },
  });
  if (!topic) return { ok: false, error: "Thema nicht gefunden." };

  const isRequester = topic.createdByUserId === caller.id;
  const isSupervisor = topic.supervisorUserId === caller.id;
  const isGod = GOD_ROLES.has(caller.role);

  if (!isRequester && !isSupervisor && !isGod)
    return { ok: false, error: "Keine Berechtigung." };

  const data: Record<string, boolean> = {};
  if (isRequester || isGod) data.isArchivedByRequester = false;
  if (isSupervisor || isGod) data.isArchivedBySupervisor = false;

  await prisma.oneOnOneTopic.update({ where: { id: topicId }, data });
  revalidatePath("/profile");
  return { ok: true };
}

// ─── Update supervisor notes ──────────────────────────────────────────────────

export async function updateTopicNotes(
  topicId: string,
  data: { supervisorNotes?: string; agreedActions?: string }
): Promise<{ ok: boolean; error?: string }> {
  const caller = await getCallingUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const topic = await prisma.oneOnOneTopic.findUnique({
    where: { id: topicId },
    select: { supervisorUserId: true },
  });
  if (!topic) return { ok: false, error: "Thema nicht gefunden." };
  if (topic.supervisorUserId !== caller.id && !GOD_ROLES.has(caller.role))
    return { ok: false, error: "Keine Berechtigung." };

  await prisma.oneOnOneTopic.update({
    where: { id: topicId },
    data: {
      supervisorNotes: data.supervisorNotes !== undefined
        ? data.supervisorNotes.trim() || null
        : undefined,
      agreedActions: data.agreedActions !== undefined
        ? data.agreedActions.trim() || null
        : undefined,
      updatedAt: new Date(),
    },
  });

  revalidatePath("/profile");
  return { ok: true };
}

// ─── Requester can edit OPEN topic ───────────────────────────────────────────

export async function updateMyTopic(
  topicId: string,
  data: { title?: string; details?: string; isUrgent?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const caller = await getCallingUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const topic = await prisma.oneOnOneTopic.findUnique({
    where: { id: topicId },
    select: { createdByUserId: true, status: true },
  });
  if (!topic) return { ok: false, error: "Thema nicht gefunden." };
  if (topic.createdByUserId !== caller.id && !GOD_ROLES.has(caller.role))
    return { ok: false, error: "Keine Berechtigung." };
  if (topic.status !== "OPEN")
    return { ok: false, error: "Nur offene Themen können bearbeitet werden." };

  await prisma.oneOnOneTopic.update({
    where: { id: topicId },
    data: {
      title: data.title?.trim() || undefined,
      details: data.details !== undefined ? data.details.trim() || null : undefined,
      isUrgent: data.isUrgent !== undefined ? data.isUrgent : undefined,
      updatedAt: new Date(),
    },
  });

  revalidatePath("/profile");
  return { ok: true };
}
