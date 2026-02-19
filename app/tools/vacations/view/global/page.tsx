import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getGlobalVacationStats } from "@/app/actions/vacationActions";
import VacationTableView from "../_VacationTableView";

export default async function VacationGlobalPage(props: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const accessResult = await tryRequirePermission("vacation:export");
  if (!accessResult.ok) {
    return <NoPermission moduleName="Urlaub" />;
  }

  const searchParams = await props.searchParams;
  const currentYear = new Date().getFullYear();
  const year = Math.min(
    2030,
    Math.max(2025, Number.isFinite(Number(searchParams.year)) ? Number(searchParams.year) : currentYear)
  );

  const { usersStats, allRequests } = await getGlobalVacationStats(year);
  const blockedDays: { id: string; date: string; reason: string | null }[] = [];

  return (
    <VacationTableView
      usersStats={usersStats}
      allRequests={allRequests as import("../_components/AdminView").RequestWithUser[]}
      blockedDays={blockedDays}
      selectedYear={year}
      reportRestaurantLabel="Global"
      viewType="plan"
    />
  );
}
