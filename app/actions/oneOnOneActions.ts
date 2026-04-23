"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
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
  meetingStartsAt: Date | null;
  meetingEndsAt: Date | null;
  meetingLocation: string | null;
  requesterCalendarEventId: string | null;
  supervisorCalendarEventId: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdByUser: { id: string; name: string | null; email: string | null; image: string | null };
  supervisor: { id: string; name: string | null; email: string | null; image: string | null };
};

export type OneOnOneCommentRow = {
  id: string;
  topicId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string | null; image: string | null };
  attachments: OneOnOneAttachmentRow[];
};

export type OneOnOneAttachmentRow = {
  id: string;
  topicId: string;
  commentId: string | null;
  uploadedById: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  createdAt: Date;
  uploadedBy: { id: string; name: string | null };
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
  meetingStartsAt: true,
  meetingEndsAt: true,
  meetingLocation: true,
  requesterCalendarEventId: true,
  supervisorCalendarEventId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true, email: true, image: true } },
  supervisor: { select: { id: true, name: true, email: true, image: true } },
} as const;

function mapRow(r: {
  id: string; title: string; details: string | null; isUrgent: boolean;
  status: OneOnOneTopicStatus; supervisorNotes: string | null; agreedActions: string | null;
  isArchivedByRequester: boolean; isArchivedBySupervisor: boolean; resolvedAt: Date | null;
  meetingStartsAt: Date | null; meetingEndsAt: Date | null; meetingLocation: string | null;
  requesterCalendarEventId: string | null; supervisorCalendarEventId: string | null;
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

// ─── Supervisor creates topic for a subordinate ───────────────────────────────

export async function createOneOnOneTopicAsSupervisor(data: {
  subordinateUserId: string;
  title: string;
  details?: string;
  isUrgent?: boolean;
}): Promise<{ ok: true; topic: OneOnOneTopicRow } | { ok: false; error: string }> {
  const caller = await getCallingUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const title = data.title.trim();
  if (!title) return { ok: false, error: "Titel darf nicht leer sein." };

  const subordinate = await prisma.user.findUnique({
    where: { id: data.subordinateUserId },
    select: { id: true, supervisorId: true, name: true },
  });
  if (!subordinate) return { ok: false, error: "Mitarbeiter nicht gefunden." };

  const isGod = GOD_ROLES.has(caller.role);
  if (!isGod && subordinate.supervisorId !== caller.id)
    return { ok: false, error: "Dieser Mitarbeiter ist nicht Ihr Untergebener." };

  const created = await prisma.oneOnOneTopic.create({
    data: {
      createdByUserId: data.subordinateUserId,
      supervisorUserId: caller.id,
      title,
      details: data.details?.trim() || null,
      isUrgent: data.isUrgent ?? false,
    },
    select: TOPIC_SELECT,
  });

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true, topic: mapRow(created) };
}

// ─── Schedule meeting (supervisor or GOD only) ────────────────────────────────

export async function scheduleOneOnOneMeeting(
  topicId: string,
  data: { startsAt: Date; endsAt?: Date; location?: string }
): Promise<{ ok: boolean; error?: string }> {
  const caller = await getCallingUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const topic = await prisma.oneOnOneTopic.findUnique({
    where: { id: topicId },
    select: {
      supervisorUserId: true,
      createdByUserId: true,
      title: true,
      requesterCalendarEventId: true,
      supervisorCalendarEventId: true,
    },
  });
  if (!topic) return { ok: false, error: "Thema nicht gefunden." };

  const isSupervisor = topic.supervisorUserId === caller.id;
  const isGod = GOD_ROLES.has(caller.role);
  if (!isSupervisor && !isGod)
    return { ok: false, error: "Nur der Vorgesetzte kann den Termin festlegen." };

  const title = `Gespräch: ${topic.title}`;

  // Delete old calendar events if they exist
  if (topic.requesterCalendarEventId) {
    await prisma.calendarEvent.deleteMany({ where: { id: topic.requesterCalendarEventId } });
  }
  if (topic.supervisorCalendarEventId) {
    await prisma.calendarEvent.deleteMany({ where: { id: topic.supervisorCalendarEventId } });
  }

  // Create calendar events for both participants
  const [reqEvent, supEvent] = await Promise.all([
    prisma.calendarEvent.create({
      data: {
        userId: topic.createdByUserId,
        title,
        date: data.startsAt,
        endDate: data.endsAt ?? null,
        type: "one_on_one",
        color: "#1a3826",
      },
    }),
    prisma.calendarEvent.create({
      data: {
        userId: topic.supervisorUserId,
        title,
        date: data.startsAt,
        endDate: data.endsAt ?? null,
        type: "one_on_one",
        color: "#1a3826",
      },
    }),
  ]);

  await prisma.oneOnOneTopic.update({
    where: { id: topicId },
    data: {
      meetingStartsAt: data.startsAt,
      meetingEndsAt: data.endsAt ?? null,
      meetingLocation: data.location?.trim() || null,
      requesterCalendarEventId: reqEvent.id,
      supervisorCalendarEventId: supEvent.id,
      status: "IN_PROGRESS",
      updatedAt: new Date(),
    },
  });

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ─── Get subordinates for supervisor ─────────────────────────────────────────

export async function getMySubordinates(): Promise<
  { id: string; name: string | null; email: string | null; image: string | null; role: string }[]
> {
  const caller = await getCallingUser();
  if (!caller) return [];
  const isGod = GOD_ROLES.has(caller.role);

  const users = await prisma.user.findMany({
    where: isGod
      ? { isActive: true }
      : { supervisorId: caller.id, isActive: true },
    select: { id: true, name: true, email: true, image: true, role: true },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ ...u, role: String(u.role) }));
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function getTopicComments(topicId: string): Promise<OneOnOneCommentRow[]> {
  const caller = await getCallingUser();
  if (!caller) return [];

  const topic = await prisma.oneOnOneTopic.findUnique({
    where: { id: topicId },
    select: { createdByUserId: true, supervisorUserId: true },
  });
  if (!topic) return [];
  const isParticipant =
    topic.createdByUserId === caller.id ||
    topic.supervisorUserId === caller.id ||
    GOD_ROLES.has(caller.role);
  if (!isParticipant) return [];

  const comments = await prisma.oneOnOneComment.findMany({
    where: { topicId },
    include: {
      author: { select: { id: true, name: true, image: true } },
      attachments: {
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return comments;
}

export async function addOneOnOneComment(
  topicId: string,
  body: string
): Promise<{ ok: boolean; error?: string; comment?: OneOnOneCommentRow }> {
  const caller = await getCallingUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const b = body.trim();
  if (!b) return { ok: false, error: "Kommentar darf nicht leer sein." };

  const topic = await prisma.oneOnOneTopic.findUnique({
    where: { id: topicId },
    select: { createdByUserId: true, supervisorUserId: true },
  });
  if (!topic) return { ok: false, error: "Thema nicht gefunden." };
  const isParticipant =
    topic.createdByUserId === caller.id ||
    topic.supervisorUserId === caller.id ||
    GOD_ROLES.has(caller.role);
  if (!isParticipant) return { ok: false, error: "Keine Berechtigung." };

  const comment = await prisma.oneOnOneComment.create({
    data: { topicId, authorId: caller.id, body: b },
    include: {
      author: { select: { id: true, name: true, image: true } },
      attachments: {
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  revalidatePath("/profile");
  return { ok: true, comment };
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export async function uploadOneOnOneAttachment(
  formData: FormData,
  opts: { topicId: string; commentId?: string }
): Promise<{ ok: boolean; error?: string; attachment?: OneOnOneAttachmentRow }> {
  const caller = await getCallingUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const topic = await prisma.oneOnOneTopic.findUnique({
    where: { id: opts.topicId },
    select: { createdByUserId: true, supervisorUserId: true },
  });
  if (!topic) return { ok: false, error: "Thema nicht gefunden." };
  const isParticipant =
    topic.createdByUserId === caller.id ||
    topic.supervisorUserId === caller.id ||
    GOD_ROLES.has(caller.role);
  if (!isParticipant) return { ok: false, error: "Keine Berechtigung." };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "Keine Datei ausgewählt." };
  if (file.size > 20 * 1024 * 1024)
    return { ok: false, error: "Datei zu groß (max. 20 MB)." };

  const blob = await put(`1on1/${opts.topicId}/${Date.now()}_${file.name}`, file, {
    access: "public",
    contentType: file.type,
  });

  const attachment = await prisma.oneOnOneAttachment.create({
    data: {
      topicId: opts.topicId,
      commentId: opts.commentId ?? null,
      uploadedById: caller.id,
      fileUrl: blob.url,
      fileName: file.name,
      fileType: file.type,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });

  revalidatePath("/profile");
  return { ok: true, attachment };
}

export async function getTopicAttachments(topicId: string): Promise<OneOnOneAttachmentRow[]> {
  const caller = await getCallingUser();
  if (!caller) return [];

  const topic = await prisma.oneOnOneTopic.findUnique({
    where: { id: topicId },
    select: { createdByUserId: true, supervisorUserId: true },
  });
  if (!topic) return [];
  const isParticipant =
    topic.createdByUserId === caller.id ||
    topic.supervisorUserId === caller.id ||
    GOD_ROLES.has(caller.role);
  if (!isParticipant) return [];

  return prisma.oneOnOneAttachment.findMany({
    where: { topicId, commentId: null },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

// ─── Dashboard preview helpers ────────────────────────────────────────────────

export async function getDashboardOneOnOnePreview(userId: string): Promise<{
  myOpenCount: number;
  inboxCount: number;
  recentTopics: OneOnOneTopicRow[];
  nextMeeting: OneOnOneTopicRow | null;
}> {
  const [myOpen, inboxCount, recentTopics, nextMeeting] = await Promise.all([
    prisma.oneOnOneTopic.count({
      where: {
        createdByUserId: userId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        isArchivedByRequester: false,
      },
    }),
    prisma.oneOnOneTopic.count({
      where: {
        supervisorUserId: userId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        isArchivedBySupervisor: false,
      },
    }),
    prisma.oneOnOneTopic.findMany({
      where: {
        OR: [
          { createdByUserId: userId, isArchivedByRequester: false },
          { supervisorUserId: userId, isArchivedBySupervisor: false },
        ],
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      select: TOPIC_SELECT,
      orderBy: { updatedAt: "desc" },
      take: 3,
    }),
    prisma.oneOnOneTopic.findFirst({
      where: {
        OR: [{ createdByUserId: userId }, { supervisorUserId: userId }],
        meetingStartsAt: { gte: new Date() },
        isArchivedByRequester: false,
      },
      select: TOPIC_SELECT,
      orderBy: { meetingStartsAt: "asc" },
    }),
  ]);

  return {
    myOpenCount: myOpen,
    inboxCount,
    recentTopics: recentTopics.map(mapRow),
    nextMeeting: nextMeeting ? mapRow(nextMeeting) : null,
  };
}
