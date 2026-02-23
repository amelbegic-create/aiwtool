import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getPartnerCategories } from "@/app/actions/partnerActions";
import PartnerCategoriesClient from "./PartnerCategoriesClient";

export default async function PartnerCategoriesPage() {
  const access = await tryRequirePermission("partners:manage");
  if (!access.ok) {
    return <NoPermission moduleName="Firmen und Partner" />;
  }

  const categories = await getPartnerCategories();
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <PartnerCategoriesClient initialCategories={categories} />
    </div>
  );
}
