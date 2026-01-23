"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/access";

// --- GLOBALNI EXPORT DATA (NOVO) ---
export async function getGlobalVacationStats(year: number) {
  // Permisija za globalni export / globalni prikaz
  await requirePermission("vacation:export");

  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;

  const allUsers = await prisma.user.findMany({
    where: { isActive: true },
    include: {
      vacations: {
        where: {
          status: "APPROVED",
          start: { gte: startOfYear, lte: endOfYear },
        },
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

  const usersStats = allUsers.map((u) => {
    const used = u.vacations.reduce((sum, v) => sum + v.days, 0);
    const restaurantNames = u.restaurants.map((r) => r.restaurant.name || "Nepoznat");
    const total = (u.vacationEntitlement || 0) + (u.vacationCarryover || 0);

    return {
      id: u.id,
      name: u.name,
      restaurantNames: restaurantNames,
      department: u.department,
      total: total,
      used: used,
      remaining: total - used,
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
  const userEmail = session?.user?.email;
  if (!userEmail) throw new Error("Greška u sesiji.");

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: { restaurants: true },
  });

  const targetRestaurantId = user?.restaurants[0]?.restaurantId;
  let finalRestaurantId = targetRestaurantId;

  if (!finalRestaurantId) {
    const firstRest = await prisma.restaurant.findFirst();
    if (!firstRest) throw new Error("Nema restorana u sistemu.");
    finalRestaurantId = firstRest.id;
  }

  await prisma.blockedDay.create({
    data: { date, reason, restaurantId: finalRestaurantId! },
  });

  revalidatePath("/tools/vacations");
}

export async function removeBlockedDay(id: string) {
  await requirePermission("vacation:blocked_days");

  await prisma.blockedDay.delete({ where: { id } });
  revalidatePath("/tools/vacations");
}

// --- UPRAVLJANJE ZAHTJEVIMA ---
async function calculateVacationDays(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const blockedDays = await prisma.blockedDay.findMany();
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

export async function createVacationRequest(data: { start: string; end: string }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Niste prijavljeni.");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("Korisnik nije pronađen.");

  const totalDays = await calculateVacationDays(data.start, data.end);
  if (totalDays === 0) throw new Error("Odabrani period nema radnih dana.");

  await prisma.vacationRequest.create({
    data: {
      userId: user.id,
      start: data.start,
      end: data.end,
      days: totalDays,
      status: "PENDING",
    },
  });

  revalidatePath("/tools/vacations");
}

export async function updateVacationRequest(id: string, data: { start: string; end: string }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Niste prijavljeni.");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("Greška.");

  const request = await prisma.vacationRequest.findUnique({ where: { id } });
  if (!request) throw new Error("Zahtjev nije pronađen.");
  if (request.userId !== user.id) throw new Error("Nije vaš zahtjev.");

  const totalDays = await calculateVacationDays(data.start, data.end);
  if (totalDays === 0) throw new Error("Odabrani period nema radnih dana.");

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

export async function updateVacationStatus(requestId: string, status: string) {
  await requirePermission("vacation:approve");

  await prisma.vacationRequest.update({
    where: { id: requestId },
    data: { status },
  });

  revalidatePath("/tools/vacations");
}

export async function cancelVacationRequest(requestId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Niste prijavljeni.");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
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
  if (!session?.user?.email) throw new Error("Niste prijavljeni.");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("Greška.");

  const request = await prisma.vacationRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error("Zahtjev ne postoji.");

  // Ostavljam tvoju logiku: admini/manageri mogu brisati tuđe (kao prije)
  // Ako želiš strogo po permisijama kasnije: ovdje se doda requirePermission("vacation:approve") ili "vacation:access"
  const isAdminLike = ["ADMIN", "SYSTEM_ARCHITECT", "SUPER_ADMIN", "MANAGER"].includes(String(user.role));

  if (!isAdminLike && request.userId !== user.id) throw new Error("Nije vaš zahtjev.");

  await prisma.vacationRequest.delete({ where: { id: requestId } });
  revalidatePath("/tools/vacations");
}
