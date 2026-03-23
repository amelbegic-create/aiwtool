"use server";

import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import { formatDateDDMMGGGG } from "@/lib/dateUtils";
import { hasPermission } from "@/lib/access";
import { GOD_MODE_ROLES } from "@/lib/permissions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { revalidatePath } from "next/cache";

const NOTIF_KEY_MAX = 512;

function clampNotifKey(key: string): string {
  const s = String(key || "").trim();
  if (s.length <= NOTIF_KEY_MAX) return s;
  return s.slice(0, NOTIF_KEY_MAX);
}

export type NotificationKind =
  | "admin_vacation_pending"
  | "admin_vacation_storno"
  | "admin_idea_new"
  | "cl_month_locked"
  | "cl_unlock_requested"
  | "worker_vacation_approved"
  | "worker_vacation_rejected"
  | "worker_vacation_returned";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  /** Kratki bold naslov */
  title: string;
  /** Puni opis (može sadržavati HTML-bold kroz posebna polja) */
  description: string;
  href: string;
  createdAt: string; // ISO
  /** Ime osobe o kojoj se radi (radnik za admina, admin za radnika) */
  actorName?: string;
  /** URL slike profila */
  actorImage?: string | null;
  /** Inicijali za fallback avatar */
  actorInitials?: string;
  /** Naziv restorana */
  restaurantName?: string | null;
  /** Status zahtjeva (za radnika) */
  vacationStatus?: string;
  /** Raspon datuma godišnjeg */
  vacationDates?: string;
  /** Postavljeno u getAllNotificationsForUser */
  isRead?: boolean;
}

const ADMIN_ROLES = new Set<Role>([Role.ADMIN, Role.SYSTEM_ARCHITECT, Role.MANAGER]);

const VACATION_NOTIF_YEAR_MIN = 2025;
const VACATION_NOTIF_YEAR_MAX = 2030;

