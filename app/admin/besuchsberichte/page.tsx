import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getActiveRestaurantIdForBesuchsberichteAdmin } from "@/app/actions/visitReportActions";
import AdminBesuchsberichteClient from "./AdminBesuchsberichteClient";

export default async function AdminBesuchsberichtePage() {
  const access = await tryRequirePermission("besuchsberichte:manage");
  if (!access.ok) {
    return <NoPermission moduleName="Besuchsberichte" />;
  }

  const activeRestaurantId = await getActiveRestaurantIdForBesuchsberichteAdmin();

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <AdminBesuchsberichteClient initialRestaurantId={activeRestaurantId} />
    </div>
  );
}
