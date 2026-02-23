import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getPartnerCategories } from "@/app/actions/partnerActions";
import PartnerFormClient from "../_components/PartnerFormClient";

export default async function NewPartnerPage() {
  const access = await tryRequirePermission("partners:manage");
  if (!access.ok) {
    return <NoPermission moduleName="Firmen und Partner" />;
  }

  const categories = await getPartnerCategories();
  return <PartnerFormClient categories={categories} initialData={null} />;
}
