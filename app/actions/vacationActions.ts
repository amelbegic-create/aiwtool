"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/access";
import { GOD_MODE_ROLES } from "@/lib/permissions";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";

/** Session user shape from next-auth (id from our callback). */
type SessionUser = { id?: string };

function yearFromISO(dateStr: string) {
  const y = Number(String(dateStr).slice(0, 4));
  return Number.isFinite(y) ? y : new Date().getFullYear();
}

function isGodModeRole(role: Role) {
  return GOD_MODE_ROLES.has(String(role));
}

async function resolveRestaurantIdForSessionUser(sessionUserId: string) {
  const cookieStore = await cookies();
  const activeRestaurantId = cookieStore.get("activeRestaurantId")?.value;

  if (activeRestaurantId && activeRestaurantId !== "all") return activeRestaurantId;

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    include: { restaurants: true },
  });

  const primary = user?.restaurants.find((r) => r.isPrimary)?.restaurantId;
  if (primary) return primary;

  const first = user?.restaurants[0]?.restaurantId;
  if (first) return first;

  const anyRest = await prisma.restaurant.findFirst({ select: { id: true } });
  if (!anyRest) throw new Error("Nema restorana u sistemu.");
  return anyRest.id;
}

// --- GLOBALNI EXPORT DATA ---
export async function getGlobalVacationStats(year: number) {
  await requirePermission("vacation:export");

  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;
  const prevYear = year - 1;
  const startPrev = `${prevYear}-01-01`;
  const endPrev = `${prevYear}-12-31`;

  const allUsers = await prisma.user.findMany({
    where: { isActive: true, role: { not: "SYSTEM_ARCHITECT" } },
    include: {
      department: { select: { name: true, color: true } },
      vacations: {
        where: {
          status: "APPROVED",
          start: { gte: startOfYear, lte: endOfYear },
        },
      },
      vacationAllowances: {
        where: { year: { in: [year, prevYear] } },
        select: { year: true, days: true, carriedOverDays: true },
      },
      restaurants: { include: { restaurant: true } },
    },
    orderBy: { name: "asc" },
  });

  const allRequestsRaw = await prisma.vacationRequest.findMany({
    where: {
      status: "APPROVED",
      start: { gte: startOfYear, lte: endOfYear },
    },
    include: { user: true },
  });

  const prevYearUsedByUser = await prisma.vacationRequest
    .groupBy({
      by: ["userId"],
      where: {
        status: "APPROVED",
        start: { gte: startPrev, lte: endPrev },
      },
      _sum: { days: true },
    })
    .then((rows) => new Map(rows.map((r) => [r.userId, r._sum.days ?? 0])));

  const usersStats = allUsers.map((u) => {
    const used = u.vacations.reduce((sum, v) => sum + v.days, 0);
    const restaurantNames = u.restaurants.map((r) => r.restaurant.name || "Nepoznat");
    const vaThis = u.vacationAllowances?.find((a) => a.year === year);
    const vaPrev = u.vacationAllowances?.find((a) => a.year === prevYear);
    const usedPrev = prevYearUsedByUser.get(u.id) ?? 0;

    let allowance: number;
    let carriedOver: number;
    if (vaThis) {
      allowance = vaThis.days ?? 0;
      carriedOver = vaThis.carriedOverDays ?? 0;
    } else {
      allowance = u.vacationEntitlement ?? 20;
      if (vaPrev) {
        const totalPrev = (vaPrev.days ?? 0) + (vaPrev.carriedOverDays ?? 0);
        carriedOver = Math.max(0, totalPrev - usedPrev);
      } else {
        carriedOver = u.vacationCarryover ?? 0;
      }
    }
    const total = allowance + carriedOver;
    const remaining = total - used;

    return {
      id: u.id,
      name: u.name,
      restaurantNames: restaurantNames,
      department: u.department?.name ?? null,
      departmentColor: u.department?.color ?? null,
      allowance,
      carriedOver,
      total,
      used,
      remaining,
    };
  });

  const allRequests = allRequestsRaw.map((req) => ({
    id: req.id,
    start: req.start,
    end: req.end,
    days: req.days,
    status: req.status,
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      mainRestaurant: "N/A",
    },
  }));

  return { usersStats, allRequests };
}

// --- BLOKIRANI DANI ---
export async function addBlockedDay(date: string, reason: string) {
  await requirePermission("vacation:blocked_days");

  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as SessionUser)?.id;
  if (!sessionUserId) throw new Error("Greška u sesiji.");

  const restaurantId = await resolveRestaurantIdForSessionUser(sessionUserId);

  await prisma.blockedDay.create({
    data: { date, reason, restaurantId },
  });

  revalidatePath("/tools/vacations");
}

export async function removeBlockedDay(id: string) {
  await requirePermission("vacation:blocked_days");
  await prisma.blockedDay.delete({ where: { id } });
  revalidatePath("/tools/vacations");
}

