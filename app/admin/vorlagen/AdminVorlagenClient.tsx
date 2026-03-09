"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Search, FolderPlus, Upload, FileText, X, Save, Users, Briefcase, DollarSign, FileSpreadsheet, Folder, ClipboardList, Award, Building2, Package, BookOpen, FileCheck, GraduationCap, Heart, Settings, Shield, Star, Truck, Utensils, Wrench, Calendar, Mail, Phone } from "lucide-react";
import { deleteCategory, createCategory, updateCategory, createTemplate, deleteTemplate } from "@/app/actions/templateActions";
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

export default function AdminVorlagenClient({
  initialCategories,
  initialTemplates,
}: {
  initialCategories: Category[];
  initialTemplates: Template[];
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
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

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return initialTemplates;
    return initialTemplates.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description?.toLowerCase() ?? "").includes(q) ||
        (t.category?.name?.toLowerCase() ?? "").includes(q)
    );
  }, [initialTemplates, searchQuery]);

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
        toast.success("Kategorie aktualisiert.");
      } else {
        await createCategory({
          name: categoryName,
          description: categoryDescription,
          iconName: categoryIcon,
        });
        toast.success("Kategorie erstellt.");
      }
      closeCategoryModal();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler.");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Kategorie löschen? Alle Vorlagen in dieser Kategorie werden ebenfalls gelöscht."))
      return;
    try {
      await deleteCategory(id);
      toast.success("Kategorie gelöscht.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler.");
    }
  };

  const openTemplateModal = () => {
    setTemplateTitle("");
    setTemplateDescription("");
    setTemplateCategoryId(initialCategories[0]?.id || "");
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
    if (!templateTitle.trim()) {
      toast.error("Titel ist erforderlich.");
      return;
    }
    if (!templateCategoryId) {
      toast.error("Kategorie ist erforderlich.");
      return;
    }
    if (!templateFile) {
      toast.error("Datei ist erforderlich.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("title", templateTitle);
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
    <div className="min-h-screen bg-background p-4 md:p-10 font-sans text-foreground">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] uppercase tracking-tighter">
              VORLAGEN <span className="text-[#FFC72C]">VERWALTUNG</span>
            </h1>
            <p className="text-muted-foreground text-sm font-semibold mt-1">
              Kategorien und Dokumente für Mitarbeiter verwalten
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin"
              className="text-sm font-bold text-[#1a3826] dark:text-[#FFC72C] hover:underline"
            >
              ← Zurück zur Verwaltung
            </Link>
            <button
              type="button"
              onClick={() => openCategoryModal()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-sm font-bold"
            >
              <FolderPlus size={18} /> Neue Kategorie
            </button>
            <button
              type="button"
              onClick={openTemplateModal}
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] hover:bg-[#142e1e] dark:hover:bg-[#e0af25] text-white rounded-xl text-sm font-black shadow-md"
            >
              <Upload size={18} /> Vorlage hochladen
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="text-xl font-black text-[#1a3826] uppercase">Kategorien</h2>
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              {initialCategories.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground text-sm">
                  Keine Kategorien. Erstellen Sie eine neue Kategorie.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {initialCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-bold text-foreground">{cat.name}</p>
                        {cat.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {cat._count?.templates || 0} Vorlage(n)
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openCategoryModal(cat)}
                          className="p-2 rounded-xl border border-border hover:bg-muted"
                          title="Bearbeiten"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          title="Löschen"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-[#1a3826] uppercase">Vorlagen</h2>
            <div className="bg-card rounded-2xl border border-border flex items-center gap-3 p-3">
              <Search size={18} className="text-muted-foreground shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Vorlagen suchen…"
                className="bg-transparent outline-none text-sm font-medium text-foreground w-full"
              />
            </div>
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              {filtered.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground text-sm">
                  Keine Vorlagen gefunden.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filtered.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-[#1a3826] dark:text-[#FFC72C] shrink-0" />
                          <p className="font-semibold text-foreground truncate">{t.title}</p>
                        </div>
                        {t.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {t.category?.name || "—"} · {t.fileType}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={t.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl border border-border hover:bg-muted text-[#1a3826] dark:text-[#FFC72C]"
                          title="Öffnen"
                        >
                          <FileText size={16} />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(t.id)}
                          className="p-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          title="Löschen"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showCategoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-[#1a3826]">
              <h2 className="text-base font-black text-white uppercase">
                {editingCategory ? "Kategorie bearbeiten" : "Neue Kategorie"}
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
                  placeholder="z.B. Personal, Finanz"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Beschreibung</label>
                <textarea
                  value={categoryDescription}
                  onChange={(e) => setCategoryDescription(e.target.value)}
                  className="w-full h-20 px-3 py-2 border border-border rounded-lg text-sm font-medium bg-background focus:ring-2 focus:ring-[#1a3826]/30 outline-none resize-none"
                  placeholder="Kurze Beschreibung..."
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
                        <Icon size={22} className={isSelected ? "text-[#1a3826] dark:text-[#FFC72C]" : "text-muted-foreground"} />
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
                <label className="block text-xs font-bold text-foreground mb-1">Kategorie *</label>
                <select
                  value={templateCategoryId}
                  onChange={(e) => setTemplateCategoryId(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm font-medium bg-background focus:ring-2 focus:ring-[#1a3826]/30 outline-none"
                >
                  <option value="">Kategorie wählen...</option>
                  {initialCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Titel *</label>
                <input
                  type="text"
                  value={templateTitle}
                  onChange={(e) => setTemplateTitle(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm font-medium bg-background focus:ring-2 focus:ring-[#1a3826]/30 outline-none"
                  placeholder="z.B. Arbeitsvertrag Vorlage"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Beschreibung</label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  className="w-full h-20 px-3 py-2 border border-border rounded-lg text-sm font-medium bg-background focus:ring-2 focus:ring-[#1a3826]/30 outline-none resize-none"
                  placeholder="Kurze Beschreibung..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Datei *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
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
                <Upload size={16} /> {uploading ? "Hochladen..." : "Hochladen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
