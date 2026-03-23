import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import DashboardNewsForm, { DashboardNewsFormShell } from "../DashboardNewsForm";

export default async function NewDashboardNewsPage() {
  const access = await tryRequirePermission("dashboard_news:manage");
  if (!access.ok) {
    return <NoPermission moduleName="Dashboard-News" />;
  }

  return (
    <DashboardNewsFormShell
      title="Neue Meldung"
      description="Titelbild und Anhang werden in den Blob-Speicher hochgeladen (BLOB_READ_WRITE_TOKEN)."
    >
      <DashboardNewsForm mode="create" />
    </DashboardNewsFormShell>
  );
}
