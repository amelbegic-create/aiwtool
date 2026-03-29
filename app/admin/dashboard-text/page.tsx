import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDashboardChangelog } from "@/app/actions/dashboardChangelogActions";
import { canEditDashboardChangelog } from "@/lib/permissions";
import DashboardTextClient from "./DashboardTextClient";

export default async function DashboardTextPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const role = (session.user as { role?: string })?.role;
  const permissions = (session.user as { permissions?: string[] })?.permissions ?? [];
  if (!canEditDashboardChangelog(role, permissions)) {
    redirect("/admin");
  }

  const initial = await getDashboardChangelog();
  return (
    <div className="fixed inset-x-0 bottom-0 top-14 md:top-16 z-30 flex flex-col overflow-hidden bg-background">
      <div className="shrink-0 px-4 md:px-6 py-4 border-b border-border bg-background">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-[#1a3826] dark:hover:text-[#FFC72C] mb-3"
        >
          <ArrowLeft size={16} /> Zurück zur Verwaltung
        </Link>
        <h1 className="text-xl md:text-3xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tight leading-tight">
          Aktuelle Änderungen
        </h1>
        <p className="text-muted-foreground text-sm font-medium mt-2 max-w-3xl">
          Dieser Text erscheint auf der Startseite für alle Nutzer. Bearbeitbar durch Admin, Super Admin und System Architect.
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-4 md:px-6 pb-4">
        <DashboardTextClient initial={initial} />
      </div>
    </div>
  );
}
