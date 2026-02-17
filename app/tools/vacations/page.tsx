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
import { getUserTotalForYear } from "@/app/actions/vacationActions";
import { computeCarryOverForYear, VACATION_YEAR_MIN } from "@/lib/vacationCarryover";

export default async function VacationPage(props: { searchParams: Promise<{ year?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const accessResult = await tryRequirePermission("vacation:access");
  if (!accessResult.ok) {
    return <NoPermission moduleName="Urlaub" />;
  }

  const cookieStore = await cookies();
  const activeRestaurantId = cookieStore.get("activeRestaurantId")?.value;

  const sessionUserId = (session.user as any).id;

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      vacationEntitlement: true,
      vacationCarryover: true,
      restaurants: { select: { restaurantId: true, restaurant: { select: { name: true } } } },
    },
  });

  if (!user) return <div className="p-10 text-red-500">Benutzer nicht gefunden.</div>;

  const searchParams = await props.searchParams;
  const currentYear = new Date().getFullYear();
  const YEAR_MIN = 2025;
  const YEAR_MAX = 2030;
  const rawYear = searchParams.year ? parseInt(searchParams.year) : currentYear;
  const selectedYear = Math.min(YEAR_MAX, Math.max(YEAR_MIN, Number.isFinite(rawYear) ? rawYear : currentYear));

  const startOfYear = `${selectedYear}-01-01`;
  const endOfYear = `${selectedYear}-12-31`;

  const isGodMode = user.role === Role.SYSTEM_ARCHITECT || user.role === Role.SUPER_ADMIN;
  const isAdmin = user.role === Role.ADMIN;
  // Admin view (odobravanje, statistika, blokirani dani) samo za ADMIN i God. MANAGER i CREW vide User view (svoj godišnji).
  const isManagerView = isGodMode || isAdmin;

  const blockedDaysPromise = prisma.blockedDay.findMany({
    where:
      activeRestaurantId && activeRestaurantId !== "all"
        ? { restaurantId: activeRestaurantId }
        : undefined,
    orderBy: { date: "asc" },
  });

  if (isManagerView) {
    let userWhereClause: any = { isActive: true, role: { not: "SYSTEM_ARCHITECT" } };
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

    const rangeStart = `${VACATION_YEAR_MIN}-01-01`;
    const rangeEnd = `${selectedYear}-12-31`;

    const [blockedDaysRaw, allRequestsRaw, allUsers, usedByUserByYearRows, reportRestaurantResult] = await Promise.all([
      blockedDaysPromise,
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
            where: {
              status: "APPROVED",
              start: { gte: startOfYear, lte: endOfYear },
            },
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
        where: {
          status: "APPROVED",
          start: { gte: rangeStart, lte: rangeEnd },
        },
        select: { userId: true, start: true, days: true },
      }),
      activeRestaurantId && activeRestaurantId !== "all"
        ? prisma.restaurant.findUnique({
            where: { id: activeRestaurantId },
            select: { name: true },
          })
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
      reportRestaurantResult?.name ?? (activeRestaurantId && activeRestaurantId !== "all" ? `Restaurant ${activeRestaurantId}` : "Alle Restaurants");

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

  const [blockedDaysRaw, myRequestsRaw, myTotalResult] = await Promise.all([
    blockedDaysPromise,
    prisma.vacationRequest.findMany({
      where: {
        userId: user.id,
        start: { gte: startOfYear, lte: endOfYear },
      },
      select: { id: true, start: true, end: true, days: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
    getUserTotalForYear(sessionUserId, selectedYear),
  ]);

  const blockedDays = blockedDaysRaw.map((d) => ({ id: d.id, date: d.date, reason: d.reason }));

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

  const myTotalForYear = myTotalResult.total;
  const myAllowanceForYear = myTotalResult.allowance;
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
