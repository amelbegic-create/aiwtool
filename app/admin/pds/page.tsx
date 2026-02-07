import Link from "next/link";
import { listPDSTemplatesForAdmin } from "@/app/actions/pdsActions";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import AdminPDSClient from "./AdminPDSClient";

export const dynamic = "force-dynamic";

export default async function AdminPDSPage() {
  const accessResult = await tryRequirePermission("pds:access");
  if (!accessResult.ok) {
    return <NoPermission moduleName="PDS obrasci" />;
  }

  let templates: Awaited<ReturnType<typeof listPDSTemplatesForAdmin>> = [];
  try {
    templates = await listPDSTemplatesForAdmin();
  } catch {
    templates = [];
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl font-black text-[#1a3826] uppercase tracking-tight">
              PDS Obrasci
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Kreirajte i upravljajte PDS obrascima za jedan, više ili sve restorane.
            </p>
          </div>
          <Link
            href="/admin/pds/create"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#1a3826] text-white font-bold text-sm hover:bg-[#142d1f] transition-colors shadow-sm"
          >
            Kreiraj Novi PDS
          </Link>
        </div>

        <AdminPDSClient templates={templates} />
      </div>
    </div>
  );
}
