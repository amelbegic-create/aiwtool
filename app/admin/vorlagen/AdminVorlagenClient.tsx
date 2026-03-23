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
  Users,
  Briefcase,
  DollarSign,
  FileSpreadsheet,
  Folder,
  ClipboardList,
  Award,
  Building2,
  Package,
  BookOpen,
  FileCheck,
  GraduationCap,
  Heart,
  Settings,
  Shield,
  Star,
  Truck,
  Utensils,
  Wrench,
  Calendar,
  Mail,
  Phone,
  ArrowLeft,
  GripVertical,
  FolderOpen,
} from "lucide-react";
import {
  deleteCategory,
  createCategory,
  updateCategory,
  createTemplate,
  deleteTemplate,
  searchTemplatesAdmin,
  searchTemplatesInCategory,
  updateTemplateCategoryOrder,
} from "@/app/actions/templateActions";
import { deriveTitleFromFileName } from "@/lib/extractPdfText";
import { toast } from "sonner";
import Link from "next/link";

const ICON_OPTIONS = [
  { name: "Users", component: Users },
  { name: "Briefcase", component: Briefcase },
  { name: "DollarSign", component: DollarSign },
  { name: "FileSpreadsheet", component: FileSpreadsheet },
  { name: "Folder", component: Folder },
  { name: "ClipboardList", component: ClipboardList },
  { name: "Award", component: Award },
  { name: "Building2", component: Building2 },
  { name: "Package", component: Package },
  { name: "FileText", component: FileText },
  { name: "BookOpen", component: BookOpen },
  { name: "FileCheck", component: FileCheck },
  { name: "GraduationCap", component: GraduationCap },
  { name: "Heart", component: Heart },
  { name: "Settings", component: Settings },
  { name: "Shield", component: Shield },
  { name: "Star", component: Star },
  { name: "Truck", component: Truck },
  { name: "Utensils", component: Utensils },
  { name: "Wrench", component: Wrench },
  { name: "Calendar", component: Calendar },
  { name: "Mail", component: Mail },
  { name: "Phone", component: Phone },
];

type Category = {
  id: string;
  name: string;
  description: string | null;
  iconName: string | null;
  sortOrder?: number;
  _count?: { templates: number };
};

