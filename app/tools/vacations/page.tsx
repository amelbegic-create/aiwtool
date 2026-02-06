/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import UserView from "./_components/UserView";
import AdminView from "./_components/AdminView";
import { cookies } from "next/headers";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";

export default async function VacationPage(props: { searchParams: Promise<{ year?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const accessResult = await tryRequirePermission("vacation:access");
  if (!accessResult.ok) {
    return <NoPermission moduleName="Godišnji odmori" />;
  }

  const cookieStore = await cookies();
  const activeRestaurantId = cookieStore.get("activeRestaurantId")?.value;

  const sessionUserId = (session.user as any).id;

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    include: {
      restaurants: { include: { restaurant: true } },
      vacationAllowances: true,
    },
  });

  if (!user) return <div className="p-10 text-red-500">Korisnik nije pronađen.</div>;

  const searchParams = await props.searchParams;
  const currentYear = new Date().getFullYear();
  const selectedYear = searchParams.year ? parseInt(searchParams.year) : currentYear;

  const startOfYear = `${selectedYear}-01-01`;
  const endOfYear = `${selectedYear}-12-31`;

  const isGodMode = user.role === Role.SYSTEM_ARCHITECT || user.role === Role.SUPER_ADMIN;
  const isAdmin = user.role === Role.ADMIN;
  // Admin view (odobravanje, statistika, blokirani dani) samo za ADMIN i God. MANAGER i CREW vide User view (svoj godišnji).
  const isManagerView = isGodMode || isAdmin;

  const blockedDaysRaw = await prisma.blockedDay.findMany({
    where:
      activeRestaurantId && activeRestaurantId !== "all"
        ? { restaurantId: activeRestaurantId }
        : undefined,
    orderBy: { date: "asc" },
  });

  const blockedDays = blockedDaysRaw.map((d) => ({ id: d.id, date: d.date, reason: d.reason }));

  const myAllowanceRow = user.vacationAllowances?.find((x) => x.year === selectedYear);
  const myAllowanceForYear = myAllowanceRow?.days ?? user.vacationEntitlement ?? 0;
  const myTotalForYear = myAllowanceForYear + (user.vacationCarryover ?? 0);

  if (isManagerView) {
    let userWhereClause: any = { isActive: true };
    let requestWhereClause: any = {
      start: { gte: startOfYear, lte: endOfYear },
    };

    if (activeRestaurantId && activeRestaurantId !== "all") {
      userWhereClause = {
        ...userWhereClause,
        restaurants: { some: { restaurantId: activeRestaurantId } },
      };

      requestWhereClause = {
        ...requestWhereClause,
        user: { restaurants: { some: { restaurantId: activeRestaurantId } } },
      };
    } else if (!isGodMode) {
      const myRestaurantIds = user.restaurants.map((r) => r.restaurantId);

      userWhereClause = {
        ...userWhereClause,
        restaurants: { some: { restaurantId: { in: myRestaurantIds } } },
      };

      requestWhereClause = {
        ...requestWhereClause,
        user: { restaurants: { some: { restaurantId: { in: myRestaurantIds } } } },
      };
    }

    const allRequestsRaw = await prisma.vacationRequest.findMany({
      where: requestWhereClause,
      include: {
        restaurant: { select: { name: true } },
        user: {
          include: {
            restaurants: { include: { restaurant: true } },
            vacationAllowances: { where: { year: selectedYear }, select: { days: true, year: true } },
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
      restaurantName: req.restaurant?.name ?? req.user.restaurants[0]?.restaurant.name ?? "N/A",
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        mainRestaurant: req.restaurant?.name ?? req.user.restaurants[0]?.restaurant.name ?? "N/A",
      },
    }));

    const allUsers = await prisma.user.findMany({
      where: userWhereClause,
      include: {
        department: { select: { name: true, color: true } },
        vacations: {
          where: {
            status: "APPROVED",
            start: { gte: startOfYear, lte: endOfYear },
          },
        },
        restaurants: { include: { restaurant: true } },
        vacationAllowances: { where: { year: selectedYear }, select: { year: true, days: true } },
      },
      orderBy: { name: "asc" },
    });

    const usersStats = allUsers.map((u) => {
      const used = u.vacations.reduce((sum, v) => sum + v.days, 0);
      const restaurantNames = u.restaurants.map((r) => r.restaurant.name || "Nepoznat");

      const allowance = u.vacationAllowances?.[0]?.days ?? u.vacationEntitlement ?? 0;
      const total = allowance + (u.vacationCarryover || 0);

      return {
        id: u.id,
        name: u.name,
        restaurantNames,
        department: u.department?.name ?? null,
        departmentColor: u.department?.color ?? null,
        total,
        used,
        remaining: total - used,
      };
    });

    const reportRestaurantLabel =
      activeRestaurantId && activeRestaurantId !== "all"
        ? (await prisma.restaurant.findUnique({
            where: { id: activeRestaurantId },
            select: { name: true },
          }))?.name ?? `Restoran ${activeRestaurantId}`
        : "Svi restorani";

    const canRegisterOwnVacation =
      user.role === Role.SYSTEM_ARCHITECT ||
      user.role === Role.SUPER_ADMIN ||
      user.role === Role.ADMIN;

    return (
      <AdminView
        allRequests={allRequests}
        blockedDays={blockedDays}
        usersStats={usersStats}
        selectedYear={selectedYear}
        reportRestaurantLabel={reportRestaurantLabel}
        canRegisterOwnVacation={canRegisterOwnVacation}
      />
    );
  }

  const myRequestsRaw = await prisma.vacationRequest.findMany({
    where: {
      userId: user.id,
      start: { gte: startOfYear, lte: endOfYear },
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
    .filter((r) => r.status === "APPROVED")
    .reduce((acc, curr) => acc + curr.days, 0);

  const remaining = myTotalForYear - usedThisYear;

  const serializedUser = {
    ...JSON.parse(JSON.stringify(user)),
    usedThisYear,
    selectedYearTotal: myTotalForYear,
    selectedYearAllowance: myAllowanceForYear,
    selectedYearRemaining: remaining,
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
