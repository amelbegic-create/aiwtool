import Link from "next/link";
import { listPDSTemplatesForAdmin } from "@/app/actions/pdsActions";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import AdminPDSClient from "./AdminPDSClient";

export const dynamic = "force-dynamic";

export default async function AdminPDSPage() {
  const accessResult = await tryRequirePermission("pds:access");
  if (!accessResult.ok) {
    return <NoPermission moduleName="PDS-Vorlagen" />;
  }

  let templates: Awaited<ReturnType<typeof listPDSTemplatesForAdmin>> = [];
  try {
    templates = await listPDSTemplatesForAdmin();
  } catch {
    templates = [];
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 font-sans text-foreground">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-2xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tight">
              PDS-Vorlagen
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              PDS-Vorlagen für ein, mehrere oder alle Restaurants erstellen und verwalten.
            </p>
          </div>
          <Link
            href="/admin/pds/create"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#1a3826] text-white font-bold text-sm hover:bg-[#142d1f] transition-colors shadow-sm"
          >
            Vorlage erstellen
          </Link>
        </div>

        <AdminPDSClient templates={templates} />
      </div>
    </div>
  );
}
