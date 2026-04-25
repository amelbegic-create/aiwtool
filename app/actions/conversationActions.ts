"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";

const GOD_ROLES = new Set(["SYSTEM_ARCHITECT", "ADMIN"]);
const REVALIDATE = "/profile";

async function getCallerUser() {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, name: true, supervisorId: true },
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConversationAttachmentRow = {
  id: string;
  conversationId: string;
  itemId: string | null;
  uploadedById: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  createdAt: Date;
  uploadedBy: { id: string; name: string | null };
};

export type ConversationItemCommentRow = {
  id: string;
  itemId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string | null; image: string | null };
};

export type ConversationItemRow = {
  id: string;
  conversationId: string;
  createdById: string | null;
  createdBy: { id: string; name: string | null; image: string | null } | null;
  title: string;
  comment: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  attachments: ConversationAttachmentRow[];
};

export type ConversationTodoRow = {
  id: string;
  conversationId: string;
  createdById: string;
  title: string;
  completed: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; name: string | null; image: string | null };
};

export type ConversationRow = {
  id: string;
  createdById: string | null;
  requesterUserId: string;
  supervisorUserId: string;
  meetingDate: string | null;
  notes: string | null;
  status: "OPEN" | "ARCHIVED";
  archivedAt: Date | null;
  archivedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  requester: { id: string; name: string | null; email: string | null; image: string | null };
  supervisor: { id: string; name: string | null; email: string | null; image: string | null };
  items: ConversationItemRow[];
  attachments: ConversationAttachmentRow[];
};

const ATTACHMENT_SELECT = {
  id: true,
  conversationId: true,
  itemId: true,
  uploadedById: true,
  fileUrl: true,
  fileName: true,
  fileType: true,
  createdAt: true,
  uploadedBy: { select: { id: true, name: true } },
} as const;

const ITEM_COMMENT_SELECT = {
  id: true,
  itemId: true,
  authorId: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, name: true, image: true } },
} as const;

const TODO_SELECT = {
  id: true,
  conversationId: true,
  createdById: true,
  title: true,
  completed: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true, image: true } },
} as const;

const CONV_SELECT = {
  id: true,
  createdById: true,
  requesterUserId: true,
  supervisorUserId: true,
  meetingDate: true,
  notes: true,
  status: true,
  archivedAt: true,
  archivedById: true,
  createdAt: true,
  updatedAt: true,
  requester: { select: { id: true, name: true, email: true, image: true } },
  supervisor: { select: { id: true, name: true, email: true, image: true } },
  items: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      attachments: {
        select: ATTACHMENT_SELECT,
        orderBy: { createdAt: "asc" as const },
      },
    },
  },
  attachments: {
    where: { itemId: null },
    select: ATTACHMENT_SELECT,
    orderBy: { createdAt: "asc" as const },
  },
} as const;

function isParticipant(conv: { requesterUserId: string; supervisorUserId: string }, userId: string, role: string) {
  return conv.requesterUserId === userId || conv.supervisorUserId === userId || GOD_ROLES.has(role);
}

async function getConversationByItemId(itemId: string) {
  const item = await prisma.oneOnOneConversationItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      conversationId: true,
      conversation: { select: { requesterUserId: true, supervisorUserId: true, status: true } },
    },
  });
  return item;
}

// ─── Create conversation ───────────────────────────────────────────────────────

export async function createConversation(data?: {
  meetingDate?: string;
  notes?: string;
  /** GOD only: start a conversation with this user (caller becomes supervisor) */
  withUserId?: string;
}): Promise<{ ok: true; conversation: ConversationRow } | { ok: false; error: string }> {
  const caller = await getCallerUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };
  const isGod = GOD_ROLES.has(caller.role);
  const withUserId = data?.withUserId?.trim() || null;
  if (!caller.supervisorId && !(isGod && withUserId)) {
    return { ok: false, error: "Kein Vorgesetzter zugewiesen." };
  }

  if (withUserId && !isGod) {
    return { ok: false, error: "Keine Berechtigung." };
  }

  // Default behavior: requester=caller, supervisor=caller.supervisorId
  const requesterUserId = withUserId ? withUserId : caller.id;
  const supervisorUserId = withUserId ? caller.id : String(caller.supervisorId);

  const conv = await prisma.oneOnOneConversation.create({
    data: {
      createdById: caller.id,
      requesterUserId,
      supervisorUserId,
      meetingDate: data?.meetingDate?.trim() || null,
      notes: data?.notes?.trim() || null,
    },
    select: CONV_SELECT,
  });

  revalidatePath(REVALIDATE);
  return { ok: true, conversation: conv as ConversationRow };
}

