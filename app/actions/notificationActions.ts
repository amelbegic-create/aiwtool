"use server";

import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import { formatDateDDMMGGGG } from "@/lib/dateUtils";

export type NotificationKind =
  | "admin_vacation_pending"
  | "admin_vacation_storno"
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
}

const ADMIN_ROLES = new Set<Role>([
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.SYSTEM_ARCHITECT,
  Role.MANAGER,
]);

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

async function buildNotificationsForUser(userId: string): Promise<NotificationItem[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
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
        user: { select: { name: true, image: true } },
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
        href: `/tools/vacations?tab=requests&year=${currentYear}`,
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
        user: { select: { name: true, image: true } },
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
        href: `/tools/vacations?tab=requests&year=${currentYear}`,
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

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return items;
}

export async function getNotificationsForUser(userId: string) {
  const items = await buildNotificationsForUser(userId);
  return { items, count: items.length };
}

export async function getAllNotificationsForUser(userId: string) {
  return buildNotificationsForUser(userId);
}
