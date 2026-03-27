import Link from "next/link";
import { ArrowLeft, CalendarRange } from "lucide-react";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { listDashboardEventsForAdmin } from "@/app/actions/dashboardEventActions";
import DashboardEventsAdminClient, { type DashboardEventAdminRow } from "./DashboardEventsAdminClient";

export default async function AdminDashboardEventsPage() {
  const access = await tryRequirePermission("dashboard_events:manage");
  if (!access.ok) return <NoPermission moduleName="Dashboard-Events" />;

  const rows = await listDashboardEventsForAdmin();
  const items: DashboardEventAdminRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
    coverImageUrl: r.coverImageUrl,
    imageCount: r.images.length,
  }));

  return (
    <div className="min-h-screen bg-background p-4 font-sans text-foreground md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1200px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <Link href="/admin" className="mb-2 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-[#1a3826] dark:hover:text-[#FFC72C]"><ArrowLeft size={16} aria-hidden /> Zurück zur Verwaltung</Link>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1a3826] text-[#FFC72C]"><CalendarRange size={22} aria-hidden /></span>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-[#1a3826] dark:text-[#FFC72C] md:text-3xl">Dashboard-Events</h1>
                <p className="text-sm font-medium text-muted-foreground">Events & Highlights für den unteren Slider.</p>
              </div>
            </div>
          </div>
          <Link href="/admin/dashboard-events/new" className="inline-flex items-center justify-center rounded-lg bg-[#1a3826] px-5 py-2.5 text-sm font-black uppercase tracking-wide text-[#FFC72C] transition hover:opacity-90">Neues Event</Link>
        </div>

        <DashboardEventsAdminClient items={items} />
      </div>
    </div>
  );
}

