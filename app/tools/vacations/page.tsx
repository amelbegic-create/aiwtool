import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import UserView from "./_components/UserView";
import AdminView from "./_components/AdminView";

export default async function VacationPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  // FIX: Siguran pristup ID-u korisnika
  const sessionUserId = (session.user as { id: string }).id;

  // Dohvati korisnika i njegove restorane
  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    include: {
      restaurants: {
        include: { restaurant: true },
      },
    },
  });

  if (!user) {
    return (
      <div className="p-10 text-red-500 font-bold">
        Greška: Korisnik nije pronađen.
      </div>
    );
  }

  const isGodMode =
    user.role === Role.SYSTEM_ARCHITECT || user.role === Role.SUPER_ADMIN;
  const isManager = user.role === Role.ADMIN || user.role === Role.MANAGER;

  // Dohvati praznike (Globalno ili po restoranu - ovdje pojednostavljeno globalno za prikaz)
  const blockedDaysRaw = await prisma.blockedDay.findMany({
    orderBy: { date: "asc" },
  });

  const blockedDays = blockedDaysRaw.map((d) => ({
    id: d.id,
    date: d.date,
    reason: d.reason,
  }));

  // --- ADMIN / MANAGER POGLED ---
  if (isGodMode || isManager) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let userWhereClause: any = { isActive: true }; // Samo aktivni korisnici
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let requestWhereClause: any = {};

    // Ako nije Super Admin, vidi samo svoje restorane
    if (!isGodMode) {
      const myRestaurantIds = user.restaurants.map((r) => r.restaurantId);

      userWhereClause = {
        ...userWhereClause,
        restaurants: {
          some: { restaurantId: { in: myRestaurantIds } },
        },
      };

      requestWhereClause = {
        user: {
          restaurants: {
            some: { restaurantId: { in: myRestaurantIds } },
          },
        },
      };
    }

    // 1. Dohvati sve zahtjeve (za tablicu zahtjeva)
    const allRequestsRaw = await prisma.vacationRequest.findMany({
      where: requestWhereClause,
      include: {
        user: {
          include: {
            restaurants: { include: { restaurant: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const allRequests = allRequestsRaw.map((req) => ({
      id: req.id,
      start: req.start,
      end: req.end,
      days: req.days,
      status: req.status,
      user: {
        name: req.user.name,
        email: req.user.email,
        mainRestaurant: req.user.restaurants[0]?.restaurant.name || "N/A",
      },
    }));

    // 2. Dohvati statistiku za sve zaposlenike (za glavni dashboard)
    const allUsers = await prisma.user.findMany({
      where: userWhereClause,
      include: {
        vacations: { where: { status: "APPROVED" } }, // Samo odobreni se broje u iskorišteno
        restaurants: { include: { restaurant: true } },
      },
      orderBy: { name: "asc" },
    });

    const usersStats = allUsers.map((u) => {
      const used = u.vacations.reduce((sum, v) => sum + v.days, 0);
      const restaurantNames = u.restaurants.map(
        (r) => r.restaurant.name || "Nepoznat"
      );
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

    return (
      <AdminView
        allRequests={allRequests}
        blockedDays={blockedDays}
        usersStats={usersStats}
      />
    );
  }

  // --- RADNIK POGLED ---
  const myRequestsRaw = await prisma.vacationRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const myRequests = myRequestsRaw.map((req) => ({
    id: req.id,
    start: req.start,
    end: req.end,
    days: req.days,
    status: req.status,
  }));

  // Serijalizacija za klijenta
  const serializedUser = JSON.parse(JSON.stringify(user));

  return (
    <UserView
      userData={serializedUser}
      myRequests={myRequests}
      blockedDays={blockedDays}
    />
  );
}