/** Deep link za Urlaub ANTRÄGE: godina iz starta, restoran, konkretan zahtjev. */
function vacationAdminRequestHref(params: {
  start: Date | string;
  requestId: string;
  restaurantId: string | null;
  workerFirstRestaurantId: string | null | undefined;
  fallbackYear: number;
}): string {
  const rawY = Number(String(params.start).slice(0, 4));
  const year = Number.isFinite(rawY)
    ? Math.min(VACATION_NOTIF_YEAR_MAX, Math.max(VACATION_NOTIF_YEAR_MIN, rawY))
    : params.fallbackYear;
  const restaurant =
    params.restaurantId ?? params.workerFirstRestaurantId ?? null;
  const q = new URLSearchParams({
    tab: "requests",
    year: String(year),
    requestId: params.requestId,
  });
  if (restaurant) q.set("restaurantId", restaurant);
  return `/tools/vacations?${q.toString()}`;
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

async function buildNotificationsForUser(userId: string): Promise<NotificationItem[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, permissions: true },
  });
  if (!user) return [];

  const isAdmin = ADMIN_ROLES.has(user.role as Role);
  const now = new Date();
  const currentYear = now.getFullYear();
  const items: NotificationItem[] = [];

  // Zahtjevi obrađeni u zadnjih 14 dana (i za admina i za radnika)
  const since = new Date();
  since.setDate(since.getDate() - 14);

  if (isAdmin) {
    // 1) PENDING zahtjevi: notifikacija samo nadređenom (supervisorId) – ni admin ni system arhitekt ne primaju sve, samo ako su oni nadređeni
    const pendingRequests = await prisma.vacationRequest.findMany({
      where: {
        status: "PENDING",
        userId: { not: userId },
        supervisorId: userId,
      },
      include: {
        user: {
          select: {
            name: true,
            image: true,
            restaurants: { take: 1, select: { restaurantId: true } },
          },
        },
        restaurant: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    for (const r of pendingRequests) {
      const workerName = r.user?.name ?? "Mitarbeiter";
      items.push({
        id: `vac-pending:${r.id}`,
        kind: "admin_vacation_pending",
        title: "Neuer Urlaubsantrag",
        description: `möchte Urlaub nehmen`,
        href: vacationAdminRequestHref({
          start: r.start,
          requestId: r.id,
          restaurantId: r.restaurantId,
          workerFirstRestaurantId: r.user?.restaurants?.[0]?.restaurantId,
          fallbackYear: currentYear,
        }),
        createdAt: r.createdAt.toISOString(),
        actorName: workerName,
        actorImage: r.user?.image ?? null,
        actorInitials: initials(workerName),
        restaurantName: r.restaurant?.name ?? null,
        vacationDates: `${formatDateDDMMGGGG(r.start)} – ${formatDateDDMMGGGG(r.end)}`,
      });
    }

    // 2) CANCEL_PENDING: samo nadređenom koji može odobriti storniranje
    const cancelRequests = await prisma.vacationRequest.findMany({
      where: {
        status: "CANCEL_PENDING",
        supervisorId: userId,
      },
      include: {
        user: {
          select: {
            name: true,
            image: true,
            restaurants: { take: 1, select: { restaurantId: true } },
          },
        },
        restaurant: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    for (const r of cancelRequests) {
      const workerName = r.user?.name ?? "Mitarbeiter";
      items.push({
        id: `vac-storno:${r.id}`,
        kind: "admin_vacation_storno",
        title: "Stornierung beantragt",
        description: `möchte Urlaub stornieren`,
        href: vacationAdminRequestHref({
          start: r.start,
          requestId: r.id,
          restaurantId: r.restaurantId,
          workerFirstRestaurantId: r.user?.restaurants?.[0]?.restaurantId,
          fallbackYear: currentYear,
        }),
        createdAt: (r.updatedAt ?? r.createdAt).toISOString(),
        actorName: workerName,
        actorImage: r.user?.image ?? null,
        actorInitials: initials(workerName),
        restaurantName: r.restaurant?.name ?? null,
        vacationDates: `${formatDateDDMMGGGG(r.start)} – ${formatDateDDMMGGGG(r.end)}`,
      });
    }

    // 3) Vlastiti obrađeni zahtjevi (admin je i radnik)
    const myProcessed = await prisma.vacationRequest.findMany({
      where: {
        userId,
        status: { in: ["APPROVED", "REJECTED", "RETURNED"] },
        updatedAt: { gte: since },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, updatedAt: true, status: true, start: true, end: true },
    });

    for (const r of myProcessed) {
      const kind: NotificationKind =
        r.status === "APPROVED" ? "worker_vacation_approved" :
        r.status === "REJECTED" ? "worker_vacation_rejected" : "worker_vacation_returned";
      items.push({
        id: `my-processed:${r.id}`,
        kind,
        title: "Ihr Urlaubsantrag",
        description:
          r.status === "APPROVED" ? "wurde genehmigt" :
          r.status === "REJECTED" ? "wurde abgelehnt" : "wurde zurückgesendet",
        href: "/tools/vacations",
        createdAt: r.updatedAt.toISOString(),
        vacationDates: `${formatDateDDMMGGGG(r.start)} – ${formatDateDDMMGGGG(r.end)}`,
        vacationStatus: r.status,
      });
    }
  } else {
    // RADNIK: jedan item po obrađenom zahtjevu (APPROVED / REJECTED / RETURNED)
    const processedVacations = await prisma.vacationRequest.findMany({
      where: {
        userId,
        status: { in: ["APPROVED", "REJECTED", "RETURNED"] },
        updatedAt: { gte: since },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, updatedAt: true, status: true, start: true, end: true },
    });

    for (const r of processedVacations) {
      const kind: NotificationKind =
        r.status === "APPROVED" ? "worker_vacation_approved" :
        r.status === "REJECTED" ? "worker_vacation_rejected" : "worker_vacation_returned";
      items.push({
        id: `processed:${r.id}`,
        kind,
        title: "Ihr Urlaubsantrag",
        description:
          r.status === "APPROVED" ? "wurde genehmigt" :
          r.status === "REJECTED" ? "wurde abgelehnt" : "wurde zurückgesendet",
        href: "/tools/vacations",
        createdAt: r.updatedAt.toISOString(),
        vacationDates: `${formatDateDDMMGGGG(r.start)} – ${formatDateDDMMGGGG(r.end)}`,
        vacationStatus: r.status,
      });
    }
  }

  // CL (Personaleinsatz): Monat gesperrt — Vorgesetzter des Sperrenden + God-Mode
  const sinceCl = new Date();
  sinceCl.setDate(sinceCl.getDate() - 14);
  const viewerIsGod = GOD_MODE_ROLES.has(String(user.role));

  const lockedClReports = await prisma.laborReport.findMany({
    where: {
      clLocked: true,
      clLockedAt: { gte: sinceCl },
    },
    orderBy: { clLockedAt: "desc" },
    take: 40,
    include: {
      restaurant: { select: { name: true } },
      clLockedByUser: { select: { name: true, supervisorId: true, image: true } },
    },
  });

  const MONTH_DE_SHORT = [
    "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
    "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
  ];

  for (const r of lockedClReports) {
    const supId = r.clLockedByUser?.supervisorId;
    if (!viewerIsGod && supId !== userId) continue;
    if (!r.clLockedAt) continue;
    const actorName = r.clLockedByUser?.name ?? "Mitarbeiter";
    const mLabel = MONTH_DE_SHORT[r.month - 1] ?? String(r.month);
    items.push({
      id: `cl-month-locked:${r.id}:${r.clLockedAt.toISOString()}`,
      kind: "cl_month_locked",
      title: "CL-Monat abgeschlossen",
      description: `hat Personaleinsatz ${mLabel} ${r.year} gesperrt (${r.restaurant.name ?? r.restaurantId}).`,
      href: `/tools/labor-planner?restaurantId=${encodeURIComponent(r.restaurantId)}&year=${r.year}&month=${r.month}`,
      createdAt: r.clLockedAt.toISOString(),
      actorName,
      actorImage: r.clLockedByUser?.image ?? null,
      actorInitials: initials(actorName),
      restaurantName: r.restaurant?.name ?? null,
    });
  }

  // CL: Entsperranfrage — Vorgesetzter des Antragstellers + God-Mode
  const unlockPending = await prisma.laborReport.findMany({
    where: {
      clLocked: true,
      clUnlockRequestedAt: { gte: sinceCl },
      clEditGrantUserId: null,
    },
    orderBy: { clUnlockRequestedAt: "desc" },
    take: 40,
    include: {
      restaurant: { select: { name: true } },
      clUnlockRequestedByUser: { select: { name: true, supervisorId: true, image: true } },
    },
  });

  for (const r of unlockPending) {
    const reqSup = r.clUnlockRequestedByUser?.supervisorId;
    if (!viewerIsGod && reqSup !== userId) continue;
    if (!r.clUnlockRequestedAt) continue;
    const actorName = r.clUnlockRequestedByUser?.name ?? "Mitarbeiter";
    const mLabel = MONTH_DE_SHORT[r.month - 1] ?? String(r.month);
    items.push({
      id: `cl-unlock-req:${r.id}:${r.clUnlockRequestedAt.toISOString()}`,
      kind: "cl_unlock_requested",
      title: "CL-Entsperranfrage",
      description: `möchte ${mLabel} ${r.year} bearbeiten (${r.restaurant.name ?? r.restaurantId}).`,
      href: `/tools/labor-planner?restaurantId=${encodeURIComponent(r.restaurantId)}&year=${r.year}&month=${r.month}&clApprove=1`,
      createdAt: r.clUnlockRequestedAt.toISOString(),
      actorName,
      actorImage: r.clUnlockRequestedByUser?.image ?? null,
      actorInitials: initials(actorName),
      restaurantName: r.restaurant?.name ?? null,
    });
  }

  // Ideenbox: nepročitane ideje za korisnike s ideenbox:access (npr. AL / System Architect)
  if (hasPermission(String(user.role), user.permissions || [], "ideenbox:access")) {
    const sinceIdeas = new Date();
    sinceIdeas.setDate(sinceIdeas.getDate() - 90);
    const unreadIdeas = await prisma.idea.findMany({
      where: {
        isRead: false,
        isArchived: false,
        userId: { not: userId },
        createdAt: { gte: sinceIdeas },
      },
      include: {
        user: { select: { name: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    for (const idea of unreadIdeas) {
      const submitterName = idea.user?.name ?? "Mitarbeiter";
      const snippet = idea.text.trim().replace(/\s+/g, " ");
      const preview =
        snippet.length > 120 ? `${snippet.slice(0, 120)}…` : snippet;
      items.push({
        id: `idea:${idea.id}`,
        kind: "admin_idea_new",
        title: "Neuer Ideenvorschlag",
        description: preview
          ? `hat einen Vorschlag eingereicht: ${preview}`
          : "hat einen Vorschlag in der Ideenbox eingereicht.",
        href: "/admin/ideenbox",
        createdAt: idea.createdAt.toISOString(),
        actorName: submitterName,
        actorImage: idea.user?.image ?? null,
        actorInitials: initials(submitterName),
      });
    }
  }

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return items;
}

async function getReadNotifKeySet(userId: string): Promise<Set<string>> {
  const rows = await prisma.notificationRead.findMany({
    where: { userId },
    select: { notifKey: true },
  });
  return new Set(rows.map((r) => r.notifKey));
}

/**
 * Snimi pročitane notifikacije u bazi (traje nakon odjave / drugog uređaja).
 */
export async function markNotificationsAsRead(notifKeys: string[]) {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) return { success: false as const, error: "Nicht angemeldet." };

  const keys = [...new Set(notifKeys.map(clampNotifKey).filter(Boolean))];
  if (keys.length === 0) return { success: true as const };

  await prisma.notificationRead.createMany({
    data: keys.map((notifKey) => ({ userId: uid, notifKey })),
    skipDuplicates: true,
  });

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/zahtjevi");
  return { success: true as const };
}

export async function getNotificationsForUser(userId: string) {
  const [items, readSet] = await Promise.all([
    buildNotificationsForUser(userId),
    getReadNotifKeySet(userId),
  ]);
  const unread = items.filter((i) => !readSet.has(i.id));
  return { items: unread, count: unread.length };
}

export async function getAllNotificationsForUser(userId: string): Promise<NotificationItem[]> {
  const [items, readSet] = await Promise.all([
    buildNotificationsForUser(userId),
    getReadNotifKeySet(userId),
  ]);
  return items.map((i) => ({ ...i, isRead: readSet.has(i.id) }));
}
