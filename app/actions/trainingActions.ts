"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/authOptions";
import { requirePermission } from "@/lib/access";

const GUEST_COOKIE = "mcd_training_guest";

const DEFAULT_TRAINING_TEMPLATES: Array<{
  slug: string;
  title: string;
  sortOrder: number;
  topics?: string | null;
  prerequisites?: string | null;
}> = [
  { slug: "crewtrainer-service", title: "Crewtrainer Service", sortOrder: 0 },
  { slug: "foodsafety-neu", title: "FoodSafety NEU", sortOrder: 1 },
  { slug: "crewtrainer-kueche", title: "Crewtrainer Küche", sortOrder: 2 },
  { slug: "crewtrainer-mccafe", title: "Crewtrainer McCafé", sortOrder: 3 },
  { slug: "teilschichtfuehrer-neu", title: "Teilschichtführer neu", sortOrder: 4 },
  { slug: "it-schulung", title: "IT-Schulung", sortOrder: 5 },
  { slug: "schichtfuehrer-neu", title: "Schichtführer neu", sortOrder: 6 },
  { slug: "qualitaet-brand-standards", title: "Qualität & Brand Standards", sortOrder: 7 },
  { slug: "individuell", title: "Individuell", sortOrder: 8, topics: null, prerequisites: null },
];

async function ensureTrainingTemplatesPrefilled(): Promise<void> {
  // Idempotent upsert by slug so production always has defaults.
  const existing = await prisma.trainingTemplate.count();
  if (existing >= DEFAULT_TRAINING_TEMPLATES.length) return;

  for (const t of DEFAULT_TRAINING_TEMPLATES) {
    await prisma.trainingTemplate.upsert({
      where: { slug: t.slug },
      create: {
        slug: t.slug,
        title: t.title,
        sortOrder: t.sortOrder,
        topics: t.topics ?? null,
        prerequisites: t.prerequisites ?? null,
      },
      update: {
        // Keep admin edits; only ensure it exists and keep a reasonable order.
        sortOrder: t.sortOrder,
      },
    });
  }
}

export type PublicTrainingParticipant = {
  id: string;
  displayName: string;
  /** Für „01. … (#156)“ */
  lineNo: string;
  badgeCode: string | null;
  courseComment: string | null;
  resultPercent: number | null;
  assessedAt: string | null;
  assessedByName: string | null;
};

export type PublicTrainingSession = {
  id: string;
  title: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  notes: string | null;
  participants: PublicTrainingParticipant[];
};

export type PublicTrainingProgram = {
  id: string;
  title: string;
  description: string | null;
  topics: string | null;
  prerequisites: string | null;
  scheduleMeta: string | null;
  restaurants: { code: string; name: string | null }[];
  sessions: PublicTrainingSession[];
};

function participantDisplayName(p: {
  firstName: string | null;
  lastName: string | null;
  user: { name: string | null; email: string | null } | null;
}): string {
  const fromUser = (p.user?.name ?? "").trim();
  if (fromUser) return fromUser;
  const parts = [p.firstName, p.lastName].map((x) => (x ?? "").trim()).filter(Boolean);
  if (parts.length) return parts.join(" ");
  const em = (p.user?.email ?? "").trim();
  if (em) return em;
  return "—";
}

function participantLineNo(displayOrder: number, fallBackIndex: number): string {
  const n = displayOrder > 0 ? displayOrder : fallBackIndex + 1;
  return String(n).padStart(2, "0");
}

async function canViewTrainingSchedule(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) return true;
  const jar = await cookies();
  return jar.get(GUEST_COOKIE)?.value === "1";
}

export async function getTrainingScheduleForPublicView(): Promise<
  { locked: true } | { locked: false; programs: PublicTrainingProgram[] }
