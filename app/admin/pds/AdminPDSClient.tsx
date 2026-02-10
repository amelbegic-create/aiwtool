"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { deletePDSTemplate } from "@/app/actions/pdsActions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
    if (!confirm(`PDS-Vorlage "${title}" wirklich löschen? Bestehende PDS-Einträge der Mitarbeiter bleiben erhalten.`)) return;
    const res = await deletePDSTemplate(id);
    if (res.success) {
      toast.success("PDS-Vorlage gelöscht.");
      router.refresh();
    } else alert(res.error);
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-border">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Naziv
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Godina
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Ciljani restorani
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider w-28">
              Akcije
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {templates.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                Keine PDS-Vorlagen. Klicken Sie auf „Vorlage erstellen“ für die erste Vorlage.
              </td>
            </tr>
          ) : (
            templates.map((t) => (
              <tr key={t.id} className="hover:bg-muted/50">
                <td className="px-4 py-3 font-semibold text-slate-900">{t.title}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.year}</td>
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
                      t.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-muted-foreground"
                    }`}
                  >
                    {t.isActive ? "Aktiv" : "Inaktiv"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/admin/pds/${t.id}`}
                      className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-[#1a3826]"
                      title="Uredi"
                    >
                      <Pencil size={16} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id, t.title)}
                      className="p-2 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      title="Löschen"
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
