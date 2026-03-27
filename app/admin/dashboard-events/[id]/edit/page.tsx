import { notFound } from "next/navigation";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getDashboardEventById } from "@/app/actions/dashboardEventActions";
import DashboardEventsForm, { DashboardEventsFormShell } from "../../DashboardEventsForm";

type Props = { params: Promise<{ id: string }> };

export default async function EditDashboardEventPage({ params }: Props) {
  const access = await tryRequirePermission("dashboard_events:manage");
  if (!access.ok) return <NoPermission moduleName="Dashboard-Events" />;

  const { id } = await params;
  const row = await getDashboardEventById(id);
  if (!row) notFound();

  const initial = {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    coverImageUrl: row.coverImageUrl,
    galleryUrls: row.images.map((i) => i.imageUrl),
    videoUrl: row.videoUrl ?? null,
  };

  return (
    <DashboardEventsFormShell title="Event bearbeiten" description="Galerie: entfernte Häkchen werden gelöscht, neue Dateien ergänzt.">
      <DashboardEventsForm mode="edit" initial={initial} />
    </DashboardEventsFormShell>
  );
}

