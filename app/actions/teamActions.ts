"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { GOD_MODE_ROLES } from "@/lib/permissions";
import { stealthArchitectWhere } from "@/lib/userVisibility";
import { computeCarryOverForYear, VACATION_YEAR_MIN } from "@/lib/vacationCarryover";

/** Ghost/Test: global-scope uloge vide sve aktivne korisnike kao "svoj tim" (uz stealth za arhitekta). */
function isGodModeRole(role: string) {
  return GOD_MODE_ROLES.has(String(role));
}

const today = new Date();
const todayStr = today.toISOString().slice(0, 10);
const currentYear = today.getFullYear();
const startOfYear = `${currentYear}-01-01`;
const endOfYear = `${currentYear}-12-31`;

export type TeamMemberRow = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  department: string | null;
  departmentColor: string | null;
  isOnVacationToday: boolean;
  vacationUsed: number;
  vacationTotal: number;
  vacationRemaining: number;
  lastPdsScore: number | null;
  lastPdsGrade: string | null;
  lastPdsYear: number | null;
  lastPdsId: string | null;
  /** Optional: set when DB has orgChartSubtitle column */
  orgChartSubtitle?: string | null;
  restaurants: { code: string; name: string | null }[];
};

export type TeamMemberRowWithSupervisor = TeamMemberRow & { supervisorId: string | null };

export type TeamMemberDetail = TeamMemberRow & {
  vacationRequests: {
    id: string;
    start: string;
    end: string;
    days: number;
    status: string;
  }[];
  pdsHistory: {
    id: string;
    year: number;
    totalScore: number;
    finalGrade: string | null;
    status: string;
  }[];
  certificates: {
    id: string;
    title: string;
    description: string;
    pdfUrl: string | null;
    pdfName: string | null;
    imageUrl: string | null;
    imageName: string | null;
    createdAt: Date;
  }[];
};

export async function getMyTeamData(): Promise<TeamMemberRow[]> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return [];

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  const seeAllAsTeam = dbUser && isGodModeRole(dbUser.role);

  const rangeStart = `${VACATION_YEAR_MIN}-01-01`;
  const rangeEnd = endOfYear;

  const teamMemberInclude = {
    department: { select: { name: true, color: true } },
    restaurants: { select: { restaurant: { select: { code: true, name: true } } } },
    vacations: {
      where: {
        status: "APPROVED",
        start: { lte: endOfYear },
        end: { gte: startOfYear },
      },
      select: { start: true, end: true, days: true },
    },
    vacationAllowances: {
      where: { year: { gte: VACATION_YEAR_MIN, lte: currentYear } },
      select: { year: true, days: true },
    },
    pdsList: {
      orderBy: { year: "desc" } as const,
      take: 1,
      select: { id: true, year: true, totalScore: true, finalGrade: true, status: true },
    },
  };

  const subordinates = await prisma.user.findMany({
    where: seeAllAsTeam
      ? { isActive: true, ...stealthArchitectWhere(dbUser.role) }
      : { supervisorId: userId, isActive: true },
    include: teamMemberInclude,
    orderBy: { name: "asc" },
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
        if (y >= VACATION_YEAR_MIN && y <= currentYear) {
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

  const mapUserToTeamRow = (
    u: (typeof subordinates)[number]
  ): TeamMemberRow => {
    const used = u.vacations.reduce((sum, v) => sum + v.days, 0);
    const allowancesByYear = new Map<number, { days: number }>();
    for (const a of u.vacationAllowances ?? []) {
      allowancesByYear.set(a.year, { days: Math.max(0, a.days ?? 0) });
    }
    const usedByYear = usedByUserByYear.get(u.id) ?? new Map<number, number>();
    const defaultAllowance = u.vacationEntitlement ?? 20;
    const defaultCarryover = Math.max(0, Math.floor(Number(u.vacationCarryover) ?? 0));
    const { total } = computeCarryOverForYear(
      allowancesByYear,
      usedByYear,
      defaultAllowance,
      defaultCarryover,
      currentYear
    );
    const remaining = Math.max(0, total - used);

    const isOnVacationToday = u.vacations.some(
      (v) => todayStr >= v.start && todayStr <= v.end
    );

    const lastPds = u.pdsList[0];
    const lastPdsScore = lastPds ? lastPds.totalScore : null;
    const lastPdsGrade = lastPds?.finalGrade ?? null;
    const lastPdsYear = lastPds?.year ?? null;
    const lastPdsId = lastPds?.id ?? null;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: u.role,
      department: u.department?.name ?? null,
      departmentColor: u.department?.color ?? null,
      isOnVacationToday,
      vacationUsed: used,
      vacationTotal: total,
      vacationRemaining: remaining,
      lastPdsScore: lastPdsScore ?? null,
      lastPdsGrade,
      lastPdsYear,
      lastPdsId,
      restaurants: (u.restaurants ?? []).map((r) => ({ code: r.restaurant.code, name: r.restaurant.name })),
    };
  };

  let rows = subordinates.map(mapUserToTeamRow);

  if (!seeAllAsTeam) {
    // Šef / supervisor vidi i sebe na vrhu (osim podređenih sortiranih po imenu).
    const me = await prisma.user.findFirst({
      where: { id: userId, isActive: true },
      include: teamMemberInclude,
    });
    if (me) {
      const selfRow = mapUserToTeamRow(me);
      rows = rows.filter((r) => r.id !== userId);
      rows = [selfRow, ...rows];
    }
  } else {
    const selfIdx = rows.findIndex((r) => r.id === userId);
    if (selfIdx > 0) {
      const [selfRow] = rows.splice(selfIdx, 1);
      rows.unshift(selfRow);
    }
  }

  return rows;
}

/** Placeholder: optional user subtitle. Returns ok so UI does not break. */
export async function updateOrgChartSubtitle(
  _userId: string,
  _subtitle: string | null
): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}

