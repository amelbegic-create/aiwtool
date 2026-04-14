"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  FolderPlus,
  Upload,
  FileText,
  X,
  Save,
  Folder,
  ArrowLeft,
  GripVertical,
  FolderOpen,
  Info,
} from "lucide-react";
import * as Icons from "lucide-react";
import {
  deleteInformationCategory,
  createInformationCategory,
  updateInformationCategory,
  createInformationItem,
  deleteInformationItem,
  searchInformationAdmin,
  searchInformationInCategory,
  updateInformationCategoryOrder,
} from "@/app/actions/informationActions";
import { deriveTitleFromFileName } from "@/lib/extractPdfText";
import { INFORMATION_ICON_OPTIONS } from "@/lib/informationIconOptions";
import { toast } from "sonner";
import Link from "next/link";

type Category = {
  id: string;
  name: string;
  description: string | null;
  iconName: string | null;
  sortOrder?: number;
  _count?: { items: number };
};

type InformationItem = {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: string;
  categoryId: string;
  category?: { name: string } | null;
  createdAt: Date | string;
};

function getIconComponent(iconName: string | null) {
  if (!iconName) return Info;
  const Icon = (Icons as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[iconName];
  return Icon || Info;
}

function DraggableFolderRow({
  cat,
  onOpen,
  onEdit,
  onDelete,
}: {
  cat: Category;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: cat.id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: cat.id });
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      setDropRef(node);
    },
    [setNodeRef, setDropRef]
  );
  return (
    <div
      ref={ref}
      className={`flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/20 ${
        isDragging ? "opacity-60 bg-muted/40" : ""
      } ${isOver ? "ring-1 ring-inset ring-[#14532d]/35" : ""}`}
    >
      <span
        className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 text-muted-foreground hover:text-foreground shrink-0"
        {...listeners}
        {...attributes}
        title="Reihenfolge ändern"
      >
        <GripVertical size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground truncate">{cat.name}</p>
        {cat.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{cat.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {cat._count?.items ?? 0} Information(en)
        </p>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#14532d] text-white text-sm font-medium hover:opacity-90"
        >
          <FolderOpen size={14} /> Öffnen
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="p-2 rounded-lg border border-border hover:bg-muted"
          title="Bearbeiten"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
          title="Löschen"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function AdminInformationenClient({
  initialCategories,
  initialItems,
}: {
  initialCategories: Category[];
  initialItems: InformationItem[];
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [rootSearchQuery, setRootSearchQuery] = useState("");
  const [globalHits, setGlobalHits] = useState<InformationItem[]>([]);
  const [folderSearchQuery, setFolderSearchQuery] = useState("");
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("");

  const [itemTitle, setItemTitle] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [itemFile, setItemFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  const selectedCategory = useMemo(
    () => (selectedCategoryId ? categories.find((c) => c.id === selectedCategoryId) ?? null : null),
    [categories, selectedCategoryId]
  );

  const itemsInFolder = useMemo(() => {
    if (!selectedCategoryId) return [];
    return initialItems.filter((t) => t.categoryId === selectedCategoryId);
  }, [initialItems, selectedCategoryId]);

  const [folderDisplayed, setFolderDisplayed] = useState<InformationItem[]>([]);

  useEffect(() => {
    if (!selectedCategoryId) {
      setFolderDisplayed([]);
      return;
    }
    setFolderDisplayed(itemsInFolder);
  }, [selectedCategoryId, itemsInFolder]);

  useEffect(() => {
    if (!selectedCategoryId) return;
    const q = folderSearchQuery.trim();
    if (!q) {
      setFolderDisplayed(itemsInFolder);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      searchInformationInCategory(selectedCategoryId, q).then((rows) => {
        if (!cancelled) setFolderDisplayed(rows as InformationItem[]);
      });
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [folderSearchQuery, selectedCategoryId, itemsInFolder]);

  useEffect(() => {
    if (selectedCategoryId) return;
    const q = rootSearchQuery.trim();
    if (!q) {
      setGlobalHits([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      searchInformationAdmin(q).then((rows) => {
        if (!cancelled) setGlobalHits(rows as InformationItem[]);
      });
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [rootSearchQuery, selectedCategoryId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleFolderDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = categories.findIndex((c) => c.id === active.id);
      const newIndex = categories.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const reordered = [...categories];
      const [removed] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, removed);
      const orderedIds = reordered.map((c) => c.id);
      try {
        await updateInformationCategoryOrder(orderedIds);
        setCategories(reordered);
        toast.success("Reihenfolge gespeichert.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Fehler.");
      }
    },
    [categories, router]
  );

  const openCategoryModal = (cat?: Category) => {
    if (cat) {
      setEditingCategory(cat);
      setCategoryName(cat.name);
      setCategoryDescription(cat.description || "");
      setCategoryIcon(cat.iconName || "");
    } else {
      setEditingCategory(null);
      setCategoryName("");
      setCategoryDescription("");
      setCategoryIcon("");
    }
    setShowCategoryModal(true);
  };

  const closeCategoryModal = () => {
    setShowCategoryModal(false);
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDescription("");
    setCategoryIcon("");
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      toast.error("Name ist erforderlich.");
      return;
    }
    try {
      if (editingCategory) {
        await updateInformationCategory(editingCategory.id, {
          name: categoryName,
          description: categoryDescription,
          iconName: categoryIcon,
        });
        toast.success("Ordner aktualisiert.");
      } else {
        await createInformationCategory({
          name: categoryName,
          description: categoryDescription,
          iconName: categoryIcon,
        });
        toast.success("Ordner erstellt.");
      }
      closeCategoryModal();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler.");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Ordner löschen? Alle Informationen in diesem Ordner müssen zuerst entfernt werden.")) return;
    try {
      await deleteInformationCategory(id);
      toast.success("Ordner gelöscht.");
      if (selectedCategoryId === id) setSelectedCategoryId(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler.");
    }
  };

  const openItemModal = (preselectCategoryId?: string) => {
    setItemTitle("");
    setItemDescription("");
    const fallback = categories[0]?.id || "";
    setItemCategoryId(preselectCategoryId ?? fallback);
    setItemFile(null);
    setShowItemModal(true);
  };

  const closeItemModal = () => {
    setShowItemModal(false);
    setItemTitle("");
    setItemDescription("");
    setItemCategoryId("");
    setItemFile(null);
  };

  const handleUploadItem = async () => {
    if (!itemCategoryId) {
      toast.error("Ordner ist erforderlich.");
      return;
    }
    if (!itemFile) {
      toast.error("Datei ist erforderlich.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("title", itemTitle.trim());
      fd.append("description", itemDescription);
      fd.append("categoryId", itemCategoryId);
      fd.append("file", itemFile);

      await createInformationItem(fd);
      toast.success("Information erfolgreich hochgeladen!");
      closeItemModal();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Hochladen.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Information löschen? Die Datei wird von Vercel Blob entfernt.")) return;
    try {
      await deleteInformationItem(id);
      toast.success("Information gelöscht.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler.");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans text-foreground">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-black text-[#14532d] dark:text-green-200 tracking-tight uppercase">
              Informationen <span className="text-[#FFC72C]">Verwaltung</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Ordner anlegen und Informationsdokumente pro Ordner verwalten.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Link
              href="/admin"
              className="text-sm font-semibold text-[#14532d] dark:text-green-200 hover:underline"
            >
              ← Zurück zur Verwaltung
            </Link>
            <button
              type="button"
              onClick={() => openItemModal(selectedCategoryId ?? undefined)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#14532d] text-white text-sm font-semibold hover:opacity-90"
            >
              <Upload size={16} /> Information hochladen
            </button>
          </div>
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
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#14532d] text-white text-sm font-semibold hover:opacity-90"
                >
                  <FolderPlus size={16} /> Neuer Ordner
                </button>
              </div>
              <div className="px-4 py-2 border-b border-border flex items-center gap-2 bg-muted/10">
                <Search size={16} className="text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={rootSearchQuery}
                  onChange={(e) => setRootSearchQuery(e.target.value)}
                  placeholder="Alle Informationen durchsuchen (Titel, PDF-Text, Ordnername…)…"
                  className="bg-transparent outline-none text-sm font-medium text-foreground w-full py-2"
                />
              </div>
              {rootSearchQuery.trim() ? (
                <>
                  <p className="px-4 py-2 text-xs text-muted-foreground border-b border-border bg-muted/5">
                    Suchtreffer in allen Ordnern (max. 200)
                  </p>
                  <div className="divide-y divide-border max-h-[min(36vh,380px)] overflow-y-auto border-b border-border">
                    {globalHits.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground text-sm">Keine Treffer.</div>
                    ) : (
                      globalHits.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/20"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground truncate">{t.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {t.category?.name ?? "—"} · {t.fileType}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <a
                              href={t.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 rounded-lg border border-border hover:bg-muted text-[#14532d] dark:text-green-200"
                              title="Öffnen"
                            >
                              <FileText size={14} />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(t.id)}
                              className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              title="Löschen"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : null}
              <div className="divide-y divide-border">
                {categories.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    Noch keine Ordner. &quot;Neuer Ordner&quot; klicken.
                  </div>
                ) : (
                  <DndContext sensors={sensors} onDragEnd={handleFolderDragEnd}>
                    {categories.map((cat) => (
                      <DraggableFolderRow
                        key={cat.id}
                        cat={cat}
                        onOpen={() => {
                          setFolderSearchQuery("");
                          setSelectedCategoryId(cat.id);
                        }}
                        onEdit={() => openCategoryModal(cat)}
                        onDelete={() => handleDeleteCategory(cat.id)}
                      />
                    ))}
                  </DndContext>
                )}
              </div>
            </section>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId(null);
                  setFolderSearchQuery("");
                }}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#14532d] dark:text-green-200 hover:underline"
              >
                <ArrowLeft size={16} /> Zurück zu Ordnern
              </button>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-foreground truncate uppercase max-w-[60%]">
                  {selectedCategory?.name ?? "Ordner"}
                </h2>
                <button
                  type="button"
                  onClick={() => openItemModal(selectedCategoryId)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#14532d] text-white text-sm font-semibold hover:opacity-90 shrink-0"
                >
                  <Plus size={16} /> Information hinzufügen
                </button>
              </div>
              <div className="px-4 py-2 border-b border-border flex items-center gap-2 bg-muted/10">
                <Search size={16} className="text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={folderSearchQuery}
                  onChange={(e) => setFolderSearchQuery(e.target.value)}
                  placeholder="In diesem Ordner suchen…"
                  className="bg-transparent outline-none text-sm font-medium text-foreground w-full py-2"
                />
              </div>
              <div className="divide-y divide-border max-h-[min(70vh,800px)] overflow-y-auto">
                {folderDisplayed.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    Keine Informationen in diesem Ordner.
                  </div>
                ) : (
                  folderDisplayed.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-[#14532d] dark:text-green-200 shrink-0" />
                          <p className="font-semibold text-foreground truncate">{t.title}</p>
                        </div>
                        {t.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">{t.fileType}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <a
                          href={t.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg border border-border hover:bg-muted text-[#14532d] dark:text-green-200"
                          title="Öffnen"
                        >
                          <FileText size={16} />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(t.id)}
                          className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          title="Löschen"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Kategorie-Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-[#14532d]">
              <h2 className="text-base font-black text-white uppercase">
                {editingCategory ? "Ordner bearbeiten" : "Neuer Ordner"}
              </h2>
              <button
                type="button"
                onClick={closeCategoryModal}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Name *</label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm font-medium bg-background focus:ring-2 focus:ring-[#14532d]/25 outline-none"
                  placeholder="z.B. Dresscode, Hygiene"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Beschreibung</label>
                <textarea
                  value={categoryDescription}
                  onChange={(e) => setCategoryDescription(e.target.value)}
                  className="w-full h-20 px-3 py-2 border border-border rounded-lg text-sm font-medium bg-background focus:ring-2 focus:ring-[#14532d]/25 outline-none resize-none"
                  placeholder="Kurze Beschreibung…"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-2">Icon auswählen</label>
                <div className="grid grid-cols-8 gap-1.5 max-h-64 overflow-y-auto pr-1">
                  {INFORMATION_ICON_OPTIONS.map((opt) => {
                    const Icon = getIconComponent(opt.name);
                    const isSelected = categoryIcon === opt.name;
                    return (
                      <button
                        key={opt.name}
                        type="button"
                        onClick={() => setCategoryIcon(opt.name)}
                        className={`h-10 rounded-lg border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? "border-[#14532d] bg-[#14532d]/10 dark:border-green-500 dark:bg-green-950/30"
                            : "border-border hover:border-[#14532d]/35 dark:hover:border-green-500/50"
                        }`}
                        title={opt.name}
                      >
                        <Icon
                          size={18}
                          className={isSelected ? "text-[#14532d] dark:text-green-200" : "text-muted-foreground"}
                        />
                      </button>
                    );
                  })}
                </div>
                {categoryIcon && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Ausgewählt: <span className="font-semibold text-foreground">{categoryIcon}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={handleSaveCategory}
                className="px-5 py-2.5 bg-[#FFC72C] hover:bg-[#e6b328] text-[#1a3826] rounded-lg text-sm font-black shadow-sm flex items-center gap-2"
              >
                <Save size={16} /> Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Information-Upload-Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-[#14532d]">
              <h2 className="text-base font-black text-white uppercase">Information hochladen</h2>
              <button
                type="button"
                onClick={closeItemModal}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Ordner *</label>
                <select
                  value={itemCategoryId}
                  onChange={(e) => setItemCategoryId(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm font-medium bg-background focus:ring-2 focus:ring-[#14532d]/25 outline-none"
                >
                  <option value="">Ordner wählen…</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Titel (optional – sonst Dateiname)
                </label>
                <input
                  type="text"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm font-medium bg-background focus:ring-2 focus:ring-[#14532d]/25 outline-none"
                  placeholder="Leer lassen = Dateiname ohne Endung"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Beschreibung</label>
                <textarea
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className="w-full h-20 px-3 py-2 border border-border rounded-lg text-sm font-medium bg-background focus:ring-2 focus:ring-[#14532d]/25 outline-none resize-none"
                  placeholder="Kurze Beschreibung…"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Datei *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setItemFile(f);
                    if (f) {
                      setItemTitle((prev) => (prev.trim() ? prev : deriveTitleFromFileName(f.name)));
                    }
                  }}
                  className="w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#14532d] file:text-white hover:file:bg-[#166534] file:cursor-pointer"
                />
                {itemFile && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ausgewählt: {itemFile.name} ({(itemFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={handleUploadItem}
                disabled={uploading}
                className="px-5 py-2.5 bg-[#FFC72C] hover:bg-[#e6b328] text-[#1a3826] rounded-lg text-sm font-black shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                <Upload size={16} /> {uploading ? "Hochladen…" : "Hochladen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