// --- UPRAVLJANJE ZAHTJEVIMA ---
async function calculateVacationDays(start: string, end: string, restaurantId: string | null) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const blockedDays = restaurantId
    ? await prisma.blockedDay.findMany({ where: { restaurantId } })
    : [];
  const blockedDates = blockedDays.map((b) => b.date);

  let totalDays = 0;
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    const dateString = currentDate.toISOString().split("T")[0];

    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !blockedDates.includes(dateString)) {
      totalDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return totalDays;
}

/** Live carry-over: za godinu Y koristi Base(Y) + max(0, Total(Y-1) - Used(Y-1)). Eksportovano za stranicu godišnjih. */
export async function getUserTotalForYear(userId: string, year: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      vacationEntitlement: true,
      vacationCarryover: true,
      vacationAllowances: {
        where: { year: { in: [year, year - 1] } },
        select: { year: true, days: true, carriedOverDays: true },
      },
    },
  });
  if (!user) throw new Error("Korisnik nije pronađen.");

  const vaThis = user.vacationAllowances?.find((a) => a.year === year);
  const vaPrev = user.vacationAllowances?.find((a) => a.year === year - 1);
  const usedPrev =
    vaPrev != null
      ? await getUsedApprovedDaysForYear(userId, year - 1)
      : 0;

  let allowance: number;
  let carryover: number;
  if (vaThis) {
    allowance =
      vaThis.days != null && Number.isFinite(Number(vaThis.days))
        ? Math.max(0, Math.floor(Number(vaThis.days)))
        : (user.vacationEntitlement ?? 20);
    carryover = Math.max(0, Math.floor(Number(vaThis.carriedOverDays) || 0));
  } else {
    allowance = user.vacationEntitlement ?? 20;
    if (vaPrev) {
      const totalPrev = (vaPrev.days ?? 0) + (vaPrev.carriedOverDays ?? 0);
      carryover = Math.max(0, totalPrev - usedPrev);
    } else {
      carryover = Math.max(0, Math.floor(Number(user.vacationCarryover) || 0));
    }
  }
  const total = allowance + carryover;
  return { total, allowance, carryover };
}

async function getUsedApprovedDaysForYear(userId: string, year: number) {
  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;
  const approved = await prisma.vacationRequest.findMany({
    where: {
      userId,
      status: "APPROVED",
      start: { gte: startOfYear, lte: endOfYear },
    },
    select: { days: true },
  });
  return approved.reduce((sum, r) => sum + r.days, 0);
}

/** Role koji mogu sami sebi odmah odobriti godišnji (self-service) – bez notifikacija. */
const SELF_SERVICE_VACATION_ROLES = new Set<Role>([
  Role.SYSTEM_ARCHITECT,
  Role.SUPER_ADMIN,
  Role.ADMIN,
]);

export async function createVacationRequest(data: {
  start: string;
  end: string;
  note?: string | null;
}) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as SessionUser)?.id;
  if (!sessionUserId) throw new Error("Niste prijavljeni.");

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true, supervisorId: true, isActive: true, role: true },
  });
  if (!user) throw new Error("Korisnik nije pronađen.");
  if (user.isActive === false) throw new Error("Korisnik nije aktivan.");

  // ✅ chain-of-command: za role 3-5 nadređeni mora postojati (osim self-service admina)
  if (!isGodModeRole(user.role as Role) && !user.supervisorId) {
    throw new Error("Nadređeni nije postavljen za vaš profil. Obratite se administratoru.");
  }

  const restaurantId = await resolveRestaurantIdForSessionUser(sessionUserId);

  // Zahtjev mora biti od sutra – ne može se uzeti od jučer ili danas
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const startDate = new Date(data.start);
  startDate.setHours(0, 0, 0, 0);
  if (startDate < tomorrow) {
    throw new Error("Početni datum mora biti sutra ili kasnije. Ne možete poslati zahtjev za prošle dane.");
  }

  const totalDays = await calculateVacationDays(data.start, data.end, restaurantId);
  if (totalDays === 0) throw new Error("Odabrani period nema radnih dana.");

  const year = yearFromISO(data.start);
  const { total } = await getUserTotalForYear(user.id, year);
  const used = await getUsedApprovedDaysForYear(user.id, year);
  const remaining = total - used;

  if (totalDays > remaining) {
    throw new Error(`Nemate dovoljno dana godišnjeg. Preostalo: ${remaining} dana.`);
  }

  // Self-service: SYSTEM_ARCHITECT / SUPER_ADMIN / ADMIN odmah APPROVED, bez notifikacija
  const isSelfServiceAdmin = SELF_SERVICE_VACATION_ROLES.has(user.role as Role);
  const status = isSelfServiceAdmin ? "APPROVED" : "PENDING";

  await prisma.vacationRequest.create({
    data: {
      userId: user.id,
      supervisorId: user.supervisorId || null,
      restaurantId,
      start: data.start,
      end: data.end,
      days: totalDays,
      status,
      note: data.note?.trim() || null,
    },
  });

  revalidatePath("/tools/vacations");
}

