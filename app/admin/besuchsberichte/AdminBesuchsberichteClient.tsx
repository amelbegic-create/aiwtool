"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  GripVertical,
  RefreshCw,
} from "lucide-react";
import {
  getCategories,
  getItems,
  createCategory,
  createCategoryForRestaurants,
  updateCategory,
  updateCategoryOrder,
  deleteCategory,
  createItem,
  replaceItemFile,
  deleteItem,
  getRestaurantsForBesuchsberichteAdmin,
} from "@/app/actions/visitReportActions";
import { toast } from "sonner";

const YEAR_MIN = 2021;
const YEAR_MAX = 2030;
const YEAR_OPTIONS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);

/** Accepted file types: PDF, images, Word, Excel, CSV, text */
const FILE_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv";

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
  sortOrder?: number;
  category?: { name: string; iconName: string | null };
};

function SortableDocumentRow({
  item,
  onReplace,
  onDelete,
}: {
  item: Item;
  onReplace: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/20"
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
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-foreground truncate">{item.title}</p>
          <span className="text-xs font-semibold text-muted-foreground">{item.year}</span>
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <a
          href={item.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="p-2 rounded-lg border border-border hover:bg-muted"
          title="Öffnen"
        >
          <FileText size={14} />
        </a>
        <button
          type="button"
          onClick={onReplace}
          className="p-2 rounded-lg border border-border hover:bg-muted"
          title="Datei ersetzen"
        >
          <RefreshCw size={14} />
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
      className={`flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/20 ${isDragging ? "opacity-60 bg-muted/40" : ""} ${isOver ? "ring-1 ring-inset ring-[#1a3826]/30 dark:ring-[#FFC72C]/30" : ""}`}
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
          {cat._count?.items ?? 0} Dokument(e)
        </p>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white text-sm font-medium hover:opacity-90"
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

export default function AdminBesuchsberichteClient({
  initialRestaurantId,
}: {
  initialRestaurantId: string | null;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showReplaceFileModal, setShowReplaceFileModal] = useState(false);
  const [editingItemForReplace, setEditingItemForReplace] = useState<Item | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryScope, setCategoryScope] = useState<"one" | "all" | "selected">("one");
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>([]);
  const [copyToRestaurantIds, setCopyToRestaurantIds] = useState<string[]>([]);
  const [adminRestaurants, setAdminRestaurants] = useState<{ id: string; name: string | null; code: string | null }[]>([]);

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
    getItems(selectedCategoryId, initialRestaurantId).then((list) => {
      if (!cancelled) setItems(list);
    });
    return () => { cancelled = true; };
  }, [initialRestaurantId, selectedCategoryId]);

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

  /** Restorani sortirani po broju (code), pa po nazivu */
  const sortedAdminRestaurants = useMemo(() => {
    return [...adminRestaurants].sort((a, b) => {
      const codeA = (a.code ?? "").trim();
      const codeB = (b.code ?? "").trim();
      const numA = parseInt(codeA, 10);
      const numB = parseInt(codeB, 10);
      if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
      if (!Number.isNaN(numA)) return -1;
      if (!Number.isNaN(numB)) return 1;
      return (a.name ?? codeA).localeCompare(b.name ?? codeB, "de", { numeric: true });
    });
  }, [adminRestaurants]);

  /** Za „Ordner bearbeiten”: ostali standorti (bez trenutnog) za kopiranje */
  const otherRestaurantsForCopy = useMemo(
    () => (initialRestaurantId ? sortedAdminRestaurants.filter((r) => r.id !== initialRestaurantId) : sortedAdminRestaurants),
    [sortedAdminRestaurants, initialRestaurantId]
  );

  const openCategoryModal = (cat?: Category) => {
    getRestaurantsForBesuchsberichteAdmin().then(setAdminRestaurants);
    if (cat) {
      setEditingCategory(cat);
      setCategoryName(cat.name);
      setCategoryDescription(cat.description || "");
      setCopyToRestaurantIds([]);
    } else {
      setEditingCategory(null);
      setCategoryName("");
      setCategoryDescription("");
      setCategoryScope("one");
      setSelectedRestaurantIds(initialRestaurantId ? [initialRestaurantId] : []);
      setCopyToRestaurantIds([]);
    }
    setShowCategoryModal(true);
  };

  const closeCategoryModal = () => {
    setShowCategoryModal(false);
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDescription("");
    setCopyToRestaurantIds([]);
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
        if (copyToRestaurantIds.length > 0) {
          await createCategoryForRestaurants(copyToRestaurantIds, {
            name: categoryName,
            description: categoryDescription,
            iconName: null,
          });
          toast.success(`Ordner aktualisiert und in ${copyToRestaurantIds.length} weitere Standort(e) kopiert.`);
        } else {
          toast.success("Ordner aktualisiert.");
        }
      } else {
        if (categoryScope === "all" && adminRestaurants.length > 0) {
          const ids = adminRestaurants.map((r) => r.id);
          await createCategoryForRestaurants(ids, {
            name: categoryName,
            description: categoryDescription,
            iconName: null,
          });
          toast.success(`Ordner in ${ids.length} Standort(en) erstellt.`);
        } else if (categoryScope === "selected" && selectedRestaurantIds.length > 0) {
          await createCategoryForRestaurants(selectedRestaurantIds, {
            name: categoryName,
            description: categoryDescription,
            iconName: null,
          });
          toast.success(`Ordner in ${selectedRestaurantIds.length} Standort(en) erstellt.`);
        } else if (categoryScope === "selected") {
          toast.error("Bitte wählen Sie mindestens einen Standort.");
          return;
        } else {
          await createCategory(initialRestaurantId, {
            name: categoryName,
            description: categoryDescription,
            iconName: null,
          });
          toast.success("Ordner erstellt.");
        }
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleFolderDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !initialRestaurantId) return;
      const oldIndex = categories.findIndex((c) => c.id === active.id);
      const newIndex = categories.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const reordered = [...categories];
      const [removed] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, removed);
      const orderedIds = reordered.map((c) => c.id);
      try {
        await updateCategoryOrder(initialRestaurantId, orderedIds);
        setCategories(reordered);
        toast.success("Reihenfolge gespeichert.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Fehler.");
      }
    },
    [categories, initialRestaurantId, router]
  );

  const handleItemDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !initialRestaurantId || !selectedCategoryId) return;
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const previous = [...items];
      const reordered = arrayMove(items, oldIndex, newIndex);
      setItems(reordered);
      try {
        await updateVisitReportItemOrder(initialRestaurantId, selectedCategoryId, reordered.map((i) => i.id));
        toast.success("Reihenfolge gespeichert.");
        router.refresh();
      } catch (e) {
        setItems(previous);
        toast.error(e instanceof Error ? e.message : "Reihenfolge konnte nicht gespeichert werden.");
      }
    },
    [items, initialRestaurantId, selectedCategoryId, router]
  );

  const openItemModal = () => {
    setItemTitle("");
    setItemDescription("");
    const cy = new Date().getFullYear();
    setItemYear(YEAR_OPTIONS.includes(cy) ? cy : YEAR_OPTIONS[0]);
    setItemFile(null);
    setShowItemModal(true);
  };

  const closeItemModal = () => {
    setShowItemModal(false);
    setItemTitle("");
    setItemDescription("");
    setItemFile(null);
  };

  const openReplaceFileModal = (item: Item) => {
    setEditingItemForReplace(item);
    setReplaceFile(null);
    setShowReplaceFileModal(true);
  };

  const closeReplaceFileModal = () => {
    setShowReplaceFileModal(false);
    setEditingItemForReplace(null);
    setReplaceFile(null);
  };

  const handleReplaceFile = async () => {
    if (!editingItemForReplace || !initialRestaurantId || !replaceFile) {
      toast.error("Bitte wählen Sie eine neue Datei.");
      return;
    }
    setReplacing(true);
    try {
      const fd = new FormData();
      fd.append("file", replaceFile);
      await replaceItemFile(editingItemForReplace.id, initialRestaurantId, fd);
      toast.success("Datei ersetzt.");
      closeReplaceFileModal();
      router.refresh();
      const list = await getItems(selectedCategoryId!, initialRestaurantId);
      setItems(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Ersetzen.");
    } finally {
      setReplacing(false);
    }
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
      const list = await getItems(selectedCategoryId, initialRestaurantId);
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
      const list = await getItems(selectedCategoryId!, initialRestaurantId);
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
                  <DndContext sensors={sensors} onDragEnd={handleFolderDragEnd}>
                    {categories.map((cat) => (
                      <DraggableFolderRow
                        key={cat.id}
                        cat={cat}
                        onOpen={() => setSelectedCategoryId(cat.id)}
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
                <button
                  type="button"
                  onClick={openItemModal}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white text-sm font-semibold hover:opacity-90"
                >
                  <Upload size={16} /> Hochladen
                </button>
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
              <div className="max-h-[420px] overflow-y-auto rounded-b-xl border border-t-0 border-border">
                {filteredItems.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    Keine Dokumente. &quot;Hochladen&quot; klicken.
                  </div>
                ) : searchQuery.trim() ? (
                  <div className="divide-y divide-border">
                    {filteredItems.map((t) => (
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
                            onClick={() => openReplaceFileModal(t)}
                            className="p-2 rounded-lg border border-border hover:bg-muted"
                            title="Datei ersetzen"
                          >
                            <RefreshCw size={14} />
                          </button>
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
                    ))}
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
                    <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                      <div className="divide-y divide-border">
                        {items.map((t) => (
                          <SortableDocumentRow
                            key={t.id}
                            item={t}
                            onReplace={() => openReplaceFileModal(t)}
                            onDelete={() => handleDeleteItem(t.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
          </>
        )}

        {showCategoryModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className={`bg-card rounded-xl shadow-xl border border-border w-full ${editingCategory ? "max-w-md" : "max-w-sm"}`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-bold text-foreground uppercase">
                  {editingCategory ? "Ordner bearbeiten" : "Neuer Ordner"}
                </h3>
                <button type="button" onClick={closeCategoryModal} className="text-muted-foreground hover:text-foreground">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-3">
                {!editingCategory && (
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-2">Ordner anlegen in</label>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="categoryScope"
                          checked={categoryScope === "one"}
                          onChange={() => setCategoryScope("one")}
                          className="rounded-full border-border"
                        />
                        <span className="text-sm">Nur diesen Standort</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="categoryScope"
                          checked={categoryScope === "all"}
                          onChange={() => setCategoryScope("all")}
                          className="rounded-full border-border"
                        />
                        <span className="text-sm">Alle Standorte ({adminRestaurants.length})</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="categoryScope"
                          checked={categoryScope === "selected"}
                          onChange={() => setCategoryScope("selected")}
                          className="rounded-full border-border"
                        />
                        <span className="text-sm">Ausgewählte Standorte ({selectedRestaurantIds.length}/{adminRestaurants.length})</span>
                      </label>
                      {categoryScope === "selected" && adminRestaurants.length > 0 && (
                        <div className="mt-2 pl-6 space-y-2">
                          <div className="flex gap-3 text-xs">
                            <button
                              type="button"
                              onClick={() => setSelectedRestaurantIds(sortedAdminRestaurants.map((r) => r.id))}
                              className="text-[#1a3826] dark:text-[#FFC72C] font-medium hover:underline"
                            >
                              Alle auswählen
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedRestaurantIds([])}
                              className="text-muted-foreground font-medium hover:underline"
                            >
                              Keine auswählen
                            </button>
                          </div>
                          <div className="max-h-40 overflow-y-auto border border-border rounded-lg p-2 space-y-1.5 bg-muted/20">
                            {sortedAdminRestaurants.map((r) => (
                              <label key={r.id} className="flex items-center gap-2 cursor-pointer text-sm">
                                <input
                                  type="checkbox"
                                  checked={selectedRestaurantIds.includes(r.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedRestaurantIds((prev) => [...prev, r.id]);
                                    } else {
                                      setSelectedRestaurantIds((prev) => prev.filter((id) => id !== r.id));
                                    }
                                  }}
                                  className="rounded border-border"
                                />
                                <span className="truncate">{r.name || r.code || r.id}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
                {editingCategory && otherRestaurantsForCopy.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-2">
                      Ordner zusätzlich in folgende Standorte kopieren (nur Ordner, keine Dokumente)
                    </label>
                    <div className="flex gap-3 text-xs mb-2">
                      <button
                        type="button"
                        onClick={() => setCopyToRestaurantIds(otherRestaurantsForCopy.map((r) => r.id))}
                        className="text-[#1a3826] dark:text-[#FFC72C] font-medium hover:underline"
                      >
                        Alle auswählen
                      </button>
                      <button
                        type="button"
                        onClick={() => setCopyToRestaurantIds([])}
                        className="text-muted-foreground font-medium hover:underline"
                      >
                        Keine auswählen
                      </button>
                    </div>
                    <div className="max-h-32 overflow-y-auto border border-border rounded-lg p-2 space-y-1.5 bg-muted/20">
                      {otherRestaurantsForCopy.map((r) => (
                        <label key={r.id} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={copyToRestaurantIds.includes(r.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCopyToRestaurantIds((prev) => [...prev, r.id]);
                              } else {
                                setCopyToRestaurantIds((prev) => prev.filter((id) => id !== r.id));
                              }
                            }}
                            className="rounded border-border"
                          />
                          <span className="truncate">{r.name || r.code || r.id}</span>
                        </label>
                      ))}
                    </div>
                    {copyToRestaurantIds.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {copyToRestaurantIds.length} Standort(e) ausgewählt – beim Speichern wird der Ordner dort angelegt.
                      </p>
                    )}
                  </div>
                )}
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
                  <label className="block text-xs font-semibold text-foreground mb-1">Datei * (PDF, Bilder, Word, Excel, CSV, Text)</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={FILE_ACCEPT}
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

        {showReplaceFileModal && editingItemForReplace && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-xl shadow-xl border border-border w-full max-w-md">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-bold text-foreground uppercase">Datei ersetzen</h3>
                <button type="button" onClick={closeReplaceFileModal} className="text-muted-foreground hover:text-foreground">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Dokument: <span className="font-medium text-foreground">{editingItemForReplace.title}</span>
                </p>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Neue Datei * (PDF, Bilder, Word, Excel, CSV, Text)</label>
                  <input
                    ref={replaceFileInputRef}
                    type="file"
                    accept={FILE_ACCEPT}
                    onChange={(e) => setReplaceFile(e.target.files?.[0] || null)}
                    className="w-full text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-[#1a3826] file:text-white hover:file:opacity-90"
                  />
                  {replaceFile && <p className="text-xs text-muted-foreground mt-1 truncate">{replaceFile.name}</p>}
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeReplaceFileModal}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleReplaceFile}
                  disabled={!replaceFile || replacing}
                  className="px-4 py-2 bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white rounded-lg text-sm font-semibold flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                >
                  <RefreshCw size={14} /> {replacing ? "Ersetzen…" : "Ersetzen"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
