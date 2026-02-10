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

    const prevYearStart = `${selectedYear - 1}-01-01`;
    const prevYearEnd = `${selectedYear - 1}-12-31`;

    const [blockedDaysRaw, allRequestsRaw, allUsers, prevYearUsedRows, reportRestaurantResult] = await Promise.all([
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
            where: { year: { in: [selectedYear, selectedYear - 1] } },
            select: { year: true, days: true, carriedOverDays: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.vacationRequest.findMany({
        where: {
          status: "APPROVED",
          start: { gte: prevYearStart, lte: prevYearEnd },
        },
        select: { userId: true, days: true },
      }),
      activeRestaurantId && activeRestaurantId !== "all"
        ? prisma.restaurant.findUnique({
            where: { id: activeRestaurantId },
            select: { name: true },
          })
        : Promise.resolve(null),
    ]);

    const blockedDays = blockedDaysRaw.map((d) => ({ id: d.id, date: d.date, reason: d.reason }));

    const prevYearUsedByUser = new Map<string, number>();
    for (const row of prevYearUsedRows) {
      prevYearUsedByUser.set(row.userId, (prevYearUsedByUser.get(row.userId) ?? 0) + row.days);
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

      const vaThis = u.vacationAllowances?.find((a) => a.year === selectedYear);
      const vaPrev = u.vacationAllowances?.find((a) => a.year === selectedYear - 1);
      const usedPrev = prevYearUsedByUser.get(u.id) ?? 0;

      let allowance: number;
      let carriedOver: number;
      if (vaThis) {
        allowance =
          vaThis.days != null && Number.isFinite(Number(vaThis.days))
            ? Math.max(0, Math.floor(Number(vaThis.days)))
            : u.vacationEntitlement ?? 20;
        carriedOver = Math.max(0, Math.floor(Number(vaThis.carriedOverDays) ?? 0));
      } else {
        allowance = u.vacationEntitlement ?? 20;
        if (vaPrev) {
          const totalPrev = (vaPrev.days ?? 0) + (vaPrev.carriedOverDays ?? 0);
          carriedOver = Math.max(0, totalPrev - usedPrev);
        } else {
          carriedOver = Math.max(0, Math.floor(Number(u.vacationCarryover) ?? 0));
        }
      }
      const total = allowance + carriedOver;

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
