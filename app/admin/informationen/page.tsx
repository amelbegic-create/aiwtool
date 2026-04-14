import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getInformationCategories, getInformationItems } from "@/app/actions/informationActions";
import AdminInformationenClient from "./AdminInformationenClient";

export default async function AdminInformationenPage() {
  const access = await tryRequirePermission("information:manage");
  if (!access.ok) {
    return <NoPermission moduleName="Informationen" />;
  }

  const [categories, items] = await Promise.all([
    getInformationCategories(),
    getInformationItems(),
  ]);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <AdminInformationenClient initialCategories={categories} initialItems={items} />
    </div>
  );
}
