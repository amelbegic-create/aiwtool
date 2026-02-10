import { tryRequirePermission } from "@/lib/access";
import { getDashboardHighlights } from "@/app/actions/dashboardHighlightActions";
import NoPermission from "@/components/NoPermission";
import DashboardModulesClient from "./DashboardModulesClient";

export default async function DashboardModulesPage() {
  const access = await tryRequirePermission("users:access");
  if (!access.ok) {
    return <NoPermission moduleName="Dashboard-Konfiguration" />;
  }

  const highlights = await getDashboardHighlights();
  return <DashboardModulesClient initialHighlights={highlights} />;
}