export async function listConversationCreateTargets(): Promise<{ id: string; name: string | null; email: string | null; image: string | null }[]> {
  const caller = await getCallerUser();
  if (!caller) return [];
  if (!GOD_ROLES.has(caller.role)) return [];
  return prisma.user.findMany({
    where: { isActive: true, role: { not: "SYSTEM_ARCHITECT" } },
    select: { id: true, name: true, email: true, image: true },
    orderBy: { name: "asc" },
    take: 500,
  });
}

// ─── List (as requester or supervisor) ───────────────────────────────────────

export async function listMyConversations(opts?: {
  archived?: boolean;
}): Promise<ConversationRow[]> {
  try {
    const caller = await getCallerUser();
    if (!caller) return [];
    const isGod = GOD_ROLES.has(caller.role);
    const archived = opts?.archived ?? false;
    const status = archived ? "ARCHIVED" : "OPEN";

    const rows = await prisma.oneOnOneConversation.findMany({
      where: isGod
        ? { status }
        : { requesterUserId: caller.id, status },
      select: CONV_SELECT,
      orderBy: { updatedAt: "desc" },
    });
    return rows as ConversationRow[];
  } catch {
    return [];
  }
}

export async function listSupervisorConversations(opts?: {
  archived?: boolean;
}): Promise<ConversationRow[]> {
  try {
    const caller = await getCallerUser();
    if (!caller) return [];
    const isGod = GOD_ROLES.has(caller.role);
    const archived = opts?.archived ?? false;
    const status = archived ? "ARCHIVED" : "OPEN";

    const rows = await prisma.oneOnOneConversation.findMany({
      where: isGod
        ? { status }
        : { supervisorUserId: caller.id, status },
      select: CONV_SELECT,
      orderBy: { updatedAt: "desc" },
    });
    return rows as ConversationRow[];
  } catch {
    return [];
  }
}

// ─── Update conversation meta (meeting date / notes) ─────────────────────────

