"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, Search, FolderTree } from "lucide-react";
import { deletePartner } from "@/app/actions/partnerActions";
import { toast } from "sonner";

type PartnerRow = {
  id: string;
  categoryId: string | null;
  category?: { id: string; name: string } | null;
  companyName: string;
  serviceDescription: string | null;
  notes: string | null;
  contacts: Array<{
    id: string;
    contactName: string;
    phone: string | null;
    email: string | null;
    role: string | null;
  }>;
};

export default function AdminPartnersClient({
  initialPartners,
}: {
  initialPartners: PartnerRow[];
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return initialPartners;
    return initialPartners.filter(
      (p) =>
        p.companyName.toLowerCase().includes(q) ||
        (p.serviceDescription?.toLowerCase() ?? "").includes(q) ||
        (p.notes?.toLowerCase() ?? "").includes(q) ||
        (p.category?.name?.toLowerCase() ?? "").includes(q) ||
        p.contacts.some(
          (c) =>
            (c.contactName?.toLowerCase() ?? "").includes(q) ||
            (c.email?.toLowerCase() ?? "").includes(q) ||
            (c.phone?.toLowerCase() ?? "").includes(q)
        )
    );
  }, [initialPartners, searchQuery]);

  const handleDelete = async (id: string) => {
    if (!confirm("Möchten Sie dieses Unternehmen wirklich löschen? Die Kontakte werden mitgelöscht."))
      return;
    try {
      await deletePartner(id);
      toast.success("Unternehmen wurde gelöscht.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler.");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-10 font-sans text-foreground">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] uppercase tracking-tighter">
              PARTNER <span className="text-[#FFC72C]">VERWALTUNG</span>
            </h1>
            <p className="text-muted-foreground text-sm font-semibold mt-1">
              Übersicht und Bearbeitung von Lieferanten und Serviceunternehmen
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin"
              className="text-sm font-bold text-[#1a3826] dark:text-[#FFC72C] hover:underline"
            >
              ← Zurück zur Verwaltung
            </Link>
            <Link
              href="/admin/partners/categories"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-sm font-bold"
            >
              <FolderTree size={18} /> Abteilungen (Kategorien)
            </Link>
            <Link
              href="/admin/partners/new"
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] hover:bg-[#142e1e] dark:hover:bg-[#e0af25] text-white rounded-xl text-sm font-black shadow-md"
            >
              <Plus size={18} /> Neues Unternehmen hinzufügen
            </Link>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border flex items-center gap-3 p-4">
          <Search size={18} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Firmen oder Kontakte suchen…"
            className="bg-transparent outline-none text-sm font-medium text-foreground w-full"
          />
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-4 md:px-6 py-4 bg-muted/50 border-b border-border text-[10px] font-black text-muted-foreground uppercase">
            <div className="col-span-4 md:col-span-3">Unternehmen</div>
            <div className="col-span-2">Kategorie</div>
            <div className="col-span-3 hidden md:block">Leistungsbeschreibung</div>
            <div className="col-span-2">Kontakte</div>
            <div className="col-span-3 md:col-span-2 text-right">Aktionen</div>
          </div>
          <div className="divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="px-4 md:px-6 py-10 text-center text-muted-foreground text-sm">
                Keine Unternehmen. Klicken Sie auf „Neues Unternehmen hinzufügen“ oder ändern Sie die Suche.
              </div>
            ) : (
              filtered.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-12 gap-4 px-4 md:px-6 py-4 items-center hover:bg-muted/30 transition-colors"
                >
                  <div className="col-span-4 md:col-span-3 font-semibold text-foreground">
                    {p.companyName}
                  </div>
                  <div className="col-span-2">
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-[#1a3826]/10 dark:bg-[#FFC72C]/20 text-[#1a3826] dark:text-[#FFC72C] border border-[#1a3826]/20">
                      {p.category?.name ?? "—"}
                    </span>
                  </div>
                  <div className="col-span-3 hidden md:block text-sm text-muted-foreground truncate max-w-[200px]">
                    {p.serviceDescription || "—"}
                  </div>
                  <div className="col-span-2 text-sm text-muted-foreground">
                    {p.contacts.length} Kontakt(e)
                  </div>
                  <div className="col-span-3 md:col-span-2 flex justify-end gap-2">
                    <Link
                      href={`/admin/partners/${p.id}/edit`}
                      className="p-2 rounded-xl border border-border hover:bg-muted"
                      title="Bearbeiten"
                    >
                      <Pencil size={16} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="p-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      title="Obriši"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
