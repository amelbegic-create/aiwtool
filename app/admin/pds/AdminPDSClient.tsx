"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { deletePDSTemplate } from "@/app/actions/pdsActions";
import { useRouter } from "next/navigation";

export type PDSTemplateRow = {
  id: string;
  title: string;
  year: number;
  isGlobal: boolean;
  isActive: boolean;
  restaurantNames: string[];
};

export default function AdminPDSClient({
  templates,
}: {
  templates: PDSTemplateRow[];
}) {
  const router = useRouter();

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Obrisati PDS obrazac "${title}"? Postojeći PDS zapisnici radnika neće biti obrisani.`)) return;
    const res = await deletePDSTemplate(id);
    if (res.success) router.refresh();
    else alert(res.error);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
              Naziv
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
              Godina
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
              Ciljani restorani
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-28">
              Akcije
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {templates.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                Nema PDS obrazaca. Kliknite &quot;Kreiraj Novi PDS&quot; za prvi obrazac.
              </td>
            </tr>
          ) : (
            templates.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-semibold text-slate-900">{t.title}</td>
                <td className="px-4 py-3 text-slate-600">{t.year}</td>
                <td className="px-4 py-3 text-slate-700">
                  {t.isGlobal ? (
                    <span className="font-medium text-[#1a3826]">SVI RESTORANI</span>
                  ) : (
                    t.restaurantNames.length > 0
                      ? t.restaurantNames.join(", ")
                      : "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {t.isActive ? "Aktivan" : "Neaktivan"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/admin/pds/${t.id}`}
                      className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#1a3826]"
                      title="Uredi"
                    >
                      <Pencil size={16} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id, t.title)}
                      className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                      title="Obriši"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
