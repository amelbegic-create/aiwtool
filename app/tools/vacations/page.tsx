/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import UserView from "./_components/UserView";
import AdminView from "./_components/AdminView";
import { cookies } from "next/headers";
import { tryRequirePermission, getDbUserForAccess, hasPermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getUserTotalForYear, getVacationAdminData } from "@/app/actions/vacationActions";
import { getHolidaysForYear } from "@/app/actions/holidayActions";

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
  const isManagerView = isGodMode || isAdmin;

  if (isManagerView) {
    const [adminData, globalHolidays] = await Promise.all([
      getVacationAdminData(selectedYear, activeRestaurantId, sessionUserId),
      getHolidaysForYear(selectedYear),
    ]);
    const { usersStats, allRequests, blockedDays, reportRestaurantLabel } = adminData;
    const canRegisterOwnVacation =
      user.role === Role.SYSTEM_ARCHITECT ||
      user.role === Role.SUPER_ADMIN ||
      user.role === Role.ADMIN;

    const dbUserForAccess = await getDbUserForAccess();
    const canLinkToAdminUserEdit = hasPermission(
      String(dbUserForAccess.role),
      dbUserForAccess.permissions ?? [],
      "users:manage"
    );

    return (
      <AdminView
        allRequests={allRequests}
        blockedDays={blockedDays}
        usersStats={usersStats}
        selectedYear={selectedYear}
        reportRestaurantLabel={reportRestaurantLabel}
        canRegisterOwnVacation={canRegisterOwnVacation}
        globalHolidays={globalHolidays}
        canLinkToAdminUserEdit={canLinkToAdminUserEdit}
      />
    );
  }

  const blockedDaysPromise = prisma.blockedDay.findMany({
    where:
      activeRestaurantId && activeRestaurantId !== "all"
        ? { restaurantId: activeRestaurantId }
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
      select: { id: true, start: true, end: true, days: true, status: true },
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
