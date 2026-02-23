import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getPartners } from "@/app/actions/partnerActions";
import AdminPartnersClient from "./AdminPartnersClient";

export default async function AdminPartnersPage() {
  const access = await tryRequirePermission("partners:manage");
  if (!access.ok) {
    return <NoPermission moduleName="Firmen und Partner" />;
  }

  const partners = await getPartners();
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <AdminPartnersClient initialPartners={partners} />
    </div>
  );
}
