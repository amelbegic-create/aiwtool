import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getPinnedDocs } from "@/app/actions/dashboardPinnedDocsActions";
import AddDashboardDocButton from "./AddDashboardDocButton";
import DashboardDocsClient from "./DashboardDocsClient";

export default async function AdminDashboardDocsPage() {
  const access = await tryRequirePermission("dashboard_docs:manage");
  if (!access.ok) return <NoPermission moduleName="Dashboard-Dokumente" />;

  const docs = await getPinnedDocs();

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
                <BookOpen size={22} aria-hidden />
              </span>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-[#1a3826] dark:text-[#FFC72C] md:text-3xl">
                  Dashboard-Dokumente
                </h1>
                <p className="text-sm font-medium text-muted-foreground">
                  Global PDFs for the dashboard (e.g. Biblija AIW). Max. 50&nbsp;MB per file. Each card saves independently.
                </p>
              </div>
            </div>
          </div>
          <AddDashboardDocButton />
        </div>

        <DashboardDocsClient initial={docs} />
      </div>
    </div>
  );
}

