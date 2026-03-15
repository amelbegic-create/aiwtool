"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Pencil,
  Trash2,
  Search,
  FolderPlus,
  Upload,
  FileText,
  X,
  Save,
  Folder,
  FolderOpen,
  ArrowLeft,
} from "lucide-react";
import {
  getCategories,
  getItems,
  createCategory,
  updateCategory,
  deleteCategory,
  createItem,
  deleteItem,
} from "@/app/actions/visitReportActions";
import { toast } from "sonner";

const YEAR_OPTIONS = [2026, 2027, 2028, 2029, 2030];

type Category = {
  id: string;
  name: string;
  description: string | null;
  iconName: string | null;
  _count?: { items: number };
};
type Item = {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: string;
  categoryId: string;
  year: number;
  category?: { name: string; iconName: string | null };
};

export default function AdminBesuchsberichteClient({
  initialRestaurantId,
}: {
  initialRestaurantId: string | null;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedYear, setSelectedYear] = useState(YEAR_OPTIONS.includes(new Date().getFullYear()) ? new Date().getFullYear() : 2026);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");

  const [itemTitle, setItemTitle] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemYear, setItemYear] = useState(new Date().getFullYear());
  const [itemFile, setItemFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!initialRestaurantId) return;
    let cancelled = false;
    getCategories(initialRestaurantId).then((cats) => {
      if (!cancelled) setCategories(cats);
    });
    return () => { cancelled = true; };
  }, [initialRestaurantId]);

  useEffect(() => {
    if (!initialRestaurantId || !selectedCategoryId) {
      setItems([]);
      return;
    }
    let cancelled = false;
    const y = YEAR_OPTIONS.includes(selectedYear) ? selectedYear : YEAR_OPTIONS[0];
    getItems(selectedCategoryId, y, initialRestaurantId).then((list) => {
      if (!cancelled) setItems(list);
    });
    return () => { cancelled = true; };
  }, [initialRestaurantId, selectedCategoryId, selectedYear]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description?.toLowerCase() ?? "").includes(q) ||
        String(t.year).includes(q)
    );
  }, [items, searchQuery]);

  const selectedCategory = selectedCategoryId ? categories.find((c) => c.id === selectedCategoryId) : null;

  const openCategoryModal = (cat?: Category) => {
    if (cat) {
      setEditingCategory(cat);
      setCategoryName(cat.name);
      setCategoryDescription(cat.description || "");
    } else {
      setEditingCategory(null);
      setCategoryName("");
      setCategoryDescription("");
    }
    setShowCategoryModal(true);
  };

  const closeCategoryModal = () => {
    setShowCategoryModal(false);
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDescription("");
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      toast.error("Name ist erforderlich.");
      return;
    }
    if (!initialRestaurantId) return;
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, initialRestaurantId, {
          name: categoryName,
          description: categoryDescription,
          iconName: null,
        });
        toast.success("Ordner aktualisiert.");
      } else {
        await createCategory(initialRestaurantId, {
          name: categoryName,
          description: categoryDescription,
          iconName: null,
        });
        toast.success("Ordner erstellt.");
      }
      closeCategoryModal();
      router.refresh();
      const cats = await getCategories(initialRestaurantId);
      setCategories(cats);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler.");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Ordner löschen? Alle Dokumente darin werden ebenfalls gelöscht.")) return;
    if (!initialRestaurantId) return;
    try {
      await deleteCategory(id, initialRestaurantId);
      toast.success("Ordner gelöscht.");
      if (selectedCategoryId === id) setSelectedCategoryId(null);
      router.refresh();
      const cats = await getCategories(initialRestaurantId);
      setCategories(cats);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler.");
    }
  };

  const openItemModal = () => {
    setItemTitle("");
    setItemDescription("");
    setItemYear(YEAR_OPTIONS.includes(selectedYear) ? selectedYear : YEAR_OPTIONS[0]);
    setItemFile(null);
    setShowItemModal(true);
  };

  const closeItemModal = () => {
    setShowItemModal(false);
    setItemTitle("");
    setItemDescription("");
    setItemFile(null);
  };

  const handleUploadItem = async () => {
    if (!itemTitle.trim()) {
      toast.error("Titel ist erforderlich.");
      return;
    }
    if (!selectedCategoryId || !initialRestaurantId) return;
    if (!itemFile) {
      toast.error("Datei ist erforderlich.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("restaurantId", initialRestaurantId);
      fd.append("categoryId", selectedCategoryId);
      fd.append("year", String(itemYear));
      fd.append("title", itemTitle);
      fd.append("description", itemDescription);
      fd.append("file", itemFile);
      await createItem(fd);
      toast.success("Dokument hochgeladen.");
      closeItemModal();
      router.refresh();
      const y = YEAR_OPTIONS.includes(selectedYear) ? selectedYear : YEAR_OPTIONS[0];
      const list = await getItems(selectedCategoryId, y, initialRestaurantId);
      setItems(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Hochladen.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Dokument löschen?")) return;
    if (!initialRestaurantId) return;
    try {
      await deleteItem(id, initialRestaurantId);
      toast.success("Dokument gelöscht.");
      router.refresh();
      const y = YEAR_OPTIONS.includes(selectedYear) ? selectedYear : YEAR_OPTIONS[0];
      const list = await getItems(selectedCategoryId!, y, initialRestaurantId);
      setItems(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler.");
    }
  };

  if (!initialRestaurantId) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8 font-sans text-foreground">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h1 className="text-2xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tight">BESUCHSBERICHTE</h1>
            <Link href="/admin" className="text-sm font-semibold text-[#1a3826] dark:text-[#FFC72C] hover:underline">
              ← Zurück
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-muted-foreground">
            <p className="font-medium">Bitte in der Navigation oben einen Standort wählen.</p>
            <p className="text-sm mt-1">Der gewählte Standort bestimmt die Ordner und Dokumente.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans text-foreground">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-black text-[#1a3826] dark:text-[#FFC72C] tracking-tight uppercase">
              BESUCHSBERICHTE
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Ordner anlegen, in Ordner öffnen, Dokumente pro Jahr hochladen.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm font-semibold text-[#1a3826] dark:text-[#FFC72C] hover:underline"
          >
            ← Zurück
          </Link>
        </div>

        {selectedCategoryId == null ? (
          <>
            <section className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wide">
                  <Folder size={18} /> Ordner
                </h2>
                <button
                  type="button"
                  onClick={() => openCategoryModal()}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white text-sm font-semibold hover:opacity-90"
                >
                  <FolderPlus size={16} /> Neuer Ordner
                </button>
              </div>
              <div className="divide-y divide-border">
                {categories.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    Noch keine Ordner. &quot;Neuer Ordner&quot; klicken.
                  </div>
                ) : (
                  categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/20"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground truncate">{cat.name}</p>
                        {cat.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{cat.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {cat._count?.items ?? 0} Dokument(e)
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedCategoryId(cat.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white text-sm font-medium hover:opacity-90"
                        >
                          <FolderOpen size={14} /> Öffnen
                        </button>
                        <button
                          type="button"
                          onClick={() => openCategoryModal(cat)}
                          className="p-2 rounded-lg border border-border hover:bg-muted"
                          title="Bearbeiten"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
                          title="Löschen"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
                <button
                type="button"
                onClick={() => setSelectedCategoryId(null)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#1a3826] dark:text-[#FFC72C] hover:underline"
              >
                <ArrowLeft size={16} /> Zurück zu Ordner
              </button>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-foreground truncate uppercase">
                  {selectedCategory?.name ?? "Ordner"}
                </h2>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-muted-foreground">Jahr</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                    className="h-9 px-2 border border-border rounded-lg text-sm bg-background"
                  >
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={openItemModal}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white text-sm font-semibold hover:opacity-90"
                  >
                    <Upload size={16} /> Hochladen
                  </button>
                </div>
              </div>
              <div className="p-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Search size={16} className="text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Dokumente suchen…"
                    className="bg-transparent outline-none text-sm w-full"
                  />
                </div>
              </div>
              <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
                {filteredItems.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    Keine Dokumente für {selectedYear}. &quot;Hochladen&quot; klicken.
                  </div>
                ) : (
                  filteredItems.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/20"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground truncate">{t.title}</p>
                          <span className="text-xs font-semibold text-muted-foreground">{t.year}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <a
                          href={t.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg border border-border hover:bg-muted"
                          title="Öffnen"
                        >
                          <FileText size={14} />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(t.id)}
                          className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
                          title="Löschen"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {showCategoryModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-xl shadow-xl border border-border w-full max-w-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-bold text-foreground uppercase">
                  {editingCategory ? "Ordner bearbeiten" : "Neuer Ordner"}
                </h3>
                <button type="button" onClick={closeCategoryModal} className="text-muted-foreground hover:text-foreground">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Name *</label>
                  <input
                    type="text"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    className="w-full h-9 px-3 border border-border rounded-lg text-sm bg-background focus:ring-2 focus:ring-[#1a3826]/30 outline-none"
                    placeholder="z.B. Besuchsberichte 2026"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Beschreibung (optional)</label>
                  <input
                    type="text"
                    value={categoryDescription}
                    onChange={(e) => setCategoryDescription(e.target.value)}
                    className="w-full h-9 px-3 border border-border rounded-lg text-sm bg-background focus:ring-2 focus:ring-[#1a3826]/30 outline-none"
                    placeholder="Kurzbeschreibung"
                  />
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveCategory}
                  className="px-4 py-2 bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white rounded-lg text-sm font-semibold flex items-center gap-2 hover:opacity-90"
                >
                  <Save size={14} /> Speichern
                </button>
              </div>
            </div>
          </div>
        )}

        {showItemModal && selectedCategoryId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-xl shadow-xl border border-border w-full max-w-md">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-bold text-foreground uppercase">Dokument hochladen</h3>
                <button type="button" onClick={closeItemModal} className="text-muted-foreground hover:text-foreground">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Jahr *</label>
                  <select
                    value={itemYear}
                    onChange={(e) => setItemYear(parseInt(e.target.value, 10))}
                    className="w-full h-9 px-3 border border-border rounded-lg text-sm bg-background"
                  >
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Titel *</label>
                  <input
                    type="text"
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                    className="w-full h-9 px-3 border border-border rounded-lg text-sm bg-background focus:ring-2 focus:ring-[#1a3826]/30 outline-none"
                    placeholder="z.B. Bericht März 2026"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Beschreibung (optional)</label>
                  <input
                    type="text"
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    className="w-full h-9 px-3 border border-border rounded-lg text-sm bg-background focus:ring-2 focus:ring-[#1a3826]/30 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Datei *</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => setItemFile(e.target.files?.[0] || null)}
                    className="w-full text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-[#1a3826] file:text-white hover:file:opacity-90"
                  />
                  {itemFile && <p className="text-xs text-muted-foreground mt-1 truncate">{itemFile.name}</p>}
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end">
                <button
                  type="button"
                  onClick={handleUploadItem}
                  disabled={uploading}
                  className="px-4 py-2 bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white rounded-lg text-sm font-semibold flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                >
                  <Upload size={14} /> {uploading ? "Lädt…" : "Hochladen"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
