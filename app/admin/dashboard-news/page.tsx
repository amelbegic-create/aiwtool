import Link from "next/link";
import { ArrowLeft, Newspaper } from "lucide-react";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { listDashboardNewsForAdmin } from "@/app/actions/dashboardNewsActions";
import DashboardNewsAdminClient, {
  type DashboardNewsAdminRow,
} from "./DashboardNewsAdminClient";

export default async function AdminDashboardNewsPage() {
  const access = await tryRequirePermission("dashboard_news:manage");
  if (!access.ok) {
    return <NoPermission moduleName="Dashboard-News" />;
  }

  const rows = await listDashboardNewsForAdmin();
  const items: DashboardNewsAdminRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
    attachmentKind: r.attachmentKind,
    coverImageUrl: r.coverImageUrl,
  }));

  return (
    <div className="min-h-screen bg-background p-4 font-sans text-foreground md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1200px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <Link
              href="/admin"
              className="mb-2 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-[#1a3826] dark:hover:text-[#FFC72C]"
            >
              <ArrowLeft size={16} aria-hidden /> Zurück zur Verwaltung
            </Link>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1a3826] text-[#FFC72C]">
                <Newspaper size={22} aria-hidden />
              </span>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-[#1a3826] dark:text-[#FFC72C] md:text-3xl">
                  Dashboard-News
                </h1>
                <p className="text-sm font-medium text-muted-foreground">
                  Meldungen für den News-Slider auf der Startseite.
                </p>
              </div>
            </div>
          </div>
          <Link
            href="/admin/dashboard-news/new"
            className="inline-flex items-center justify-center rounded-lg bg-[#1a3826] px-5 py-2.5 text-sm font-black uppercase tracking-wide text-[#FFC72C] transition hover:opacity-90"
          >
            Neue Meldung
          </Link>
        </div>

        <DashboardNewsAdminClient items={items} />
      </div>
    </div>
  );
}