export async function updateConversationMeta(
  conversationId: string,
  data: { meetingDate?: string | null; notes?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  const caller = await getCallerUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const conv = await prisma.oneOnOneConversation.findUnique({
    where: { id: conversationId },
    select: { requesterUserId: true, supervisorUserId: true, status: true },
  });
  if (!conv) return { ok: false, error: "Gespräch nicht gefunden." };
  if (!isParticipant(conv, caller.id, caller.role)) return { ok: false, error: "Keine Berechtigung." };
  if (conv.status === "ARCHIVED") return { ok: false, error: "Archivierte Gespräche können nicht bearbeitet werden." };

  await prisma.oneOnOneConversation.update({
    where: { id: conversationId },
    data: {
      meetingDate: data.meetingDate !== undefined ? data.meetingDate?.trim() || null : undefined,
      notes: data.notes !== undefined ? data.notes?.trim() || null : undefined,
    },
  });

  revalidatePath(REVALIDATE);
  return { ok: true };
}

// ─── Archive conversation (supervisor only) ───────────────────────────────────

export async function archiveConversation(
  conversationId: string
): Promise<{ ok: boolean; error?: string }> {
  const caller = await getCallerUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const conv = await prisma.oneOnOneConversation.findUnique({
    where: { id: conversationId },
    select: { supervisorUserId: true, requesterUserId: true, status: true },
  });
  if (!conv) return { ok: false, error: "Gespräch nicht gefunden." };
  const isSupervisor = conv.supervisorUserId === caller.id;
  const isGod = GOD_ROLES.has(caller.role);
  if (!isSupervisor && !isGod) return { ok: false, error: "Nur der Vorgesetzte kann das Gespräch archivieren." };
  if (conv.status === "ARCHIVED") return { ok: false, error: "Bereits archiviert." };

  await prisma.oneOnOneConversation.update({
    where: { id: conversationId },
    data: { status: "ARCHIVED", archivedAt: new Date(), archivedById: caller.id },
  });

  revalidatePath(REVALIDATE);
  return { ok: true };
}

// ─── Unarchive ────────────────────────────────────────────────────────────────

export async function unarchiveConversation(
  conversationId: string
): Promise<{ ok: boolean; error?: string }> {
  const caller = await getCallerUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const conv = await prisma.oneOnOneConversation.findUnique({
    where: { id: conversationId },
    select: { supervisorUserId: true, requesterUserId: true },
  });
  if (!conv) return { ok: false, error: "Gespräch nicht gefunden." };
  const isSupervisor = conv.supervisorUserId === caller.id;
  const isGod = GOD_ROLES.has(caller.role);
  if (!isSupervisor && !isGod) return { ok: false, error: "Keine Berechtigung." };

  await prisma.oneOnOneConversation.update({
    where: { id: conversationId },
    data: { status: "OPEN", archivedAt: null, archivedById: null },
  });

  revalidatePath(REVALIDATE);
  return { ok: true };
}

// ─── Delete conversation (requester or GOD) ───────────────────────────────────

export async function deleteConversation(
  conversationId: string
): Promise<{ ok: boolean; error?: string }> {
  const caller = await getCallerUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const conv = await prisma.oneOnOneConversation.findUnique({
    where: { id: conversationId },
    select: { requesterUserId: true, status: true },
  });
  if (!conv) return { ok: false, error: "Gespräch nicht gefunden." };
  const isRequester = conv.requesterUserId === caller.id;
  const isGod = GOD_ROLES.has(caller.role);
  if (!isRequester && !isGod) return { ok: false, error: "Keine Berechtigung." };
  if (conv.status === "ARCHIVED") return { ok: false, error: "Archivierte Gespräche können nicht gelöscht werden." };

  await prisma.oneOnOneConversation.delete({ where: { id: conversationId } });
  revalidatePath(REVALIDATE);
  return { ok: true };
}

// ─── Conversation Items ────────────────────────────────────────────────────────

export async function addConversationItem(
  conversationId: string,
  data: { title: string }
): Promise<{ ok: boolean; error?: string; item?: ConversationItemRow }> {
  const caller = await getCallerUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const conv = await prisma.oneOnOneConversation.findUnique({
    where: { id: conversationId },
    select: { requesterUserId: true, supervisorUserId: true, status: true, _count: { select: { items: true } } },
  });
  if (!conv) return { ok: false, error: "Gespräch nicht gefunden." };
  if (!isParticipant(conv, caller.id, caller.role)) return { ok: false, error: "Keine Berechtigung." };
  if (conv.status === "ARCHIVED") return { ok: false, error: "Gespräch ist archiviert." };

  const title = data.title.trim();
  if (!title) return { ok: false, error: "Thema darf nicht leer sein." };

  const item = await prisma.oneOnOneConversationItem.create({
    data: {
      conversationId,
      createdById: caller.id,
      title,
      sortOrder: conv._count.items,
    },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      attachments: { select: ATTACHMENT_SELECT, orderBy: { createdAt: "asc" } },
    },
  });

  revalidatePath(REVALIDATE);
  return { ok: true, item: item as ConversationItemRow };
}

