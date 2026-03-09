import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getCategories, getTemplates } from "@/app/actions/templateActions";
import AdminVorlagenClient from "./AdminVorlagenClient";

export default async function AdminVorlagenPage() {
  const access = await tryRequirePermission("vorlagen:manage");
  if (!access.ok) {
    return <NoPermission moduleName="Vorlagen" />;
  }

  const [categories, templates] = await Promise.all([
    getCategories(),
    getTemplates(),
  ]);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <AdminVorlagenClient initialCategories={categories} initialTemplates={templates} />
    </div>
  );
}
