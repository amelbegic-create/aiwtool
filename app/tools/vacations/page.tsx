/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import UserView from "./_components/UserView";
import AdminView from "./_components/AdminView";
import { tryRequirePermission, getDbUserForAccess, hasPermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getUserTotalForYear, getVacationAdminData } from "@/app/actions/vacationActions";
import { getHolidaysForYear } from "@/app/actions/holidayActions";
import { getResolvedActiveRestaurantIdForSession } from "@/app/actions/activeRestaurantSync";
import VacationUrlRestaurantSync from "./_components/VacationUrlRestaurantSync";

export default async function VacationPage(props: {
  searchParams: Promise<{
    year?: string;
    tab?: string;
    view?: string;
    restaurantId?: string;
    requestId?: string;
  }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const accessResult = await tryRequirePermission("vacation:access");
  if (!accessResult.ok) {
    return <NoPermission moduleName="Urlaub" />;
  }

  const sessionUserId = accessResult.user.id;

  const resolvedRestaurantId = await getResolvedActiveRestaurantIdForSession();

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
  const initialTabParam = (searchParams.tab || "").toLowerCase();
  const initialTab =
    initialTabParam === "requests" ? "REQUESTS" : initialTabParam === "blocked" ? "BLOCKED" : "STATS";

  const viewParam = (searchParams.view || "").toLowerCase();
  const forceSelfView = viewParam === "self";

  const paramRestaurantId =
    typeof searchParams.restaurantId === "string" && searchParams.restaurantId.trim()
      ? searchParams.restaurantId.trim()
      : undefined;
  const highlightRequestId =
    typeof searchParams.requestId === "string" && searchParams.requestId.trim()
      ? searchParams.requestId.trim()
      : null;

  const startOfYear = `${selectedYear}-01-01`;
  const endOfYear = `${selectedYear}-12-31`;

  const isGodMode = user.role === Role.SYSTEM_ARCHITECT;
  const isAdmin = user.role === Role.ADMIN;
  const isRestaurantManager = user.role === Role.MANAGER;
  const isManagerView = isGodMode || isAdmin || isRestaurantManager;

  /** Kao layout: cookie samo ako je dozvoljen; ne čitati sirovi cookie (stari admin ID). */
  let effectiveActiveRestaurantId: string | undefined = resolvedRestaurantId;
  /** Deep link: cookie se postavlja u klijentskoj komponenti (Server Action), ne u RSC. */
  let urlRestaurantForCookieSync: string | null = null;

  if (isManagerView && !forceSelfView && paramRestaurantId) {
    let validated: string | undefined;
    if (paramRestaurantId === "all") {
      if (isGodMode || isAdmin) validated = "all";
    } else if (isGodMode || isAdmin) {
      const exists = await prisma.restaurant.findFirst({
        where: { id: paramRestaurantId, isActive: true },
        select: { id: true },
      });
      if (exists) validated = paramRestaurantId;
    } else if (isRestaurantManager) {
      if (user.restaurants.some((r) => r.restaurantId === paramRestaurantId)) {
        validated = paramRestaurantId;
      }
    }
    if (validated !== undefined) {
      if (validated === "all") {
        effectiveActiveRestaurantId = "all";
      } else {
        effectiveActiveRestaurantId = validated;
        urlRestaurantForCookieSync = validated;
      }
    }
  }

  if (isManagerView && !forceSelfView) {
    const [adminData, globalHolidays] = await Promise.all([
      getVacationAdminData(selectedYear, effectiveActiveRestaurantId, sessionUserId),
      getHolidaysForYear(selectedYear),
    ]);
    const { usersStats, allRequests, blockedDays, reportRestaurantLabel } = adminData;
    const canRegisterOwnVacation =
      user.role === Role.SYSTEM_ARCHITECT ||
      user.role === Role.ADMIN ||
      user.role === Role.MANAGER;

    const dbUserForAccess = await getDbUserForAccess();
    const canLinkToAdminUserEdit = hasPermission(
      String(dbUserForAccess.role),
      dbUserForAccess.permissions ?? [],
      "users:manage"
    );

    const canReorderVacationEmployees =
      (user.role === Role.SYSTEM_ARCHITECT || user.role === Role.ADMIN) &&
      !!effectiveActiveRestaurantId &&
      effectiveActiveRestaurantId !== "all";

    return (
      <>
        {urlRestaurantForCookieSync ? (
          <VacationUrlRestaurantSync restaurantId={urlRestaurantForCookieSync} />
        ) : null}
        <AdminView
          allRequests={allRequests}
          blockedDays={blockedDays}
          usersStats={usersStats}
          selectedYear={selectedYear}
          reportRestaurantLabel={reportRestaurantLabel}
          canRegisterOwnVacation={canRegisterOwnVacation}
          globalHolidays={globalHolidays}
          canLinkToAdminUserEdit={canLinkToAdminUserEdit}
          initialTab={initialTab}
          isRestaurantManager={isRestaurantManager}
          activeRestaurantId={effectiveActiveRestaurantId ?? null}
          canReorderVacationEmployees={canReorderVacationEmployees}
          highlightRequestId={highlightRequestId}
          vacationActorUserId={sessionUserId}
        />
      </>
    );
  }

  const blockedDaysPromise = prisma.blockedDay.findMany({
    where:
      resolvedRestaurantId && resolvedRestaurantId !== "all"
        ? { restaurantId: resolvedRestaurantId }
        : undefined,
    orderBy: { date: "asc" },
  });

  const [blockedDaysRaw, myRequestsRaw, myTotalResult, globalHolidays] = await Promise.all([
    blockedDaysPromise,
    prisma.vacationRequest.findMany({
      where: {
        userId: user.id,
        start: { gte: startOfYear, lte: endOfYear },
      },
      select: { id: true, start: true, end: true, days: true, status: true, note: true },
      orderBy: { createdAt: "desc" },
    }),
    getUserTotalForYear(sessionUserId, selectedYear),
    getHolidaysForYear(selectedYear),
  ]);

  const blockedDays = blockedDaysRaw.map((d) => ({ id: d.id, date: d.date, reason: d.reason }));

  const myRequests = myRequestsRaw.map((req) => ({
    id: req.id,
    start: req.start,
    end: req.end,
    days: req.days,
    status: req.status,
    note: req.note,
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
      globalHolidays={globalHolidays}
    />
  );
}