export async function updateConversationItem(
  itemId: string,
  data: { title?: string; comment?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  const caller = await getCallerUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const item = await prisma.oneOnOneConversationItem.findUnique({
    where: { id: itemId },
    include: { conversation: { select: { requesterUserId: true, supervisorUserId: true, status: true } } },
  });
  if (!item) return { ok: false, error: "Thema nicht gefunden." };
  if (!isParticipant(item.conversation, caller.id, caller.role)) return { ok: false, error: "Keine Berechtigung." };
  if (item.conversation.status === "ARCHIVED") return { ok: false, error: "Gespräch ist archiviert." };

  await prisma.oneOnOneConversationItem.update({
    where: { id: itemId },
    data: {
      title: data.title !== undefined ? data.title.trim() || item.title : undefined,
      comment: data.comment !== undefined ? data.comment?.trim() || null : undefined,
    },
  });

  // Touch parent updatedAt for dashboard sorting
  await prisma.oneOnOneConversation.update({
    where: { id: item.conversationId },
    data: { updatedAt: new Date() },
  });

  revalidatePath(REVALIDATE);
  return { ok: true };
}

export async function deleteConversationItem(
  itemId: string
): Promise<{ ok: boolean; error?: string }> {
  const caller = await getCallerUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const item = await prisma.oneOnOneConversationItem.findUnique({
    where: { id: itemId },
    include: { conversation: { select: { requesterUserId: true, supervisorUserId: true, status: true } } },
  });
  if (!item) return { ok: false, error: "Thema nicht gefunden." };
  if (!isParticipant(item.conversation, caller.id, caller.role)) return { ok: false, error: "Keine Berechtigung." };
  if (item.conversation.status === "ARCHIVED") return { ok: false, error: "Gespräch ist archiviert." };

  await prisma.oneOnOneConversationItem.delete({ where: { id: itemId } });
  revalidatePath(REVALIDATE);
  return { ok: true };
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export async function uploadConversationAttachment(
  formData: FormData,
  opts: { conversationId: string; itemId?: string }
): Promise<{ ok: boolean; error?: string; attachment?: ConversationAttachmentRow }> {
  const caller = await getCallerUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const conv = await prisma.oneOnOneConversation.findUnique({
    where: { id: opts.conversationId },
    select: { requesterUserId: true, supervisorUserId: true, status: true },
  });
  if (!conv) return { ok: false, error: "Gespräch nicht gefunden." };
  if (!isParticipant(conv, caller.id, caller.role)) return { ok: false, error: "Keine Berechtigung." };
  if (conv.status === "ARCHIVED") return { ok: false, error: "Gespräch ist archiviert." };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "Keine Datei ausgewählt." };
  if (file.size > 20 * 1024 * 1024) return { ok: false, error: "Datei zu groß (max. 20 MB)." };

  const blob = await put(
    `conversations/${opts.conversationId}/${Date.now()}_${file.name}`,
    file,
    { access: "public", contentType: file.type }
  );

  const attachment = await prisma.oneOnOneConversationAttachment.create({
    data: {
      conversationId: opts.conversationId,
      itemId: opts.itemId ?? null,
      uploadedById: caller.id,
      fileUrl: blob.url,
      fileName: file.name,
      fileType: file.type,
    },
    select: ATTACHMENT_SELECT,
  });

  revalidatePath(REVALIDATE);
  return { ok: true, attachment: attachment as ConversationAttachmentRow };
}

export async function deleteConversationAttachment(
  attachmentId: string
): Promise<{ ok: boolean; error?: string }> {
  const caller = await getCallerUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const att = await prisma.oneOnOneConversationAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      id: true,
      conversationId: true,
      conversation: { select: { requesterUserId: true, supervisorUserId: true, status: true } },
    },
  });
  if (!att) return { ok: false, error: "Datei nicht gefunden." };
  if (!isParticipant(att.conversation, caller.id, caller.role)) return { ok: false, error: "Keine Berechtigung." };
  if (att.conversation.status === "ARCHIVED") return { ok: false, error: "Gespräch ist archiviert." };

  await prisma.oneOnOneConversationAttachment.delete({ where: { id: attachmentId } });
  revalidatePath(REVALIDATE);
  return { ok: true };
}

// ─── Item comments (FB-style) ────────────────────────────────────────────────

export async function listConversationItemComments(itemId: string): Promise<ConversationItemCommentRow[]> {
  try {
    const caller = await getCallerUser();
    if (!caller) return [];

    const item = await getConversationByItemId(itemId);
    if (!item) return [];
    if (!isParticipant(item.conversation, caller.id, caller.role)) return [];

    const rows = await prisma.oneOnOneConversationItemComment.findMany({
      where: { itemId },
      select: ITEM_COMMENT_SELECT,
      orderBy: { createdAt: "asc" },
    });
    return rows as ConversationItemCommentRow[];
  } catch {
    return [];
  }
}

export async function addConversationItemComment(
  itemId: string,
  body: string
): Promise<{ ok: boolean; error?: string; comment?: ConversationItemCommentRow }> {
  const caller = await getCallerUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const text = body.trim();
  if (!text) return { ok: false, error: "Kommentar ist leer." };
  if (text.length > 2000) return { ok: false, error: "Kommentar ist zu lang (max. 2000 Zeichen)." };

  const item = await getConversationByItemId(itemId);
  if (!item) return { ok: false, error: "Thema nicht gefunden." };
  if (!isParticipant(item.conversation, caller.id, caller.role)) return { ok: false, error: "Keine Berechtigung." };
  if (item.conversation.status === "ARCHIVED") return { ok: false, error: "Gespräch ist archiviert." };

  const created = await prisma.oneOnOneConversationItemComment.create({
    data: {
      itemId,
      authorId: caller.id,
      body: text,
    },
    select: ITEM_COMMENT_SELECT,
  });

  // Touch parent updatedAt so lists re-sort
  await prisma.oneOnOneConversation.update({
    where: { id: item.conversationId },
    data: { updatedAt: new Date() },
  });

  revalidatePath(REVALIDATE);
  return { ok: true, comment: created as ConversationItemCommentRow };
}

// ─── Conversation ToDos ───────────────────────────────────────────────────────

