import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getGlobalVacationStats } from "@/app/actions/vacationActions";
import VacationTableView from "../_VacationTableView";
import type { RequestWithUser } from "../../_components/AdminView";

export default async function VacationDepartmentsPage(props: {
  searchParams: Promise<{ year?: string; depts?: string }>;
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

  const deptsParam = searchParams.depts?.trim() || "";
  const selectedDepts = deptsParam
    ? deptsParam.split(",").map((d) => d.trim()).filter(Boolean)
    : [];

  const { usersStats, allRequests } = await getGlobalVacationStats(year);

  const deptSet = new Set(selectedDepts.map((d) => (d || "N/A")));
  const filteredStats = selectedDepts.length
    ? usersStats.filter((u) => deptSet.has(u.department?.trim() || "N/A"))
    : usersStats;
  const filteredUserIds = new Set(filteredStats.map((u) => u.id));
  const filteredRequests = allRequests.filter((r) =>
    filteredUserIds.has(r.user.id)
  ) as RequestWithUser[];

  return (
    <VacationTableView
      usersStats={filteredStats}
      allRequests={filteredRequests}
      blockedDays={[]}
      selectedYear={year}
      reportRestaurantLabel={selectedDepts.length ? `Abteilungen: ${selectedDepts.join(", ")}` : "Alle Abteilungen"}
      viewType="plan"
    />
  );
}
