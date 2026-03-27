import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import DashboardEventsForm, { DashboardEventsFormShell } from "../DashboardEventsForm";

export default async function NewDashboardEventPage() {
  const access = await tryRequirePermission("dashboard_events:manage");
  if (!access.ok) return <NoPermission moduleName="Dashboard-Events" />;

  return (
    <DashboardEventsFormShell title="Neues Event" description="Cover und Galeriebilder werden in den Blob-Speicher hochgeladen.">
      <DashboardEventsForm mode="create" />
    </DashboardEventsFormShell>
  );
}
