import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect, notFound } from "next/navigation";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getVacationReportForUser } from "@/app/actions/vacationActions";
import VacationReportView from "../_VacationReportView";

export default async function VacationReportPage(props: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const accessResult = await tryRequirePermission("vacation:access");
  if (!accessResult.ok) {
    return <NoPermission moduleName="Urlaub" />;
  }

  const params = await props.params;
  const searchParams = await props.searchParams;
  const userId = params.userId;
  const currentYear = new Date().getFullYear();
  const year = Math.min(
    2030,
    Math.max(2025, Number.isFinite(Number(searchParams.year)) ? Number(searchParams.year) : currentYear)
  );

  const data = await getVacationReportForUser(userId, year);
  if (!data) notFound();

  return (
    <VacationReportView
      user={data.userStat}
      allRequests={data.requests}
      selectedYear={year}
    />
  );
}
