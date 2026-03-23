import { notFound } from "next/navigation";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getDashboardNewsById } from "@/app/actions/dashboardNewsActions";
import DashboardNewsForm, { DashboardNewsFormShell } from "../../DashboardNewsForm";

type Props = { params: Promise<{ id: string }> };

export default async function EditDashboardNewsPage({ params }: Props) {
  const access = await tryRequirePermission("dashboard_news:manage");
  if (!access.ok) {
    return <NoPermission moduleName="Dashboard-News" />;
  }

  const { id } = await params;
  const row = await getDashboardNewsById(id);
  if (!row) notFound();

  const initial = {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    coverImageUrl: row.coverImageUrl,
    attachmentUrl: row.attachmentUrl,
    attachmentKind: row.attachmentKind,
  };

  return (
    <DashboardNewsFormShell
      title="Meldung bearbeiten"
      description="Leere Dateifelder behalten die bestehenden Uploads bei."
    >
      <DashboardNewsForm mode="edit" initial={initial} />
    </DashboardNewsFormShell>
  );
}
