import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDashboardChangelog } from "@/app/actions/dashboardChangelogActions";
import DashboardTextClient from "./DashboardTextClient";

export default async function DashboardTextPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const role = (session.user as { role?: string })?.role;
  if (role !== "SYSTEM_ARCHITECT") {
    redirect("/admin");
  }

  const initial = await getDashboardChangelog();
  return (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-background flex flex-col z-40 overflow-hidden">
      <div className="shrink-0 px-6 py-4 border-b border-border bg-background flex items-center justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-[#1a3826] dark:hover:text-[#FFC72C] mb-2"
          >
            <ArrowLeft size={16} /> Zurück zur Verwaltung
          </Link>
          <h1 className="text-xl md:text-2xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tight">
            Aktuelle Änderungen
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-0.5">
            Dieser Text erscheint auf der Startseite für alle Nutzer. Nur Sie können ihn bearbeiten.
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-0 px-4 md:px-6 pb-4">
        <DashboardTextClient initial={initial} />
      </div>
    </div>
  );
}