export async function updateVacationRequest(id: string, data: { start: string; end: string }) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as SessionUser)?.id;
  if (!sessionUserId) throw new Error("Niste prijavljeni.");

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true, supervisorId: true, role: true },
  });
  if (!user) throw new Error("Greška.");

  const request = await prisma.vacationRequest.findUnique({ where: { id } });
  if (!request) throw new Error("Zahtjev nije pronađen.");
  if (request.userId !== user.id) throw new Error("Nije vaš zahtjev.");
  if (request.status !== "PENDING") throw new Error("Možete uređivati samo zahtjev u statusu PENDING.");

  // Zahtjev mora biti od sutra – ne može se uzeti od jučer ili danas
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const startDate = new Date(data.start);
  startDate.setHours(0, 0, 0, 0);
  if (startDate < tomorrow) {
    throw new Error("Početni datum mora biti sutra ili kasnije. Ne možete poslati zahtjev za prošle dane.");
  }

  const restaurantId = request.restaurantId;

  const totalDays = await calculateVacationDays(data.start, data.end, restaurantId);
  if (totalDays === 0) throw new Error("Odabrani period nema radnih dana.");

  const year = yearFromISO(data.start);
  const { total } = await getUserTotalForYear(user.id, year);
  const used = await getUsedApprovedDaysForYear(user.id, year);
  const remaining = total - used;

  if (totalDays > remaining) {
    throw new Error(`Nemate dovoljno dana godišnjeg. Preostalo: ${remaining} dana.`);
  }

  await prisma.vacationRequest.update({
    where: { id },
    data: {
      start: data.start,
      end: data.end,
      days: totalDays,
      status: "PENDING",
      supervisorId: user.supervisorId || null,
    },
  });

  revalidatePath("/tools/vacations");
}

const ALLOWED_STATUS_TRANSITIONS = new Set([
  "APPROVED",
  "REJECTED",
  "RETURNED",
  "CANCELLED",
  "PENDING", // Poništi odbijanje: vrati zahtjev na čekanju
]);

export async function updateVacationStatus(requestId: string, status: string) {
  await requirePermission("vacation:approve");

  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as SessionUser)?.id;
  if (!sessionUserId) throw new Error("Niste prijavljeni.");

  const actingUser = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: {
      id: true,
      role: true,
      restaurants: { select: { restaurantId: true } },
    },
  });
  if (!actingUser) throw new Error("Korisnik nije pronađen.");

  const req = await prisma.vacationRequest.findUnique({
    where: { id: requestId },
    select: {
      supervisorId: true,
      restaurantId: true,
      user: { select: { id: true, role: true } },
    },
  });
  if (!req) throw new Error("Zahtjev nije pronađen.");

  const god = isGodModeRole(actingUser.role);
  const isAdmin = actingUser.role === "ADMIN";

  if (!god && !isAdmin) {
    if (req.supervisorId !== actingUser.id) {
      throw new Error("Nemate pravo odobriti ovaj zahtjev. Obratite se administratoru.");
    }
    if (actingUser.role === "MANAGER") {
      const managerRestaurantIds = (actingUser.restaurants ?? []).map((r) => r.restaurantId);
      const requestRestaurantId = req.restaurantId;
      if (!requestRestaurantId || !managerRestaurantIds.includes(requestRestaurantId)) {
        throw new Error("Pristup odbijen: zahtjev je iz drugog restorana.");
      }
      if (req.user?.role !== "CREW") {
        throw new Error("Manager može odobravati samo zahtjeve radnika (Crew), ne drugih managera.");
      }
    }
  }

  if (!ALLOWED_STATUS_TRANSITIONS.has(status)) {
    throw new Error(`Nedozvoljen status: ${status}`);
  }

  await prisma.vacationRequest.update({
    where: { id: requestId },
    data: { status },
  });

  revalidatePath("/tools/vacations");
  revalidatePath("/");
}

export async function cancelVacationRequest(requestId: string) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as SessionUser)?.id;
  if (!sessionUserId) throw new Error("Niste prijavljeni.");

  const user = await prisma.user.findUnique({ where: { id: sessionUserId } });
  if (!user) throw new Error("Greška.");

  const request = await prisma.vacationRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error("Zahtjev nije pronađen.");
  if (request.userId !== user.id) throw new Error("Nije vaš zahtjev.");

  if (request.status === "PENDING") {
    await prisma.vacationRequest.delete({ where: { id: requestId } });
  } else if (request.status === "APPROVED") {
    await prisma.vacationRequest.update({
      where: { id: requestId },
      data: { status: "CANCEL_PENDING" },
    });
  } else {
    throw new Error("Ne možete otkazati ovaj zahtjev.");
  }

  revalidatePath("/tools/vacations");
}

export async function deleteVacationRequest(requestId: string) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as SessionUser)?.id;
  if (!sessionUserId) throw new Error("Niste prijavljeni.");

  const user = await prisma.user.findUnique({ where: { id: sessionUserId } });
  if (!user) throw new Error("Greška.");

  const request = await prisma.vacationRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error("Zahtjev ne postoji.");

  const isAdminLike = ["ADMIN", "SYSTEM_ARCHITECT", "SUPER_ADMIN", "MANAGER"].includes(String(user.role));
  if (!isAdminLike && request.userId !== user.id) throw new Error("Nije vaš zahtjev.");

  await prisma.vacationRequest.delete({ where: { id: requestId } });
  revalidatePath("/tools/vacations");
}
