"use server";

import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

/** Stealth: SYSTEM_ARCHITECT se ne prikazuje u "Mom Timu". */
const STEALTH_ROLE_FILTER = { role: { not: Role.SYSTEM_ARCHITECT } };

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
};

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
};

export async function getMyTeamData(): Promise<TeamMemberRow[]> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return [];

  const subordinates = await prisma.user.findMany({
    where: { supervisorId: userId, isActive: true },
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
        where: { year: { in: [currentYear, currentYear - 1] } },
        select: { year: true, days: true, carriedOverDays: true },
      },
      pdsList: {
        orderBy: { year: "desc" },
        take: 1,
        select: { id: true, year: true, totalScore: true, finalGrade: true, status: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const prevYearUsed = await prisma.vacationRequest
    .groupBy({
      by: ["userId"],
      where: {
        status: "APPROVED",
        start: { gte: `${currentYear - 1}-01-01`, lte: `${currentYear - 1}-12-31` },
      },
      _sum: { days: true },
    })
    .then((rows) => new Map(rows.map((r) => [r.userId, r._sum.days ?? 0])));

  return subordinates.map((u) => {
    const used = u.vacations.reduce((sum, v) => sum + v.days, 0);
    const vaThis = u.vacationAllowances?.find((a) => a.year === currentYear);
    const vaPrev = u.vacationAllowances?.find((a) => a.year === currentYear - 1);
    const usedPrev = prevYearUsed.get(u.id) ?? 0;
    let total: number;
    if (vaThis) {
      total = (vaThis.days ?? 0) + (vaThis.carriedOverDays ?? 0);
    } else {
      const allowance = u.vacationEntitlement ?? 20;
      if (vaPrev) {
        const totalPrev = (vaPrev.days ?? 0) + (vaPrev.carriedOverDays ?? 0);
        total = allowance + Math.max(0, totalPrev - usedPrev);
      } else {
        total = allowance + (u.vacationCarryover ?? 0);
      }
    }
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
    };
  });
}

export async function getTeamMemberDetail(userId: string): Promise<TeamMemberDetail | null> {
  const session = await getServerSession(authOptions);
  const currentUserId = (session?.user as { id?: string })?.id;
  if (!currentUserId) return null;

  const user = await prisma.user.findFirst({
    where: { ...STEALTH_ROLE_FILTER, id: userId, supervisorId: currentUserId },
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
        where: { year: { in: [currentYear, currentYear - 1] } },
        select: { year: true, days: true, carriedOverDays: true },
      },
      pdsList: {
        orderBy: { year: "desc" },
        select: { id: true, year: true, totalScore: true, finalGrade: true, status: true },
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
  const vaThis = user.vacationAllowances?.find((a) => a.year === currentYear);
  const vaPrev = user.vacationAllowances?.find((a) => a.year === currentYear - 1);
  const usedPrev = (await prisma.vacationRequest.groupBy({
    by: ["userId"],
    where: {
      userId: user.id,
      status: "APPROVED",
      start: { gte: `${currentYear - 1}-01-01`, lte: `${currentYear - 1}-12-31` },
    },
    _sum: { days: true },
  }))[0]?._sum.days ?? 0;

  let total: number;
  if (vaThis) {
    total = (vaThis.days ?? 0) + (vaThis.carriedOverDays ?? 0);
  } else {
    const allowance = user.vacationEntitlement ?? 20;
    if (vaPrev) {
      const totalPrev = (vaPrev.days ?? 0) + (vaPrev.carriedOverDays ?? 0);
      total = allowance + Math.max(0, totalPrev - usedPrev);
    } else {
      total = allowance + (user.vacationCarryover ?? 0);
    }
  }
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
  };
}