type Template = {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: string;
  categoryId: string;
  category?: { name: string } | null;
  createdAt: Date | string;
};

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
      } ${isOver ? "ring-1 ring-inset ring-[#1a3826]/30 dark:ring-[#FFC72C]/30" : ""}`}
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
          {cat._count?.templates ?? 0} Vorlage(n)
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

export default function AdminVorlagenClient({
  initialCategories,
  initialTemplates,
}: {
  initialCategories: Category[];
  initialTemplates: Template[];
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [rootSearchQuery, setRootSearchQuery] = useState("");
  const [globalHits, setGlobalHits] = useState<Template[]>([]);
  const [folderSearchQuery, setFolderSearchQuery] = useState("");
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("");

  const [templateTitle, setTemplateTitle] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateCategoryId, setTemplateCategoryId] = useState("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  const selectedCategory = useMemo(
    () => (selectedCategoryId ? categories.find((c) => c.id === selectedCategoryId) ?? null : null),
    [categories, selectedCategoryId]
  );

  const templatesInFolder = useMemo(() => {
    if (!selectedCategoryId) return [];
    return initialTemplates.filter((t) => t.categoryId === selectedCategoryId);
  }, [initialTemplates, selectedCategoryId]);

  const [folderDisplayed, setFolderDisplayed] = useState<Template[]>([]);

  useEffect(() => {
    if (!selectedCategoryId) {
      setFolderDisplayed([]);
      return;
    }
    setFolderDisplayed(templatesInFolder);
  }, [selectedCategoryId, templatesInFolder]);

  useEffect(() => {
    if (!selectedCategoryId) return;
    const q = folderSearchQuery.trim();
    if (!q) {
      setFolderDisplayed(templatesInFolder);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      searchTemplatesInCategory(selectedCategoryId, q).then((rows) => {
        if (!cancelled) setFolderDisplayed(rows as Template[]);
      });
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [folderSearchQuery, selectedCategoryId, templatesInFolder]);

  useEffect(() => {
    if (selectedCategoryId) return;
    const q = rootSearchQuery.trim();
    if (!q) {
      setGlobalHits([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      searchTemplatesAdmin(q).then((rows) => {
        if (!cancelled) setGlobalHits(rows as Template[]);
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
        await updateTemplateCategoryOrder(orderedIds);
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
        await updateCategory(editingCategory.id, {
          name: categoryName,
          description: categoryDescription,
          iconName: categoryIcon,
        });
        toast.success("Ordner aktualisiert.");
      } else {
        await createCategory({
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
    if (!confirm("Ordner löschen? Alle Vorlagen in diesem Ordner müssen zuerst entfernt werden.")) return;
    try {
      await deleteCategory(id);
      toast.success("Ordner gelöscht.");
      if (selectedCategoryId === id) setSelectedCategoryId(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler.");
    }
  };

  const openTemplateModal = (preselectCategoryId?: string) => {
    setTemplateTitle("");
    setTemplateDescription("");
    const fallback = categories[0]?.id || "";
    setTemplateCategoryId(preselectCategoryId ?? fallback);
    setTemplateFile(null);
    setShowTemplateModal(true);
  };

  const closeTemplateModal = () => {
    setShowTemplateModal(false);
    setTemplateTitle("");
    setTemplateDescription("");
    setTemplateCategoryId("");
    setTemplateFile(null);
  };

  const handleUploadTemplate = async () => {
    if (!templateCategoryId) {
      toast.error("Ordner ist erforderlich.");
      return;
    }
    if (!templateFile) {
      toast.error("Datei ist erforderlich.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("title", templateTitle.trim());
      fd.append("description", templateDescription);
      fd.append("categoryId", templateCategoryId);
      fd.append("file", templateFile);

      await createTemplate(fd);
      toast.success("Vorlage erfolgreich hochgeladen!");
      closeTemplateModal();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Hochladen.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Vorlage löschen? Die Datei wird von Vercel Blob entfernt.")) return;
    try {
      await deleteTemplate(id);
      toast.success("Vorlage gelöscht.");
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
            <h1 className="text-2xl font-black text-[#1a3826] dark:text-[#FFC72C] tracking-tight uppercase">
              Vorlagen <span className="text-[#FFC72C] dark:text-[#e6c04a]">Verwaltung</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Ordner anlegen, öffnen und Vorlagen pro Ordner verwalten – übersichtlich auch bei vielen Dateien.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Link
              href="/admin"
              className="text-sm font-semibold text-[#1a3826] dark:text-[#FFC72C] hover:underline"
            >
              ← Zurück zur Verwaltung
            </Link>
            <button
              type="button"
              onClick={() => openTemplateModal(selectedCategoryId ?? undefined)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white text-sm font-semibold hover:opacity-90"
            >
              <Upload size={16} /> Vorlage hochladen
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
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white text-sm font-semibold hover:opacity-90"
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
                  placeholder="Alle Vorlagen durchsuchen (Titel, PDF-Text, Ordnername…)…"
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
                              className="p-2 rounded-lg border border-border hover:bg-muted text-[#1a3826] dark:text-[#FFC72C]"
                              title="Öffnen"
                            >
                              <FileText size={14} />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteTemplate(t.id)}
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
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#1a3826] dark:text-[#FFC72C] hover:underline"
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
                  onClick={() => openTemplateModal(selectedCategoryId)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white text-sm font-semibold hover:opacity-90 shrink-0"
                >
                  <Plus size={16} /> Vorlage hinzufügen
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
                    Keine Vorlagen in diesem Ordner.
                  </div>
                ) : (
                  folderDisplayed.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-[#1a3826] dark:text-[#FFC72C] shrink-0" />
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
                          className="p-2 rounded-lg border border-border hover:bg-muted text-[#1a3826] dark:text-[#FFC72C]"
                          title="Öffnen"
                        >
                          <FileText size={16} />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(t.id)}
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

      {showCategoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-[#1a3826]">
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
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm font-medium bg-background focus:ring-2 focus:ring-[#1a3826]/30 outline-none"
                  placeholder="z.B. Personal, Finanzen"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Beschreibung</label>
                <textarea
                  value={categoryDescription}
                  onChange={(e) => setCategoryDescription(e.target.value)}
                  className="w-full h-20 px-3 py-2 border border-border rounded-lg text-sm font-medium bg-background focus:ring-2 focus:ring-[#1a3826]/30 outline-none resize-none"
                  placeholder="Kurze Beschreibung…"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-2">Icon auswählen</label>
                <div className="grid grid-cols-5 gap-2">
                  {ICON_OPTIONS.map((opt) => {
                    const Icon = opt.component;
                    const isSelected = categoryIcon === opt.name;
                    return (
                      <button
                        key={opt.name}
                        type="button"
                        onClick={() => setCategoryIcon(opt.name)}
                        className={`h-12 rounded-lg border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? "border-[#1a3826] bg-[#1a3826]/10 dark:border-[#FFC72C] dark:bg-[#FFC72C]/10"
                            : "border-border hover:border-[#1a3826]/30 dark:hover:border-[#FFC72C]/30"
                        }`}
                        title={opt.name}
                      >
                        <Icon
                          size={22}
                          className={isSelected ? "text-[#1a3826] dark:text-[#FFC72C]" : "text-muted-foreground"}
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

      {showTemplateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-[#1a3826]">
              <h2 className="text-base font-black text-white uppercase">Vorlage hochladen</h2>
              <button
                type="button"
                onClick={closeTemplateModal}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Ordner *</label>
                <select
                  value={templateCategoryId}
                  onChange={(e) => setTemplateCategoryId(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm font-medium bg-background focus:ring-2 focus:ring-[#1a3826]/30 outline-none"
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
                  value={templateTitle}
                  onChange={(e) => setTemplateTitle(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm font-medium bg-background focus:ring-2 focus:ring-[#1a3826]/30 outline-none"
                  placeholder="Leer lassen = Dateiname ohne Endung"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Beschreibung</label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  className="w-full h-20 px-3 py-2 border border-border rounded-lg text-sm font-medium bg-background focus:ring-2 focus:ring-[#1a3826]/30 outline-none resize-none"
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
                    setTemplateFile(f);
                    if (f) {
                      setTemplateTitle((prev) => (prev.trim() ? prev : deriveTitleFromFileName(f.name)));
                    }
                  }}
                  className="w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#1a3826] file:text-white hover:file:bg-[#142e1e] file:cursor-pointer"
                />
                {templateFile && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ausgewählt: {templateFile.name} ({(templateFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={handleUploadTemplate}
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
