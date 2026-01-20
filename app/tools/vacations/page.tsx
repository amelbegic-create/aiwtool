/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import UserView from "./_components/UserView";
import AdminView from "./_components/AdminView";
import { cookies } from "next/headers";

export default async function VacationPage(props: { searchParams: Promise<{ year?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const cookieStore = await cookies();
  const activeRestaurantId = cookieStore.get('activeRestaurantId')?.value;

  const sessionUserId = (session.user as any).id;
  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    include: { restaurants: { include: { restaurant: true } } },
  });

  if (!user) return <div className="p-10 text-red-500">Korisnik nije pronađen.</div>;

  const searchParams = await props.searchParams;
  const currentYear = new Date().getFullYear();
  const selectedYear = searchParams.year ? parseInt(searchParams.year) : currentYear;
  
  const startOfYear = `${selectedYear}-01-01`;
  const endOfYear = `${selectedYear}-12-31`;

  const isGodMode = user.role === Role.SYSTEM_ARCHITECT || user.role === Role.SUPER_ADMIN;
  const isManager = user.role === Role.ADMIN || user.role === Role.MANAGER;

  // Praznici
  const blockedDaysRaw = await prisma.blockedDay.findMany({ orderBy: { date: "asc" } });
  const blockedDays = blockedDaysRaw.map((d) => ({ id: d.id, date: d.date, reason: d.reason }));

  // --- ADMIN / MANAGER POGLED ---
  if (isGodMode || isManager) {
    let userWhereClause: any = { isActive: true };
    let requestWhereClause: any = {
        start: { gte: startOfYear, lte: endOfYear }
    };

    // LOGIKA FILTRIRANJA
    // Ako je 'all', ne filtriramo po restaurantId (znači uzimamo sve),
    // OSIM ako user nije GodMode - onda uzimamo sve njegove dodijeljene restorane.
    
    if (activeRestaurantId && activeRestaurantId !== 'all') {
        // Specifičan restoran
        userWhereClause = { 
            ...userWhereClause, 
            restaurants: { some: { restaurantId: activeRestaurantId } } 
        };
        requestWhereClause = { 
            ...requestWhereClause,
            user: { restaurants: { some: { restaurantId: activeRestaurantId } } } 
        };
    } else if (!isGodMode) {
        // "Svi restorani" ali samo oni koje manager vidi
        const myRestaurantIds = user.restaurants.map((r) => r.restaurantId);
        userWhereClause = { 
            ...userWhereClause, 
            restaurants: { some: { restaurantId: { in: myRestaurantIds } } } 
        };
        requestWhereClause = { 
            ...requestWhereClause,
            user: { restaurants: { some: { restaurantId: { in: myRestaurantIds } } } } 
        };
    }
    // Ako je GodMode i 'all', ne dodajemo nikakav filter = SVI podaci iz baze

    const allRequestsRaw = await prisma.vacationRequest.findMany({
      where: requestWhereClause,
      include: {
        user: { include: { restaurants: { include: { restaurant: true } } } },
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
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        mainRestaurant: req.user.restaurants[0]?.restaurant.name || "N/A",
      },
    }));

    const allUsers = await prisma.user.findMany({
      where: userWhereClause,
      include: {
        vacations: { 
            where: { 
                status: "APPROVED",
                start: { gte: startOfYear, lte: endOfYear }
            } 
        },
        restaurants: { include: { restaurant: true } },
      },
      orderBy: { name: "asc" },
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

    return (
      <AdminView
        allRequests={allRequests}
        blockedDays={blockedDays}
        usersStats={usersStats}
        selectedYear={selectedYear}
      />
    );
  }

  // --- RADNIK POGLED ---
  const myRequestsRaw = await prisma.vacationRequest.findMany({
    where: { 
        userId: user.id,
        start: { gte: startOfYear, lte: endOfYear }
    },
    orderBy: { createdAt: "desc" },
  });

  const myRequests = myRequestsRaw.map((req) => ({
    id: req.id,
    start: req.start,
    end: req.end,
    days: req.days,
    status: req.status,
  }));

  const usedThisYear = myRequests
    .filter(r => r.status === "APPROVED")
    .reduce((acc, curr) => acc + curr.days, 0);

  const serializedUser = {
      ...JSON.parse(JSON.stringify(user)),
      usedThisYear 
  };

  return (
    <UserView
      userData={serializedUser}
      myRequests={myRequests}
      blockedDays={blockedDays}
      selectedYear={selectedYear}
    />
  );
}