> {
  if (!(await canViewTrainingSchedule())) {
    return { locked: true };
  }

  const rows = await prisma.trainingProgram.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      restaurants: { include: { restaurant: { select: { code: true, name: true } } } },
      sessions: {
        orderBy: { sortOrder: "asc" },
        include: {
          participants: {
            orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
            include: {
              user: { select: { name: true, email: true } },
              assessedBy: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const programs: PublicTrainingProgram[] = rows.map((prog) => ({
    id: prog.id,
    title: prog.title,
    description: prog.description,
    topics: prog.topics,
    prerequisites: prog.prerequisites,
    scheduleMeta: prog.scheduleMeta,
    restaurants: prog.restaurants.map((r) => ({ code: r.restaurant.code, name: r.restaurant.name })),
    sessions: prog.sessions.map((s) => ({
      id: s.id,
      title: s.title,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt ? s.endsAt.toISOString() : null,
      location: s.location,
      notes: s.notes,
      participants: s.participants.map((p, idx) => ({
        id: p.id,
        displayName: participantDisplayName(p),
        lineNo: participantLineNo(p.displayOrder, idx),
        badgeCode: p.badgeCode,
        courseComment: p.courseComment,
        resultPercent: p.resultPercent,
        assessedAt: p.assessedAt ? p.assessedAt.toISOString() : null,
        assessedByName: p.assessedBy?.name ?? null,
      })),
    })),
  }));

  return { locked: false, programs };
}

export type AdminTrainingParticipantRow = {
  id: string;
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
  userName: string | null;
  userEmail: string | null;
  displayOrder: number;
  badgeCode: string | null;
  courseComment: string | null;
  resultPercent: number | null;
  assessedAt: string | null;
  assessedByUserId: string | null;
  assessedByName: string | null;
};

export type AdminTrainingSessionRow = {
  id: string;
  title: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  notes: string | null;
  sortOrder: number;
  participants: AdminTrainingParticipantRow[];
};

export type AdminTrainingProgramRow = {
  id: string;
  title: string;
  description: string | null;
  topics: string | null;
  prerequisites: string | null;
  scheduleMeta: string | null;
  sortOrder: number;
  isActive: boolean;
  restaurants: { id: string; code: string; name: string | null }[];
  templateId: string | null;
  templateTitle: string | null;
  sessions: AdminTrainingSessionRow[];
};

export type TrainingTemplateOption = {
  id: string;
  slug: string;
  title: string;
  topics: string | null;
  prerequisites: string | null;
  sortOrder: number;
};

export type TrainingRestaurantOption = {
  id: string;
  code: string;
  name: string | null;
};

export async function listTrainingProgramsAdmin(): Promise<AdminTrainingProgramRow[]> {
  await requirePermission("training:manage");
  await ensureTrainingTemplatesPrefilled();
  const rows = await prisma.trainingProgram.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: {
      restaurants: { include: { restaurant: { select: { id: true, code: true, name: true } } } },
      template: { select: { id: true, title: true } },
      sessions: {
        orderBy: { sortOrder: "asc" },
        include: {
          participants: {
            orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
            include: {
              user: { select: { id: true, name: true, email: true } },
              assessedBy: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  return rows.map((prog) => ({
    id: prog.id,
    title: prog.title,
    description: prog.description,
    topics: prog.topics,
    prerequisites: prog.prerequisites,
    scheduleMeta: prog.scheduleMeta,
    sortOrder: prog.sortOrder,
    isActive: prog.isActive,
    restaurants: prog.restaurants.map((r) => ({
      id: r.restaurant.id,
      code: r.restaurant.code,
      name: r.restaurant.name,
    })),
    templateId: prog.templateId,
    templateTitle: prog.template?.title ?? null,
    sessions: prog.sessions.map((s) => ({
      id: s.id,
      title: s.title,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt ? s.endsAt.toISOString() : null,
      location: s.location,
      notes: s.notes,
      sortOrder: s.sortOrder,
      participants: s.participants.map((p) => ({
        id: p.id,
        userId: p.userId,
        firstName: p.firstName,
        lastName: p.lastName,
        userName: p.user?.name ?? null,
        userEmail: p.user?.email ?? null,
        displayOrder: p.displayOrder,
        badgeCode: p.badgeCode,
        courseComment: p.courseComment,
        resultPercent: p.resultPercent,
        assessedAt: p.assessedAt ? p.assessedAt.toISOString() : null,
        assessedByUserId: p.assessedByUserId,
        assessedByName: p.assessedBy?.name ?? null,
      })),
    })),
  }));
}

export async function listTrainingTemplates(): Promise<TrainingTemplateOption[]> {
  await requirePermission("training:manage");
  await ensureTrainingTemplatesPrefilled();
  const rows = await prisma.trainingTemplate.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: { id: true, slug: true, title: true, topics: true, prerequisites: true, sortOrder: true },
  });
  return rows;
}

export async function updateTrainingTemplate(
  id: string,
  data: { title?: string; topics?: string | null; prerequisites?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("training:manage");
    await prisma.trainingTemplate.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.topics !== undefined ? { topics: data.topics?.trim() || null } : {}),
        ...(data.prerequisites !== undefined ? { prerequisites: data.prerequisites?.trim() || null } : {}),
      },
    });
    revalidatePath("/admin/training");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}

export async function listRestaurantsForTrainingAdmin(): Promise<TrainingRestaurantOption[]> {
  await requirePermission("training:manage");
  const rows = await prisma.restaurant.findMany({
    where: { isActive: true },
    orderBy: [{ code: "asc" }],
    select: { id: true, code: true, name: true },
  });
  return rows;
}

export async function createTrainingProgram(data: {
  title: string;
  description?: string | null;
  topics?: string | null;
  prerequisites?: string | null;
  scheduleMeta?: string | null;
  restaurantIds?: string[];
  templateId?: string | null;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    await requirePermission("training:manage");
    const title = (data.title ?? "").trim();
    if (!title) return { ok: false, error: "Titel erforderlich." };
    const restaurantIds = (data.restaurantIds ?? []).filter((r) => r.trim());
    if (restaurantIds.length === 0) return { ok: false, error: "Mindestens ein Restaurant auswählen." };

    let topics = (data.topics ?? "").trim() || null;
    let prerequisites = (data.prerequisites ?? "").trim() || null;
    const templateId = (data.templateId ?? "").trim() || null;

    if (templateId) {
      const tmpl = await prisma.trainingTemplate.findUnique({ where: { id: templateId } });
      if (!tmpl) return { ok: false, error: "Vorlage nicht gefunden." };
      if (!topics) topics = tmpl.topics ?? null;
      if (!prerequisites) prerequisites = tmpl.prerequisites ?? null;
    }

    const created = await prisma.trainingProgram.create({
      data: {
        title,
        description: (data.description ?? "").trim() || null,
        topics,
        prerequisites,
        scheduleMeta: (data.scheduleMeta ?? "").trim() || null,
        sortOrder: (await prisma.trainingProgram.count()) + 1,
        templateId,
        restaurants: {
          create: restaurantIds.map((rid) => ({ restaurantId: rid })),
        },
      },
    });
    revalidatePath("/training");
    revalidatePath("/admin/training");
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}

export async function updateTrainingProgram(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    topics?: string | null;
    prerequisites?: string | null;
    scheduleMeta?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    restaurantIds?: string[];
    templateId?: string | null;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("training:manage");
    if (data.restaurantIds !== undefined && data.restaurantIds.length === 0) {
      return { ok: false, error: "Mindestens ein Restaurant auswählen." };
    }
    const templateId =
      data.templateId !== undefined ? ((data.templateId ?? "").trim() || null) : undefined;

    let topics = data.topics;
    let prerequisites = data.prerequisites;
    if (templateId !== undefined && templateId) {
      const tmpl = await prisma.trainingTemplate.findUnique({ where: { id: templateId } });
      if (!tmpl) return { ok: false, error: "Vorlage nicht gefunden." };
      if (topics !== undefined && !(topics ?? "").trim() && tmpl.topics) topics = tmpl.topics;
      if (prerequisites !== undefined && !(prerequisites ?? "").trim() && tmpl.prerequisites) {
        prerequisites = tmpl.prerequisites;
      }
    }

    await prisma.trainingProgram.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(topics !== undefined ? { topics: topics?.trim() || null } : {}),
        ...(prerequisites !== undefined ? { prerequisites: prerequisites?.trim() || null } : {}),
        ...(data.scheduleMeta !== undefined ? { scheduleMeta: data.scheduleMeta?.trim() || null } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(templateId !== undefined ? { templateId } : {}),
        ...(data.restaurantIds !== undefined
          ? {
              restaurants: {
                deleteMany: {},
                create: data.restaurantIds.map((rid) => ({ restaurantId: rid })),
              },
            }
          : {}),
      },
    });
    revalidatePath("/training");
    revalidatePath("/admin/training");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}

export async function deleteTrainingProgram(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("training:manage");
    await prisma.trainingProgram.delete({ where: { id } });
    revalidatePath("/training");
    revalidatePath("/admin/training");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}

export async function createTrainingSession(data: {
  programId: string;
  title?: string | null;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  notes?: string | null;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    await requirePermission("training:manage");
    const starts = new Date(data.startsAt);
    if (Number.isNaN(starts.getTime())) return { ok: false, error: "Ungültiges Startdatum." };
    let endsAt: Date | null = null;
    if (data.endsAt) {
      const e = new Date(data.endsAt);
      if (!Number.isNaN(e.getTime())) endsAt = e;
    }
    const count = await prisma.trainingSession.count({ where: { programId: data.programId } });
    const created = await prisma.trainingSession.create({
      data: {
        programId: data.programId,
        title: (data.title ?? "").trim() || null,
        startsAt: starts,
        endsAt,
        location: (data.location ?? "").trim() || null,
        notes: (data.notes ?? "").trim() || null,
        sortOrder: count + 1,
      },
    });
    revalidatePath("/training");
    revalidatePath("/admin/training");
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}

export async function updateTrainingSession(
  id: string,
  data: {
    title?: string | null;
    startsAt?: string;
    endsAt?: string | null;
    location?: string | null;
    notes?: string | null;
    sortOrder?: number;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("training:manage");
    const patch: {
      title?: string | null;
      startsAt?: Date;
      endsAt?: Date | null;
      location?: string | null;
      notes?: string | null;
      sortOrder?: number;
    } = {};
    if (data.title !== undefined) patch.title = (data.title ?? "").trim() || null;
    if (data.startsAt !== undefined) {
      const d = new Date(data.startsAt);
      if (Number.isNaN(d.getTime())) return { ok: false, error: "Ungültiges Startdatum." };
      patch.startsAt = d;
    }
    if (data.endsAt !== undefined) {
      if (!data.endsAt) patch.endsAt = null;
      else {
        const e = new Date(data.endsAt);
        if (Number.isNaN(e.getTime())) return { ok: false, error: "Ungültiges Enddatum." };
        patch.endsAt = e;
      }
    }
    if (data.location !== undefined) patch.location = (data.location ?? "").trim() || null;
    if (data.notes !== undefined) patch.notes = (data.notes ?? "").trim() || null;
    if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder;

    await prisma.trainingSession.update({ where: { id }, data: patch });
    revalidatePath("/training");
    revalidatePath("/admin/training");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}

export async function deleteTrainingSession(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("training:manage");
    await prisma.trainingSession.delete({ where: { id } });
    revalidatePath("/training");
    revalidatePath("/admin/training");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}

export async function addTrainingParticipant(data: {
  sessionId: string;
  userId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  badgeCode?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("training:manage");
    const uid = (data.userId ?? "").trim() || null;
    const fn = (data.firstName ?? "").trim() || null;
    const ln = (data.lastName ?? "").trim() || null;
    if (!uid && !fn && !ln) {
      return { ok: false, error: "Teilnehmer: Nutzer wählen oder Vor- und Nachname angeben." };
    }
    const agg = await prisma.trainingParticipant.aggregate({
      where: { sessionId: data.sessionId },
      _max: { displayOrder: true },
    });
    const nextOrder = (agg._max.displayOrder ?? 0) + 1;
    const badge = (data.badgeCode ?? "").trim() || null;
    await prisma.trainingParticipant.create({
      data: {
        sessionId: data.sessionId,
        userId: uid,
        firstName: fn,
        lastName: ln,
        displayOrder: nextOrder,
        badgeCode: badge,
      },
    });

    revalidatePath("/training");
    revalidatePath("/admin/training");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}

export async function updateTrainingParticipant(
  id: string,
  data: {
    userId?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    badgeCode?: string | null;
    displayOrder?: number;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("training:manage");
    const uid = data.userId !== undefined ? ((data.userId ?? "").trim() || null) : undefined;
    const fn = data.firstName !== undefined ? ((data.firstName ?? "").trim() || null) : undefined;
    const ln = data.lastName !== undefined ? ((data.lastName ?? "").trim() || null) : undefined;
    const badge = data.badgeCode !== undefined ? ((data.badgeCode ?? "").trim() || null) : undefined;
    const ord = data.displayOrder !== undefined ? data.displayOrder : undefined;
    await prisma.trainingParticipant.update({
      where: { id },
      data: {
        ...(uid !== undefined ? { userId: uid } : {}),
        ...(fn !== undefined ? { firstName: fn } : {}),
        ...(ln !== undefined ? { lastName: ln } : {}),
        ...(badge !== undefined ? { badgeCode: badge } : {}),
        ...(ord !== undefined ? { displayOrder: ord } : {}),
      },
    });
    revalidatePath("/training");
    revalidatePath("/admin/training");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}

export async function removeTrainingParticipant(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("training:manage");
    await prisma.trainingParticipant.delete({ where: { id } });
    revalidatePath("/training");
    revalidatePath("/admin/training");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}

export type TrainingUserSearchRow = { id: string; name: string | null; email: string | null };

export async function searchUsersForTraining(q: string): Promise<TrainingUserSearchRow[]> {
  await requirePermission("training:manage");
  const term = q.trim();
  if (term.length < 2) return [];
  const rows = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true },
    take: 25,
    orderBy: { name: "asc" },
  });
  return rows;
}

export async function saveParticipantAssessment(
  participantId: string,
  data: {
    courseComment: string | null;
    resultPercent: number | null;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const dbUser = await requirePermission("training:manage");
    const comment = (data.courseComment ?? "").trim();
    const raw = data.resultPercent;
    let resultPercent: number | null = null;
    if (raw !== null && raw !== undefined && String(raw).trim() !== "") {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 100) {
        return { ok: false, error: "Ergebnis muss eine ganze Zahl zwischen 0 und 100 sein." };
      }
      resultPercent = n;
    }
    if (!comment && resultPercent === null) {
      return { ok: false, error: "Kommentar und/oder Ergebnis % ausfüllen." };
    }

    await prisma.trainingParticipant.update({
      where: { id: participantId },
      data: {
        courseComment: comment || null,
        resultPercent,
        assessedByUserId: dbUser.id,
        assessedAt: new Date(),
      },
    });
    revalidatePath("/training");
    revalidatePath("/admin/training");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fehler." };
  }
}