/**
 * Flat list of all active users with supervisorId (for tree view on Mein Team).
 */
export async function getTeamTreeData(): Promise<TeamMemberRowWithSupervisor[]> {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string })?.id;
  if (!sessionUserId) return [];

  const viewer = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { role: true },
  });

  const idsToFetch = await prisma.user.findMany({
    where: { isActive: true, ...stealthArchitectWhere(viewer?.role) },
    select: { id: true },
  }).then((rows) => rows.map((r) => r.id));

  const rangeStart = `${VACATION_YEAR_MIN}-01-01`;
  const rangeEnd = endOfYear;
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
        if (y >= VACATION_YEAR_MIN && y <= currentYear) {
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

  const users = await prisma.user.findMany({
    where: { id: { in: [...idsToFetch] } },
    include: {
      department: { select: { name: true, color: true } },
      vacations: {
        where: {
          status: "APPROVED",
          start: { lte: endOfYear },
          end: { gte: startOfYear },
        },
        select: { start: true, end: true, days: true },
      },
      vacationAllowances: {
        where: { year: { gte: VACATION_YEAR_MIN, lte: currentYear } },
        select: { year: true, days: true },
      },
      pdsList: {
        orderBy: { year: "desc" },
        take: 1,
        select: { id: true, year: true, totalScore: true, finalGrade: true, status: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return users.map((u) => {
    const used = u.vacations.reduce((sum, v) => sum + v.days, 0);
    const allowancesByYear = new Map<number, { days: number }>();
    for (const a of u.vacationAllowances ?? []) {
      allowancesByYear.set(a.year, { days: Math.max(0, a.days ?? 0) });
    }
    const usedByYear = usedByUserByYear.get(u.id) ?? new Map<number, number>();
    const defaultAllowance = u.vacationEntitlement ?? 20;
    const defaultCarryover = Math.max(0, Math.floor(Number(u.vacationCarryover) ?? 0));
    const { total } = computeCarryOverForYear(
      allowancesByYear,
      usedByYear,
      defaultAllowance,
      defaultCarryover,
      currentYear
    );
    const remaining = Math.max(0, total - used);
    const isOnVacationToday = u.vacations.some(
      (v) => todayStr >= v.start && todayStr <= v.end
    );
    const lastPds = u.pdsList[0];
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: u.role,
      department: u.department?.name ?? null,
      departmentColor: u.department?.color ?? null,
      isOnVacationToday,
      vacationUsed: used,
      vacationTotal: total,
      vacationRemaining: remaining,
      lastPdsScore: lastPds?.totalScore ?? null,
      lastPdsGrade: lastPds?.finalGrade ?? null,
      lastPdsYear: lastPds?.year ?? null,
      lastPdsId: lastPds?.id ?? null,
      restaurants: [],
      supervisorId: u.supervisorId,
    };
  });
}

export async function getTeamMemberDetail(userId: string): Promise<TeamMemberDetail | null> {
  const session = await getServerSession(authOptions);
  const currentUserId = (session?.user as { id?: string })?.id;
  if (!currentUserId) return null;

  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { role: true },
  });
  const canSeeAnyone = currentUser && isGodModeRole(currentUser.role);

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      ...stealthArchitectWhere(currentUser?.role),
      ...(canSeeAnyone
        ? {}
        : {
            OR: [{ supervisorId: currentUserId }, { id: currentUserId }],
          }),
    },
    include: {
      department: { select: { name: true, color: true } },
      vacations: {
        where: {
          status: "APPROVED",
          start: { lte: endOfYear },
          end: { gte: startOfYear },
        },
        select: { start: true, end: true, days: true },
      },
      vacationAllowances: {
        where: { year: { gte: VACATION_YEAR_MIN, lte: currentYear } },
        select: { year: true, days: true },
      },
      pdsList: {
        orderBy: { year: "desc" },
        select: { id: true, year: true, totalScore: true, finalGrade: true, status: true },
      },
      certificates: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          pdfUrl: true,
          pdfName: true,
          imageUrl: true,
          imageName: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) return null;

  const vacationRequests = await prisma.vacationRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, start: true, end: true, days: true, status: true },
  });

  const used = user.vacations.reduce((sum, v) => sum + v.days, 0);
  const rangeStart = `${VACATION_YEAR_MIN}-01-01`;
  const rangeEnd = endOfYear;
  const usedByYear = await prisma.vacationRequest
    .findMany({
      where: {
        userId: user.id,
        status: "APPROVED",
        start: { gte: rangeStart, lte: rangeEnd },
      },
      select: { start: true, days: true },
    })
    .then((rows) => {
      const map = new Map<number, number>();
      for (const r of rows) {
        const y = Number(String(r.start).slice(0, 4));
        if (y >= VACATION_YEAR_MIN && y <= currentYear) {
          map.set(y, (map.get(y) ?? 0) + r.days);
        }
      }
      return map;
    });
  const allowancesByYear = new Map<number, { days: number }>();
  for (const a of user.vacationAllowances ?? []) {
    allowancesByYear.set(a.year, { days: Math.max(0, a.days ?? 0) });
  }
  const defaultAllowance = user.vacationEntitlement ?? 20;
  const defaultCarryover = Math.max(0, Math.floor(Number(user.vacationCarryover) ?? 0));
  const { total } = computeCarryOverForYear(
    allowancesByYear,
    usedByYear,
    defaultAllowance,
    defaultCarryover,
    currentYear
  );
  const remaining = Math.max(0, total - used);
  const isOnVacationToday = user.vacations.some(
    (v) => todayStr >= v.start && todayStr <= v.end
  );
  const lastPds = user.pdsList[0];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    department: user.department?.name ?? null,
    departmentColor: user.department?.color ?? null,
    isOnVacationToday,
    vacationUsed: used,
    vacationTotal: total,
    vacationRemaining: remaining,
    lastPdsScore: lastPds?.totalScore ?? null,
    lastPdsGrade: lastPds?.finalGrade ?? null,
    lastPdsYear: lastPds?.year ?? null,
    lastPdsId: lastPds?.id ?? null,
    restaurants: [],
    vacationRequests: vacationRequests.map((r) => ({
      id: r.id,
      start: r.start,
      end: r.end,
      days: r.days,
      status: r.status,
    })),
    pdsHistory: user.pdsList.map((p) => ({
      id: p.id,
      year: p.year,
      totalScore: p.totalScore,
      finalGrade: p.finalGrade,
      status: p.status,
    })),
    certificates: user.certificates.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      pdfUrl: c.pdfUrl,
      pdfName: c.pdfName,
      imageUrl: c.imageUrl,
      imageName: c.imageName,
      createdAt: c.createdAt,
    })),
  };
}