export async function listConversationTodos(conversationId: string): Promise<ConversationTodoRow[]> {
  try {
    const caller = await getCallerUser();
    if (!caller) return [];

    const conv = await prisma.oneOnOneConversation.findUnique({
      where: { id: conversationId },
      select: { requesterUserId: true, supervisorUserId: true },
    });
    if (!conv) return [];
    if (!isParticipant(conv, caller.id, caller.role)) return [];

    const rows = await prisma.oneOnOneConversationTodoItem.findMany({
      where: { conversationId },
      select: TODO_SELECT,
      orderBy: [{ completed: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows as ConversationTodoRow[];
  } catch {
    return [];
  }
}

export async function addConversationTodo(
  conversationId: string,
  title: string
): Promise<{ ok: boolean; error?: string; todo?: ConversationTodoRow }> {
  const caller = await getCallerUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const conv = await prisma.oneOnOneConversation.findUnique({
    where: { id: conversationId },
    select: { requesterUserId: true, supervisorUserId: true, status: true, _count: { select: { todos: true } } },
  });
  if (!conv) return { ok: false, error: "Gespräch nicht gefunden." };
  if (!isParticipant(conv, caller.id, caller.role)) return { ok: false, error: "Keine Berechtigung." };
  if (conv.status === "ARCHIVED") return { ok: false, error: "Gespräch ist archiviert." };

  const text = title.trim();
  if (!text) return { ok: false, error: "To-Do darf nicht leer sein." };
  if (text.length > 200) return { ok: false, error: "To-Do ist zu lang (max. 200 Zeichen)." };

  const created = await prisma.oneOnOneConversationTodoItem.create({
    data: {
      conversationId,
      createdById: caller.id,
      title: text,
      sortOrder: conv._count.todos,
    },
    select: TODO_SELECT,
  });

  await prisma.oneOnOneConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  revalidatePath(REVALIDATE);
  return { ok: true, todo: created as ConversationTodoRow };
}

export async function toggleConversationTodo(
  todoId: string,
  completed: boolean
): Promise<{ ok: boolean; error?: string }> {
  const caller = await getCallerUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const todo = await prisma.oneOnOneConversationTodoItem.findUnique({
    where: { id: todoId },
    select: { id: true, conversationId: true, conversation: { select: { requesterUserId: true, supervisorUserId: true, status: true } } },
  });
  if (!todo) return { ok: false, error: "To-Do nicht gefunden." };
  if (!isParticipant(todo.conversation, caller.id, caller.role)) return { ok: false, error: "Keine Berechtigung." };
  if (todo.conversation.status === "ARCHIVED") return { ok: false, error: "Gespräch ist archiviert." };

  await prisma.oneOnOneConversationTodoItem.update({ where: { id: todoId }, data: { completed } });
  await prisma.oneOnOneConversation.update({ where: { id: todo.conversationId }, data: { updatedAt: new Date() } });
  revalidatePath(REVALIDATE);
  return { ok: true };
}

export async function deleteConversationTodo(todoId: string): Promise<{ ok: boolean; error?: string }> {
  const caller = await getCallerUser();
  if (!caller) return { ok: false, error: "Nicht angemeldet." };

  const todo = await prisma.oneOnOneConversationTodoItem.findUnique({
    where: { id: todoId },
    select: { id: true, conversationId: true, conversation: { select: { requesterUserId: true, supervisorUserId: true, status: true } } },
  });
  if (!todo) return { ok: false, error: "To-Do nicht gefunden." };
  if (!isParticipant(todo.conversation, caller.id, caller.role)) return { ok: false, error: "Keine Berechtigung." };
  if (todo.conversation.status === "ARCHIVED") return { ok: false, error: "Gespräch ist archiviert." };

  await prisma.oneOnOneConversationTodoItem.delete({ where: { id: todoId } });
  revalidatePath(REVALIDATE);
  return { ok: true };
}

// ─── Dashboard preview ────────────────────────────────────────────────────────

export async function getDashboardConversationPreview(userId: string): Promise<{
  myOpenCount: number;
  inboxCount: number;
  recentConversations: ConversationRow[];
}> {
  const [myOpenCount, inboxCount, recent] = await Promise.all([
    prisma.oneOnOneConversation.count({
      where: { requesterUserId: userId, status: "OPEN" },
    }),
    prisma.oneOnOneConversation.count({
      where: { supervisorUserId: userId, status: "OPEN" },
    }),
    prisma.oneOnOneConversation.findMany({
      where: {
        OR: [
          { requesterUserId: userId, status: "OPEN" },
          { supervisorUserId: userId, status: "OPEN" },
        ],
      },
      select: CONV_SELECT,
      orderBy: { updatedAt: "desc" },
      take: 3,
    }),
  ]);

  return {
    myOpenCount,
    inboxCount,
    recentConversations: recent as ConversationRow[],
  };
}
