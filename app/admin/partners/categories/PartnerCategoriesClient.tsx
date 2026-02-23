"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, Plus, FolderTree } from "lucide-react";
import {
  createPartnerCategory,
  updatePartnerCategory,
  deletePartnerCategory,
} from "@/app/actions/partnerActions";
import {
  PARTNER_CATEGORY_ICON_NAMES,
  getPartnerCategoryIcon,
} from "@/lib/partnerCategoryIcons";
import { toast } from "sonner";

type CategoryRow = { id: string; name: string; sortOrder: number; icon: string | null };

export default function PartnerCategoriesClient({
  initialCategories,
}: {
  initialCategories: CategoryRow[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const startEdit = (c: CategoryRow) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditIcon(c.icon);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      await updatePartnerCategory(editingId, editName.trim(), editIcon);
      setEditingId(null);
      setEditName("");
      setEditIcon(null);
      toast.success("Kategorie wurde aktualisiert.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler.");
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await createPartnerCategory(newName.trim(), newIcon);
      setNewName("");
      setNewIcon(null);
      setAdding(false);
      toast.success("Kategorija je dodata.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Greška.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Obrisati ovu kategoriju? Firme u njoj moraju biti premještene u drugu kategoriju."))
      return;
    try {
      await deletePartnerCategory(id);
      setEditingId(null);
      toast.success("Kategorija je obrisana.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Greška.");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-10 font-sans text-foreground">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tight">
              Abteilungen (Kategorien)
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Abteilungen für Firmen und Partner anlegen oder umbenennen. Diese erscheinen in den Filtern.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/partners"
              className="text-sm font-bold text-[#1a3826] dark:text-[#FFC72C] hover:underline"
            >
              ← Zurück zu Firmen
            </Link>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border bg-muted/30 flex items-center gap-2">
            <FolderTree size={18} className="text-[#1a3826] dark:text-[#FFC72C]" />
            <span className="font-bold text-foreground">Abteilungsliste</span>
          </div>
          <ul className="divide-y divide-border">
            {initialCategories.map((c) => {
              const CatIcon = getPartnerCategoryIcon(c.icon);
              return (
                <li
                  key={c.id}
                  className="p-4 flex flex-wrap items-center gap-3 hover:bg-muted/20 transition-colors"
                >
                  {editingId === c.id ? (
                    <>
                      <div className="flex-1 min-w-0 space-y-3">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full min-w-[180px] px-3 py-2 rounded-xl border border-border bg-background text-foreground font-medium"
                          placeholder="Kategoriename"
                          autoFocus
                        />
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-xs font-semibold text-muted-foreground mr-2">Symbol:</span>
                          {PARTNER_CATEGORY_ICON_NAMES.map((name) => {
                            const Icon = getPartnerCategoryIcon(name);
                            const selected = editIcon === name;
                            return (
                              <button
                                key={name}
                                type="button"
                                onClick={() => setEditIcon(name)}
                                className={`p-2 rounded-lg border transition-colors ${selected ? "bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] border-[#1a3826] dark:border-[#FFC72C]" : "border-border hover:bg-muted"}`}
                                title={name}
                              >
                                <Icon size={18} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="px-4 py-2 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white text-sm font-bold"
                        >
                          Speichern
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingId(null); setEditName(""); setEditIcon(null); }}
                          className="px-4 py-2 rounded-xl border border-border text-sm font-bold"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                        <CatIcon size={18} className="text-[#1a3826] dark:text-[#FFC72C] shrink-0" />
                        {c.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="p-2 rounded-xl border border-border hover:bg-muted"
                        title="Bearbeiten"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className="p-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        title="Löschen"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          {adding ? (
            <div className="p-4 border-t border-border space-y-4 bg-muted/20">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-border bg-background text-foreground"
                  placeholder="Name der neuen Abteilung"
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAdd}
                    className="px-4 py-2 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white text-sm font-bold"
                  >
                    Hinzufügen
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAdding(false); setNewName(""); setNewIcon(null); }}
                    className="px-4 py-2 rounded-xl border border-border text-sm font-bold"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-xs font-semibold text-muted-foreground mr-2">Symbol wählen:</span>
                {PARTNER_CATEGORY_ICON_NAMES.map((name) => {
                  const Icon = getPartnerCategoryIcon(name);
                  const selected = newIcon === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setNewIcon(name)}
                      className={`p-2 rounded-lg border transition-colors ${selected ? "bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] border-[#1a3826] dark:border-[#FFC72C]" : "border-border hover:bg-muted"}`}
                      title={name}
                    >
                      <Icon size={18} />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 border-t border-border">
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-border text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Plus size={18} /> Neue Abteilung hinzufügen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
