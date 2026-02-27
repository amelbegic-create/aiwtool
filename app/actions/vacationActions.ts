"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/access";
import { GOD_MODE_ROLES } from "@/lib/permissions";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { VACATION_YEAR_MIN, computeCarryOverForYear } from "@/lib/vacationCarryover";
import { IS_VACATION_ROLLOUT_PHASE, getEarliestAllowedVacationStart } from "@/lib/vacationConfig";

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
    select: { restaurants: { select: { restaurantId: true, isPrimary: true } } },
  });

  const primary = user?.restaurants.find((r) => r.isPrimary)?.restaurantId;
  if (primary) return primary;

  const first = user?.restaurants[0]?.restaurantId;
  if (first) return first;

  const anyRest = await prisma.restaurant.findFirst({ select: { id: true } });
  if (!anyRest) throw new Error("Kein Restaurant im System.");
  return anyRest.id;
}

// --- GLOBALNI EXPORT DATA ---
export async function getGlobalVacationStats(year: number) {
  await requirePermission("vacation:export");

  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;
  const rangeStart = `${VACATION_YEAR_MIN}-01-01`;
  const rangeEnd = `${year}-12-31`;

  const allUsers = await prisma.user.findMany({
    where: { isActive: true, role: { not: "SYSTEM_ARCHITECT" } },
    select: {
      id: true,
      name: true,
      vacationEntitlement: true,
      vacationCarryover: true,
      department: { select: { name: true, color: true } },
      vacations: {
        where: {
          status: "APPROVED",
          start: { gte: startOfYear, lte: endOfYear },
        },
        select: { days: true },
      },
      vacationAllowances: {
        where: { year: { gte: VACATION_YEAR_MIN, lte: year } },
        select: { year: true, days: true },
      },
      restaurants: { select: { restaurant: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });

  const allRequestsRaw = await prisma.vacationRequest.findMany({
    where: {
      status: "APPROVED",
      start: { gte: startOfYear, lte: endOfYear },
    },
    select: {
      id: true,
      start: true,
      end: true,
      days: true,
      status: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const usedByUserByYear = await prisma.vacationRequest
    .findMany({
      where: {
        status: "APPROVED",
        start: { gte: rangeStart, lte: rangeEnd },
      },
      select: { userId: true, start: true, days: true },
    })
    .then((rows) => {
      const map = new Map<string, Map<number, number>>();
      for (const r of rows) {
        const y = Number(String(r.start).slice(0, 4));
        if (y >= VACATION_YEAR_MIN && y <= year) {
          let userMap = map.get(r.userId);
          if (!userMap) {
            userMap = new Map();
            map.set(r.userId, userMap);
          }
          userMap.set(y, (userMap.get(y) ?? 0) + r.days);
        }
      }
      return map;
    });

  const usersStats = allUsers.map((u) => {
    const used = u.vacations.reduce((sum, v) => sum + v.days, 0);
    const restaurantNames = u.restaurants.map((r) => r.restaurant.name || "Nepoznat");
    const allowancesByYear = new Map<number, { days: number }>();
    for (const a of u.vacationAllowances ?? []) {
      allowancesByYear.set(a.year, { days: Math.max(0, a.days ?? 0) });
    }
    const usedByYear = usedByUserByYear.get(u.id) ?? new Map<number, number>();
    const defaultAllowance = u.vacationEntitlement ?? 20;
    const defaultCarryover = Math.max(0, Math.floor(Number(u.vacationCarryover) || 0));
    const { allowance, carriedOver, total } = computeCarryOverForYear(
      allowancesByYear,
      usedByYear,
      defaultAllowance,
      defaultCarryover,
      year
    );
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

/** Jedan korisnik: stat + svi zahtjevi (svi statusi) za godinu – za report/[userId] stranicu. */
export async function getVacationReportForUser(userId: string, year: number) {
  await requirePermission("vacation:access");

  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;
  const rangeStart = `${VACATION_YEAR_MIN}-01-01`;
  const rangeEnd = `${year}-12-31`;

  const [userRow, requestsRaw, usedByYearRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        vacationEntitlement: true,
        vacationCarryover: true,
        department: { select: { name: true, color: true } },
        vacations: {
          where: { status: "APPROVED", start: { gte: startOfYear, lte: endOfYear } },
          select: { days: true },
        },
        restaurants: { select: { restaurant: { select: { name: true } } } },
        vacationAllowances: {
          where: { year: { gte: VACATION_YEAR_MIN, lte: year } },
          select: { year: true, days: true },
        },
      },
    }),
    prisma.vacationRequest.findMany({
      where: { userId, start: { gte: startOfYear, lte: endOfYear } },
      select: {
        id: true,
        start: true,
        end: true,
        days: true,
        status: true,
        restaurant: { select: { name: true } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            restaurants: { take: 1, select: { restaurant: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.vacationRequest.findMany({
      where: { userId, status: "APPROVED", start: { gte: rangeStart, lte: rangeEnd } },
      select: { start: true, days: true },
    }),
  ]);

  if (!userRow) return null;

  const usedByYear = new Map<number, number>();
  for (const r of usedByYearRows) {
    const y = Number(String(r.start).slice(0, 4));
    if (y >= VACATION_YEAR_MIN && y <= year) {
      usedByYear.set(y, (usedByYear.get(y) ?? 0) + r.days);
    }
  }
  const allowancesByYear = new Map<number, { days: number }>();
  for (const a of userRow.vacationAllowances ?? []) {
    const d = a.days != null && Number.isFinite(Number(a.days)) ? Math.max(0, Math.floor(Number(a.days))) : 0;
    allowancesByYear.set(a.year, { days: d });
  }
  const defaultAllowance = userRow.vacationEntitlement ?? 20;
  const defaultCarryover = Math.max(0, Math.floor(Number(userRow.vacationCarryover) ?? 0));
  const { total, carriedOver } = computeCarryOverForYear(
    allowancesByYear,
    usedByYear,
    defaultAllowance,
    defaultCarryover,
    year
  );
  const used = userRow.vacations.reduce((sum, v) => sum + v.days, 0);
  const userStat = {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    restaurantNames: userRow.restaurants.map((r) => r.restaurant.name || "Unbekannt"),
    department: userRow.department?.name ?? null,
    departmentColor: userRow.department?.color ?? null,
    carriedOver,
    total,
    used,
    remaining: total - used,
  };

  const requests = requestsRaw.map((req) => ({
    id: req.id,
    start: req.start,
    end: req.end,
    days: req.days,
    status: req.status,
    restaurantName: req.restaurant?.name ?? req.user.restaurants[0]?.restaurant.name ?? "–",
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      mainRestaurant: req.restaurant?.name ?? req.user.restaurants[0]?.restaurant.name ?? "N/A",
    },
  }));

  return { userStat, requests };
}

/** Dohvat podataka za admin view (tablica, plan) – koristi glavna stranica i view/table, view/plan. */
export async function getVacationAdminData(
  selectedYear: number,
  activeRestaurantId: string | undefined,
  sessionUserId: string
) {
  await requirePermission("vacation:access");

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true, role: true, restaurants: { select: { restaurantId: true } } },
  });
  if (!user) throw new Error("Benutzer nicht gefunden.");

  const isGodMode = isGodModeRole(user.role as Role);
  const startOfYear = `${selectedYear}-01-01`;
  const endOfYear = `${selectedYear}-12-31`;
  const rangeStart = `${VACATION_YEAR_MIN}-01-01`;
  const rangeEnd = `${selectedYear}-12-31`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userWhereClause: any = { isActive: true, role: { not: "SYSTEM_ARCHITECT" } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestWhereClause: any = { start: { gte: startOfYear, lte: endOfYear } };

  if (activeRestaurantId && activeRestaurantId !== "all") {
    userWhereClause.restaurants = { some: { restaurantId: activeRestaurantId } };
    requestWhereClause.user = { restaurants: { some: { restaurantId: activeRestaurantId } } };
  } else if (!isGodMode) {
    const myRestaurantIds = user.restaurants.map((r) => r.restaurantId);
    userWhereClause.restaurants = { some: { restaurantId: { in: myRestaurantIds } } };
    requestWhereClause.user = { restaurants: { some: { restaurantId: { in: myRestaurantIds } } } };
  }

  const blockedDaysWhere =
    activeRestaurantId && activeRestaurantId !== "all" ? { restaurantId: activeRestaurantId } : undefined;

  const [blockedDaysRaw, allRequestsRaw, allUsers, usedByUserByYearRows, reportRestaurantResult] = await Promise.all([
    prisma.blockedDay.findMany({
      where: blockedDaysWhere,
      orderBy: { date: "asc" },
    }),
    prisma.vacationRequest.findMany({
      where: requestWhereClause,
      select: {
        id: true,
        start: true,
        end: true,
        days: true,
        status: true,
        restaurant: { select: { name: true } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            restaurants: { take: 1, select: { restaurant: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: userWhereClause,
      select: {
        id: true,
        name: true,
        vacationEntitlement: true,
        vacationCarryover: true,
        department: { select: { name: true, color: true } },
        vacations: {
          where: { status: "APPROVED", start: { gte: startOfYear, lte: endOfYear } },
          select: { days: true },
        },
        restaurants: { select: { restaurantId: true, restaurant: { select: { name: true } } } },
        vacationAllowances: {
          where: { year: { gte: VACATION_YEAR_MIN, lte: selectedYear } },
          select: { year: true, days: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.vacationRequest.findMany({
      where: { status: "APPROVED", start: { gte: rangeStart, lte: rangeEnd } },
      select: { userId: true, start: true, days: true },
    }),
    activeRestaurantId && activeRestaurantId !== "all"
      ? prisma.restaurant.findUnique({ where: { id: activeRestaurantId }, select: { name: true } })
      : Promise.resolve(null),
  ]);

  const blockedDays = blockedDaysRaw.map((d) => ({ id: d.id, date: d.date, reason: d.reason }));

  const usedByUserByYear = new Map<string, Map<number, number>>();
  for (const row of usedByUserByYearRows) {
    const y = Number(String(row.start).slice(0, 4));
    if (y >= VACATION_YEAR_MIN && y <= selectedYear) {
      let userMap = usedByUserByYear.get(row.userId);
      if (!userMap) {
        userMap = new Map();
        usedByUserByYear.set(row.userId, userMap);
      }
      userMap.set(y, (userMap.get(y) ?? 0) + row.days);
    }
  }

  const allRequests = allRequestsRaw.map((req) => ({
    id: req.id,
    start: req.start,
    end: req.end,
    days: req.days,
    status: req.status,
    restaurantName: req.restaurant?.name ?? req.user.restaurants[0]?.restaurant.name ?? "–",
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      mainRestaurant: req.restaurant?.name ?? req.user.restaurants[0]?.restaurant.name ?? "N/A",
    },
  }));

  const usersStats = allUsers.map((u) => {
    const used = u.vacations.reduce((sum, v) => sum + v.days, 0);
    const restaurantNames = u.restaurants.map((r) => r.restaurant.name || "Unbekannt");
    const allowancesByYear = new Map<number, { days: number }>();
    for (const a of u.vacationAllowances ?? []) {
      const d = a.days != null && Number.isFinite(Number(a.days)) ? Math.max(0, Math.floor(Number(a.days))) : 0;
      allowancesByYear.set(a.year, { days: d });
    }
    const usedByYear = usedByUserByYear.get(u.id) ?? new Map<number, number>();
    const defaultAllowance = u.vacationEntitlement ?? 20;
    const defaultCarryover = Math.max(0, Math.floor(Number(u.vacationCarryover) ?? 0));
    const { allowance, carriedOver, total } = computeCarryOverForYear(
      allowancesByYear,
      usedByYear,
      defaultAllowance,
      defaultCarryover,
      selectedYear
    );
    return {
      id: u.id,
      name: u.name,
      restaurantNames,
      department: u.department?.name ?? null,
      departmentColor: u.department?.color ?? null,
      carriedOver,
      total,
      used,
      remaining: total - used,
    };
  });

  const reportRestaurantLabel =
    reportRestaurantResult?.name ??
    (activeRestaurantId && activeRestaurantId !== "all" ? `Restaurant ${activeRestaurantId}` : "Alle Restaurants");

  return { usersStats, allRequests, blockedDays, reportRestaurantLabel };
}

// --- BLOKIRANI DANI ---
export async function addBlockedDay(date: string, reason: string) {
  await requirePermission("vacation:blocked_days");

  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as SessionUser)?.id;
  if (!sessionUserId) throw new Error("Sitzungsfehler.");

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

/** Višegodišnji prenos: za godinu Y koristi Base(Y) + preostalo iz svih godina od VACATION_YEAR_MIN do Y-1. */
export async function getUserTotalForYear(userId: string, year: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      vacationEntitlement: true,
      vacationCarryover: true,
      vacationAllowances: {
        where: { year: { gte: VACATION_YEAR_MIN, lte: year } },
        select: { year: true, days: true },
      },
    },
  });
  if (!user) throw new Error("Benutzer nicht gefunden.");

  const allowancesByYear = new Map<number, { days: number }>();
  for (const a of user.vacationAllowances ?? []) {
    const d = a.days != null && Number.isFinite(Number(a.days)) ? Math.max(0, Math.floor(Number(a.days))) : 0;
    allowancesByYear.set(a.year, { days: d });
  }
  const usedByYear = await getUsedByYearForUser(userId, VACATION_YEAR_MIN, year);
  const defaultAllowance = user.vacationEntitlement ?? 20;
  const defaultCarryover = Math.max(0, Math.floor(Number(user.vacationCarryover) || 0));

  const result = computeCarryOverForYear(
    allowancesByYear,
    usedByYear,
    defaultAllowance,
    defaultCarryover,
    year
  );
  return { total: result.total, allowance: result.allowance, carryover: result.carriedOver };
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

/** Vraća Map<year, usedDays> za approved zahtjeve u rasponu [yearMin, yearMax]. */
async function getUsedByYearForUser(
  userId: string,
  yearMin: number,
  yearMax: number
): Promise<Map<number, number>> {
  const start = `${yearMin}-01-01`;
  const end = `${yearMax}-12-31`;
  const approved = await prisma.vacationRequest.findMany({
    where: {
      userId,
      status: "APPROVED",
      start: { gte: start, lte: end },
    },
    select: { start: true, days: true },
  });
  const byYear = new Map<number, number>();
  for (const r of approved) {
    const y = Number(String(r.start).slice(0, 4));
    if (y >= yearMin && y <= yearMax) {
      byYear.set(y, (byYear.get(y) ?? 0) + r.days);
    }
  }
  return byYear;
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
  if (!sessionUserId) throw new Error("Sie sind nicht angemeldet.");

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true, isActive: true, role: true },
  });
  if (!user) throw new Error("Benutzer nicht gefunden.");
  if (user.isActive === false) throw new Error("Benutzer ist nicht aktiv.");

  const restaurantId = await resolveRestaurantIdForSessionUser(sessionUserId);

  // Ograničenje unosa: rollout faza dozvoljava od 01.01. tekuće godine,
  // standardna faza dozvoljava max. 1 mjesec unazad.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const earliestAllowed = getEarliestAllowedVacationStart(today);
  const startDate = new Date(data.start);
  startDate.setHours(0, 0, 0, 0);

  if (startDate < earliestAllowed) {
    const formatted = earliestAllowed.toLocaleDateString("de-AT");
    if (IS_VACATION_ROLLOUT_PHASE) {
      throw new Error(
        `Im Rollout-Modus können Urlaubsanträge nur ab ${formatted} (01.01.${today.getFullYear()}) gestellt werden.`
      );
    }
    throw new Error(
      `Urlaubsanträge können höchstens 1 Monat rückwirkend gestellt werden (ab ${formatted}).`
    );
  }

  const totalDays = await calculateVacationDays(data.start, data.end, restaurantId);
  if (totalDays === 0) throw new Error("Im gewählten Zeitraum gibt es keine Arbeitstage.");

  const year = yearFromISO(data.start);
  const { total } = await getUserTotalForYear(user.id, year);
  const used = await getUsedApprovedDaysForYear(user.id, year);
  const remaining = total - used;

  if (totalDays > remaining) {
    throw new Error(`Nicht genügend Urlaubstage verfügbar. Verbleibend: ${remaining} Tage.`);
  }

  // Preklapanje: zabrani novi zahtjev ako već postoji odobren ili na čekanju za isti period
  const overlapping = await prisma.vacationRequest.findFirst({
    where: {
      userId: user.id,
      status: { in: ["APPROVED", "PENDING"] },
      start: { lte: data.end },
      end: { gte: data.start },
    },
  });
  if (overlapping) {
    throw new Error(
      "Für diesen Zeitraum existiert bereits ein genehmigter oder ausstehender Urlaubsantrag."
    );
  }

  // Self-service: SYSTEM_ARCHITECT / SUPER_ADMIN / ADMIN odmah APPROVED, bez notifikacija
  const isSelfServiceAdmin = SELF_SERVICE_VACATION_ROLES.has(user.role as Role);
  const status = isSelfServiceAdmin ? "APPROVED" : "PENDING";

  await prisma.vacationRequest.create({
    data: {
      userId: user.id,
      supervisorId: null,
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
  if (!sessionUserId) throw new Error("Sie sind nicht angemeldet.");

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true, role: true },
  });
  if (!user) throw new Error("Fehler.");

  const request = await prisma.vacationRequest.findUnique({ where: { id } });
  if (!request) throw new Error("Antrag nicht gefunden.");
  if (request.userId !== user.id) throw new Error("Das ist nicht Ihr Antrag.");
  if (request.status !== "PENDING") throw new Error("Nur Anträge mit Status „Ausstehend“ können bearbeitet werden.");

  // Ograničenje unosa: rollout faza dozvoljava od 01.01. tekuće godine,
  // standardna faza dozvoljava max. 1 mjesec unazad.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const earliestAllowed = getEarliestAllowedVacationStart(today);
  const startDate = new Date(data.start);
  startDate.setHours(0, 0, 0, 0);

  if (startDate < earliestAllowed) {
    const formatted = earliestAllowed.toLocaleDateString("de-AT");
    if (IS_VACATION_ROLLOUT_PHASE) {
      throw new Error(
        `Im Rollout-Modus können Urlaubsanträge nur ab ${formatted} (01.01.${today.getFullYear()}) gestellt werden.`
      );
    }
    throw new Error(
      `Urlaubsanträge können höchstens 1 Monat rückwirkend gestellt werden (ab ${formatted}).`
    );
  }

  const restaurantId = request.restaurantId;

  const totalDays = await calculateVacationDays(data.start, data.end, restaurantId);
  if (totalDays === 0) throw new Error("Im gewählten Zeitraum gibt es keine Arbeitstage.");

  const year = yearFromISO(data.start);
  const { total } = await getUserTotalForYear(user.id, year);
  const used = await getUsedApprovedDaysForYear(user.id, year);
  const remaining = total - used;

  if (totalDays > remaining) {
    throw new Error(`Nicht genügend Urlaubstage verfügbar. Verbleibend: ${remaining} Tage.`);
  }

  await prisma.vacationRequest.update({
    where: { id },
    data: {
      start: data.start,
      end: data.end,
      days: totalDays,
      status: "PENDING",
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
  if (!sessionUserId) throw new Error("Sie sind nicht angemeldet.");

  const actingUser = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: {
      id: true,
      role: true,
      restaurants: { select: { restaurantId: true } },
    },
  });
  if (!actingUser) throw new Error("Benutzer nicht gefunden.");

  const req = await prisma.vacationRequest.findUnique({
    where: { id: requestId },
    select: {
      supervisorId: true,
      restaurantId: true,
      user: { select: { id: true, role: true } },
    },
  });
  if (!req) throw new Error("Antrag nicht gefunden.");

  const god = isGodModeRole(actingUser.role);
  const isAdmin = actingUser.role === "ADMIN";

  if (!god && !isAdmin) {
    if (req.supervisorId != null && req.supervisorId !== actingUser.id) {
      throw new Error("Sie sind nicht berechtigt, diesen Antrag zu genehmigen. Bitte wenden Sie sich an den Administrator.");
    }
    if (actingUser.role === "MANAGER") {
      const managerRestaurantIds = (actingUser.restaurants ?? []).map((r) => r.restaurantId);
      const requestRestaurantId = req.restaurantId;
      if (!requestRestaurantId || !managerRestaurantIds.includes(requestRestaurantId)) {
        throw new Error("Zugriff verweigert: Der Antrag stammt von einem anderen Restaurant.");
      }
      if (req.user?.role !== "CREW") {
        throw new Error("Manager dürfen nur Anträge von Mitarbeitern (Crew) genehmigen, nicht von anderen Managern.");
      }
    }
  }

  if (!ALLOWED_STATUS_TRANSITIONS.has(status)) {
    throw new Error(`Ungültiger Status: ${status}`);
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
  if (!sessionUserId) throw new Error("Sie sind nicht angemeldet.");

  const user = await prisma.user.findUnique({ where: { id: sessionUserId } });
  if (!user) throw new Error("Fehler.");

  const request = await prisma.vacationRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error("Antrag nicht gefunden.");
  if (request.userId !== user.id) throw new Error("Das ist nicht Ihr Antrag.");

  if (request.status === "PENDING") {
    await prisma.vacationRequest.delete({ where: { id: requestId } });
  } else if (request.status === "APPROVED") {
    await prisma.vacationRequest.update({
      where: { id: requestId },
      data: { status: "CANCEL_PENDING" },
    });
  } else {
    throw new Error("Dieser Antrag kann nicht storniert werden.");
  }

  revalidatePath("/tools/vacations");
}

export async function deleteVacationRequest(requestId: string) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as SessionUser)?.id;
  if (!sessionUserId) throw new Error("Sie sind nicht angemeldet.");

  const user = await prisma.user.findUnique({ where: { id: sessionUserId } });
  if (!user) throw new Error("Fehler.");

  const request = await prisma.vacationRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error("Antrag existiert nicht.");

  const isAdminLike = ["ADMIN", "SYSTEM_ARCHITECT", "SUPER_ADMIN", "MANAGER"].includes(String(user.role));
  if (!isAdminLike && request.userId !== user.id) throw new Error("Das ist nicht Ihr Antrag.");

  await prisma.vacationRequest.delete({ where: { id: requestId } });
  revalidatePath("/tools/vacations");
}
