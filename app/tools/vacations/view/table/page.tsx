import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getVacationAdminData } from "@/app/actions/vacationActions";
import { getHolidaysForYear } from "@/app/actions/holidayActions";
import VacationTableView from "../_VacationTableView";

export default async function VacationTablePage(props: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const accessResult = await tryRequirePermission("vacation:access");
  if (!accessResult.ok) {
    return <NoPermission moduleName="Urlaub" />;
  }

  const sessionUserId = (session.user as { id?: string })?.id;
  if (!sessionUserId) redirect("/login");

  const cookieStore = await cookies();
  const activeRestaurantId = cookieStore.get("activeRestaurantId")?.value;

  const searchParams = await props.searchParams;
  const currentYear = new Date().getFullYear();
  const year = Math.min(
    2030,
    Math.max(2025, Number.isFinite(Number(searchParams.year)) ? Number(searchParams.year) : currentYear)
  );

  const [adminData, globalHolidays] = await Promise.all([
    getVacationAdminData(year, activeRestaurantId, sessionUserId),
    getHolidaysForYear(year),
  ]);
  const { usersStats, allRequests, blockedDays, reportRestaurantLabel } = adminData;
  const globalHolidayDates = globalHolidays.map(
    (h) => `${year}-${String(h.m).padStart(2, "0")}-${String(h.d).padStart(2, "0")}`
  );

  return (
    <VacationTableView
      usersStats={usersStats}
      allRequests={allRequests}
      blockedDays={blockedDays}
      selectedYear={year}
      reportRestaurantLabel={reportRestaurantLabel}
      viewType="table"
      globalHolidayDates={globalHolidayDates}
    />
  );
}
