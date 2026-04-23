"use server";

import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import { formatDateDDMMGGGG } from "@/lib/dateUtils";
import { hasPermission } from "@/lib/access";
import { GOD_MODE_ROLES } from "@/lib/permissions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { revalidatePath } from "next/cache";
import { CL_LOCK_ENABLED } from "@/lib/laborPlannerCl";

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
  | "user_idea_reply"
  | "cl_month_locked"
  | "cl_unlock_requested"
  | "worker_vacation_approved"
  | "worker_vacation_rejected"
  | "worker_vacation_returned"
  | "dashboard_news_new"
  | "dashboard_news_starts_tomorrow"
  | "dashboard_news_ends_tomorrow"
  | "dashboard_events_new"
  | "training_participant_feedback"
  | "training_participant_added"
  | "aushilfe_request"
  | "one_on_one_topic_created"
  | "one_on_one_topic_updated"
  | "one_on_one_meeting_scheduled";

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

async function resolveTrainingLarsUserId(): Promise<string | undefined> {
  const env = process.env.TRAINING_LARS_USER_ID?.trim();
  if (env) return env;
  const u = await prisma.user.findFirst({
    where: { email: "lars.hoffmann@aiw.at" },
    select: { id: true },
  });
  return u?.id;
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
  if (CL_LOCK_ENABLED) {
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

  // Antwort auf eingereichte Idee (für den Einreicher)
  const ideasWithReply = await prisma.idea.findMany({
    where: {
      userId,
      isArchived: false,
      adminReply: { not: null },
    },
    orderBy: { repliedAt: "desc" },
    take: 25,
    include: {
      repliedBy: { select: { name: true, image: true } },
    },
  });
  for (const idea of ideasWithReply) {
    const body = (idea.adminReply ?? "").trim();
    if (!body) continue;
    const snippet = body.replace(/\s+/g, " ");
    const preview = snippet.length > 120 ? `${snippet.slice(0, 120)}…` : snippet;
    const fromName = idea.repliedBy?.name ?? "Team";
    items.push({
      id: `idea-reply:${idea.id}`,
      kind: "user_idea_reply",
      title: "Antwort auf deine Idee",
      description: preview,
      href: "/dashboard/meine-ideen",
      createdAt: (idea.repliedAt ?? idea.createdAt).toISOString(),
      actorName: fromName,
      actorImage: idea.repliedBy?.image ?? null,
      actorInitials: initials(fromName),
    });
  }

  // Dashboard (News/Events) — poštedi sve korisnike: svatko dobije notifikaciju
  // za nove stavke koje su dodane u zadnjih 30 dana, dok ih ne označi kao pročitane.
  const sinceDash = new Date();
  sinceDash.setDate(sinceDash.getDate() - 30);
  const dashNews = await prisma.dashboardNewsItem.findMany({
    where: { isActive: true, notifyAll: true, createdAt: { gte: sinceDash } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, title: true, createdAt: true, startsAt: true, endsAt: true },
  });
  for (const n of dashNews) {
    items.push({
      id: `dash-news:${n.id}`,
      kind: "dashboard_news_new",
      title: "Neue Meldung",
      description: n.title,
      href: `/dashboard?openNews=${encodeURIComponent(n.id)}`,
      createdAt: n.createdAt.toISOString(),
      actorInitials: "N",
    });
  }

  // Dashboard News reminders (start tomorrow / end tomorrow)
  // This is computed on demand (in-app). Keys are stable per day; users can mark them read.
  const nowUtc = new Date();
  const today = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate(), 0, 0, 0, 0));
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const yyyyMmDd = (d: Date) => d.toISOString().slice(0, 10);
  const tomorrowKey = yyyyMmDd(tomorrow);

  for (const n of dashNews) {
    if (n.startsAt) {
      const startKey = yyyyMmDd(new Date(Date.UTC(n.startsAt.getUTCFullYear(), n.startsAt.getUTCMonth(), n.startsAt.getUTCDate())));
      if (startKey === tomorrowKey) {
        items.push({
          id: `dash-news-start:${n.id}:${tomorrowKey}`,
          kind: "dashboard_news_starts_tomorrow",
          title: "Promotion startet morgen",
          description: `„${n.title}“ ist ab morgen aktiv. Bitte Details im Dashboard ansehen.`,
          href: `/dashboard?openNews=${encodeURIComponent(n.id)}`,
          createdAt: today.toISOString(),
          actorInitials: "N",
        });
      }
    }
    if (n.endsAt) {
      const endKey = yyyyMmDd(new Date(Date.UTC(n.endsAt.getUTCFullYear(), n.endsAt.getUTCMonth(), n.endsAt.getUTCDate())));
      if (endKey === tomorrowKey) {
        items.push({
          id: `dash-news-end:${n.id}:${tomorrowKey}`,
          kind: "dashboard_news_ends_tomorrow",
          title: "Promotion endet morgen",
          description: `„${n.title}“ endet morgen. Bitte Details im Dashboard ansehen.`,
          href: `/dashboard?openNews=${encodeURIComponent(n.id)}`,
          createdAt: today.toISOString(),
          actorInitials: "N",
        });
      }
    }
  }

  const dashEvents = await prisma.dashboardEventItem.findMany({
    where: { isActive: true, createdAt: { gte: sinceDash } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, title: true, createdAt: true },
  });
  for (const ev of dashEvents) {
    items.push({
      id: `dash-event:${ev.id}`,
      kind: "dashboard_events_new",
      title: "Neues Event",
      description: ev.title,
      href: `/dashboard?openEvent=${encodeURIComponent(ev.id)}`,
      createdAt: ev.createdAt.toISOString(),
      actorInitials: "E",
    });
  }

  // Schulungen: Bewertung (Kommentar / %) — Vorgesetzter, Restaurant-Training-Admins, Lars, Bewerter
  const sinceTrain = new Date();
  sinceTrain.setDate(sinceTrain.getDate() - 14);
  const larsUid = await resolveTrainingLarsUserId();

  const managersRows = await prisma.restaurantUser.findMany({
    where: {
      user: {
        isActive: true,
        permissions: { has: "training:manage" },
      },
    },
    select: { userId: true, restaurantId: true },
  });
  const managersByRestaurant = new Map<string, Set<string>>();
  for (const m of managersRows) {
    let set = managersByRestaurant.get(m.restaurantId);
    if (!set) {
      set = new Set();
      managersByRestaurant.set(m.restaurantId, set);
    }
    set.add(m.userId);
  }

  const trainingFeedback = await prisma.trainingParticipant.findMany({
    where: { assessedAt: { gte: sinceTrain } },
    orderBy: { assessedAt: "desc" },
    take: 40,
    include: {
      user: { select: { id: true, name: true, supervisorId: true } },
      assessedBy: { select: { id: true, name: true } },
      session: {
        include: {
          program: {
            include: {
              restaurants: { include: { restaurant: { select: { id: true, name: true } } } },
            },
          },
        },
      },
    },
  });

  for (const row of trainingFeedback) {
    if (!row.assessedAt) continue;
    const recipientIds = new Set<string>();
    const sup = row.user?.supervisorId;
    if (sup) recipientIds.add(sup);
    if (larsUid) recipientIds.add(larsUid);
    if (row.assessedByUserId) recipientIds.add(row.assessedByUserId);
    for (const pr of row.session.program.restaurants) {
      const set = managersByRestaurant.get(pr.restaurantId);
      if (set) {
        for (const uid of set) recipientIds.add(uid);
      }
    }

    if (!recipientIds.has(userId)) continue;

    const pname = row.user?.name ?? "Teilnehmer";
    const pct =
      row.resultPercent !== null && row.resultPercent !== undefined
        ? `${row.resultPercent} %`
        : "ohne %";
    const progTitle = row.session.program.title;
    const trainerName = row.assessedBy?.name ?? "Trainer";
    const firstRestName = row.session.program.restaurants[0]?.restaurant?.name ?? null;
    items.push({
      id: `train-feedback:${row.id}:${row.assessedAt.toISOString()}`,
      kind: "training_participant_feedback",
      title: "Schulung: Bewertung",
      description: `${trainerName} hat ${pname} bewertet — ${progTitle} (${pct})`,
      href: "/admin/training",
      createdAt: row.assessedAt.toISOString(),
      actorName: pname,
      actorInitials: initials(pname),
      restaurantName: firstRestName,
    });
  }

  // Schulungen: Einladung — User bekommt Benachrichtigung wenn er als Teilnehmer hinzugefügt wird
  const sinceInvite = new Date();
  sinceInvite.setDate(sinceInvite.getDate() - 30);
  const addedParticipants = await prisma.trainingParticipant.findMany({
    where: { userId, createdAt: { gte: sinceInvite } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      session: {
        include: {
          program: { select: { title: true } },
        },
      },
    },
  });
  for (const p of addedParticipants) {
    items.push({
      id: `training-added:${p.id}`,
      kind: "training_participant_added",
      title: "Schulung: Einladung",
      description: `Du wurdest zur Schulung „${p.session.program.title}" eingeladen.`,
      href: "/training",
      createdAt: p.createdAt.toISOString(),
      actorInitials: "S",
    });
  }

  // Aushilfe: neue aktive Anfragen der letzten 7 Tage (für alle Manager/Admin)
  if (isAdmin || user.role === "MANAGER") {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    try {
      const recentHelpRequests = await prisma.helpRequest.findMany({
        where: { isArchived: false, createdAt: { gte: sevenDaysAgo } },
        include: {
          requestingRestaurant: { select: { name: true, code: true } },
          createdByUser: { select: { name: true, email: true, image: true } },
          positions: { select: { sectorLabel: true, neededSpots: true }, orderBy: { sortOrder: "asc" } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      });
      for (const hr of recentHelpRequests) {
        const rCode = (hr.requestingRestaurant.code ?? "").trim() || (hr.requestingRestaurant.name ?? "").trim();
        const restName = hr.requestingRestaurant.name ?? hr.requestingRestaurant.code;
        const requesterName = hr.createdByUser?.name?.trim() || hr.createdByUser?.email?.trim() || "Unbekannt";

        // Build a short preview of requested positions
        let positionPreview = "";
        if (hr.positions.length > 0) {
          const totalNeeded = hr.positions.reduce((s, p) => s + p.neededSpots, 0);
          const posSnippet = hr.positions
            .slice(0, 2)
            .map((p) => `${p.neededSpots}× ${p.sectorLabel}`)
            .join(", ");
          positionPreview = `${posSnippet}${hr.positions.length > 2 ? ` +${hr.positions.length - 2}` : ""} — ${totalNeeded} Person${totalNeeded !== 1 ? "en" : ""}`;
        } else {
          const n = hr.neededSpots;
          positionPreview = `${n} Person${n !== 1 ? "en" : ""}`;
        }

        items.push({
          id: `aushilfe:${hr.id}`,
          kind: "aushilfe_request",
          title: `Restaurant #${rCode} sucht Aushilfe`,
          description: `${requesterName}: ${positionPreview}`,
          href: `/tools/aushilfe?open=${hr.id}`,
          createdAt: hr.createdAt.toISOString(),
          restaurantName: restName,
          actorName: requesterName,
          actorImage: hr.createdByUser?.image,
          actorInitials: initials(hr.createdByUser?.name),
        });
      }
    } catch {
      // HelpRequest table might not exist yet in some environments — ignore
    }
  }

  // 1:1 Teme za razgovor: supervisor sees OPEN topics from subordinates
  try {
    const openTopicsForSupervisor = await prisma.oneOnOneTopic.findMany({
      where: {
        supervisorUserId: userId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        isArchivedBySupervisor: false,
      },
      include: {
        createdBy: { select: { name: true, email: true, image: true } },
      },
      orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
    });
    for (const topic of openTopicsForSupervisor) {
      const requesterName = topic.createdBy?.name?.trim() || topic.createdBy?.email?.trim() || "Unbekannt";
      items.push({
        id: `one-on-one-supervisor:${topic.id}`,
        kind: "one_on_one_topic_created",
        title: `Gesprächsthema von ${requesterName}`,
        description: `„${topic.title}"${topic.isUrgent ? " — DRINGEND" : ""}`,
        href: "/profile?tab=topics",
        createdAt: topic.createdAt.toISOString(),
        actorName: requesterName,
        actorImage: topic.createdBy?.image,
        actorInitials: initials(topic.createdBy?.name),
      });
    }

    // Requester sees when supervisor updates status or adds notes
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 14);
    const updatedTopics = await prisma.oneOnOneTopic.findMany({
      where: {
        createdByUserId: userId,
        status: { in: ["IN_PROGRESS", "DONE"] },
        isArchivedByRequester: false,
        updatedAt: { gte: sevenDaysAgo },
      },
      include: {
        supervisor: { select: { name: true, email: true, image: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    for (const topic of updatedTopics) {
      const supName = topic.supervisor?.name?.trim() || topic.supervisor?.email?.trim() || "Vorgesetzter";
      items.push({
        id: `one-on-one-requester:${topic.id}:${topic.updatedAt.toISOString()}`,
        kind: "one_on_one_topic_updated",
        title: `Thema aktualisiert von ${supName}`,
        description: `„${topic.title}" → ${topic.status === "DONE" ? "Erledigt" : "In Bearbeitung"}`,
        href: `/profile?tab=topics&open=${topic.id}`,
        createdAt: topic.updatedAt.toISOString(),
        actorName: supName,
        actorImage: topic.supervisor?.image,
        actorInitials: initials(topic.supervisor?.name),
      });
    }

    // Meeting scheduled notifications — shown to BOTH participants
    const sevenDaysAhead = new Date();
    sevenDaysAhead.setDate(sevenDaysAhead.getDate() + 14);
    const scheduledTopics = await (prisma.oneOnOneTopic as any).findMany({
      where: {
        OR: [
          { createdByUserId: userId, isArchivedByRequester: false },
          { supervisorUserId: userId, isArchivedBySupervisor: false },
        ],
        meetingStartsAt: { not: null, lte: sevenDaysAhead },
      },
      include: {
        createdBy: { select: { name: true, email: true, image: true } },
        supervisor: { select: { name: true, email: true, image: true } },
      },
      orderBy: { meetingStartsAt: "asc" },
    }).catch(() => []);
    for (const topic of scheduledTopics as any[]) {
      if (!topic.meetingStartsAt) continue;
      const meetDate = new Date(topic.meetingStartsAt);
      const dateStr = meetDate.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
      const timeStr = meetDate.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
      const otherName = topic.supervisorUserId === userId
        ? (topic.createdBy?.name?.trim() || topic.createdBy?.email?.trim() || "Unbekannt")
        : (topic.supervisor?.name?.trim() || topic.supervisor?.email?.trim() || "Vorgesetzter");
      const otherImage = topic.supervisorUserId === userId ? topic.createdBy?.image : topic.supervisor?.image;
      items.push({
        id: `one-on-one-meeting:${topic.id}:${topic.meetingStartsAt}`,
        kind: "one_on_one_meeting_scheduled" as any,
        title: `Termin: ${topic.title}`,
        description: `${dateStr} um ${timeStr}${topic.meetingLocation ? ` · ${topic.meetingLocation}` : ""}`,
        href: `/profile?tab=topics&open=${topic.id}`,
        createdAt: topic.updatedAt.toISOString(),
        actorName: otherName,
        actorImage: otherImage,
        actorInitials: initials(otherName),
      });
    }
  } catch {
    // Ignore if table not yet available
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
  revalidatePath("/admin/training");
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
