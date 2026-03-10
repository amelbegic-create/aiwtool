"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  UploadCloud,
  Loader2,
  Save,
  X,
  Plus,
  Trash2,
  FileText,
  Settings,
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Youtube,
  Globe,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  saveRule,
  uploadFile,
  getCategories,
  createCategory,
  deleteCategory,
  type RuleFormData,
} from "@/app/actions/ruleActions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { RulePriority } from "@prisma/client";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import NextImage from "next/image";
import TiptapYoutube from "@tiptap/extension-youtube";

/* ── Client-side image resize via canvas ── */
const MAX_GALLERY = 5;
const MAX_PDF = 3;
const RESIZE_MAX_W = 1600;
const RESIZE_MAX_H = 1200;
const RESIZE_QUALITY = 0.88;

async function resizeImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      if (w <= RESIZE_MAX_W && h <= RESIZE_MAX_H) { resolve(file); return; }
      const ratio = Math.min(RESIZE_MAX_W / w, RESIZE_MAX_H / h);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
        },
        "image/jpeg",
        RESIZE_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

interface RuleEditorProps {
  initialRule?: {
    id: string;
    title: string;
    categoryId: string;
    priority: RulePriority;
    content: string | null;
    videoUrl?: string | null;
    pdfUrls: string[];
    imageUrl?: string | null;
    isGlobal: boolean;
    restaurants?: { restaurantId: string }[];
  } | null;
  categories: Array<{ id: string; name: string }>;
  restaurants: Array<{ id: string; name: string | null }>;
  redirectTo?: string;
}

/* ── Tiptap Toolbar ── */
function TiptapToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  const btn = "p-2 rounded-lg border border-border text-muted-foreground hover:bg-[#1a3826]/10 hover:border-[#1a3826]/40 hover:text-[#1a3826] transition";
  const active = "bg-[#1a3826]/15 border-[#1a3826]/50 text-[#1a3826]";
  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-border bg-muted/40">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}
        className={`${btn} ${editor.isActive("bold") ? active : ""}`} title="Fett">
        <Bold size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`${btn} ${editor.isActive("italic") ? active : ""}`} title="Kursiv">
        <Italic size={16} />
      </button>
      <span className="w-px h-5 bg-border mx-0.5" />
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`${btn} ${editor.isActive("heading", { level: 1 }) ? active : ""}`} title="Überschrift 1">
        <Heading1 size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`${btn} ${editor.isActive("heading", { level: 2 }) ? active : ""}`} title="Überschrift 2">
        <Heading2 size={16} />
      </button>
      <span className="w-px h-5 bg-border mx-0.5" />
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`${btn} ${editor.isActive("bulletList") ? active : ""}`} title="Aufzählung">
        <List size={16} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`${btn} ${editor.isActive("orderedList") ? active : ""}`} title="Nummerierte Liste">
        <ListOrdered size={16} />
      </button>
      <span className="w-px h-5 bg-border mx-0.5" />
      <button type="button"
        onClick={() => { const url = window.prompt("Bild-URL eingeben:"); if (url) editor.chain().focus().setImage({ src: url }).run(); }}
        className={btn} title="Bild per URL">
        <ImageIcon size={16} />
      </button>
      <button type="button"
        onClick={() => { const url = window.prompt("YouTube-URL eingeben:"); if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run(); }}
        className={btn} title="YouTube-Video">
        <Youtube size={16} />
      </button>
    </div>
  );
}

/* ── Field wrapper ── */
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ── Main Component ── */
export default function RuleEditor({
  initialRule,
  categories: initialCategories,
  restaurants,
  redirectTo = "/admin/rules",
}: RuleEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialRule?.title ?? "");
  const [categoryId, setCategoryId] = useState(initialRule?.categoryId ?? initialCategories[0]?.id ?? "");
  const [priority, setPriority] = useState<RulePriority>((initialRule?.priority as RulePriority) ?? "INFORMATION");
  const [videoUrl, setVideoUrl] = useState(initialRule?.videoUrl ?? "");
  const [pdfUrls, setPdfUrls] = useState<string[]>(initialRule?.pdfUrls ?? []);
  const [imageUrl, setImageUrl] = useState<string | null>(initialRule?.imageUrl ?? null);
  const [isGlobal, setIsGlobal] = useState(initialRule?.isGlobal ?? true);
  const [restaurantIds, setRestaurantIds] = useState<string[]>(
    initialRule?.restaurants?.map((r) => r.restaurantId) ?? []
  );
  const [categories, setCategories] = useState(initialCategories);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const isEdit = !!initialRule?.id;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      TiptapYoutube.configure({ width: 640, height: 360 }),
    ],
    content: initialRule?.content ?? "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "rule-editor-prose prose prose-slate max-w-none min-h-[320px] p-5 focus:outline-none text-foreground cursor-text",
      },
    },
  });

  /* ── helpers ── */
  const uploadResized = async (raw: File): Promise<string> => {
    const resized = await resizeImage(raw);
    const fd = new FormData(); fd.set("file", resized);
    return uploadFile(fd);
  };

  const handleCoverDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file?.type.startsWith("image/")) return;
    setUploadingCover(true);
    try { setImageUrl(await uploadResized(file)); }
    catch { toast.error("Fehler beim Hochladen des Bildes."); }
    finally { setUploadingCover(false); }
  };

  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try { setImageUrl(await uploadResized(file)); }
    catch { toast.error("Fehler beim Hochladen des Bildes."); }
    finally { setUploadingCover(false); e.target.value = ""; }
  };

  const handleImageUploadInEditor = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadResized(file);
      editor?.chain().focus().setImage({ src: url }).run();
    } catch { toast.error("Fehler beim Hochladen des Bildes."); }
    e.target.value = "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const handleGalleryAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (galleryUrls.length >= MAX_GALLERY) {
      toast.error(`Maximal ${MAX_GALLERY} Bilder erlaubt.`);
      e.target.value = "";
      return;
    }
    const file = e.target.files?.[0];
    if (!file?.type.startsWith("image/")) return;
    setUploadingGallery(true);
    try {
      const url = await uploadResized(file);
      setGalleryUrls((prev) => [...prev, url]);
    } catch { toast.error("Fehler beim Hochladen des Bildes."); }
    finally { setUploadingGallery(false); e.target.value = ""; }
  };

  const handlePdfAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (pdfUrls.length >= MAX_PDF) {
      toast.error(`Maximal ${MAX_PDF} PDF-Dateien erlaubt.`);
      e.target.value = "";
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    try {
      const fd = new FormData(); fd.set("file", file);
      const url = await uploadFile(fd);
      setPdfUrls((prev) => [...prev, url]);
    } catch { toast.error("Fehler beim Hochladen der PDF-Datei."); }
    finally { setUploadingPdf(false); e.target.value = ""; }
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Bitte Titel eingeben."); return; }
    if (!categoryId) { toast.error("Bitte Kategorie auswählen."); return; }
    const content = editor?.getHTML() ?? "";
    setSaving(true);
    try {
      const data: RuleFormData = {
        id: initialRule?.id,
        title: title.trim(),
        categoryId,
        priority,
        content: content.trim() || "",
        videoUrl: videoUrl.trim() || undefined,
        pdfUrls,
        imageUrl: imageUrl || undefined,
        isGlobal,
        restaurantIds: isGlobal ? [] : restaurantIds,
      };
      await saveRule(data, galleryUrls);
      toast.success("Gespeichert.");
      router.push(redirectTo);
      router.refresh();
    } catch { toast.error("Fehler beim Speichern."); }
    finally { setSaving(false); }
  };

  const toggleRestaurant = (id: string) =>
    setRestaurantIds((prev) => prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]);

  const addCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      await createCategory(name);
      const list = await getCategories();
      setCategories(list);
      setNewCategoryName("");
      setCategoryId(list.find((c) => c.name === name)?.id ?? list[list.length - 1]?.id ?? "");
      toast.success("Kategorie hinzugefügt.");
    } catch (e) { toast.error((e as Error)?.message ?? "Fehler."); }
  };

  const removeCategory = async (id: string) => {
    try {
      await deleteCategory(id);
      const list = await getCategories();
      setCategories(list);
      if (categoryId === id) setCategoryId(list[0]?.id ?? "");
    } catch (e) { toast.error((e as Error)?.message ?? "Fehler."); }
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        {/* Card */}
        <div className="rounded-2xl md:rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Card header */}
          <div className="bg-[#1a3826] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <FileText size={22} className="text-[#FFC72C]" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  {isEdit ? "Regel bearbeiten" : "Neu erstellen"}
                </h1>
                <p className="text-white/70 text-sm mt-0.5">
                  {isEdit
                    ? "Bestehendes Dokument anpassen und speichern."
                    : "Neue Bedienungsanleitung anlegen."}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-8">
            {/* ── ROW 1: Titel + Kategorie + Priorität ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Field label="Titel *">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Titel der Regel eingeben…"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-base font-bold placeholder:font-normal placeholder:text-muted-foreground focus:ring-2 focus:ring-[#1a3826]/30 focus:border-[#1a3826]/60 outline-none transition"
                  />
                </Field>
              </div>
              <div>
                <Field label="Priorität">
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as RulePriority)}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground font-medium focus:ring-2 focus:ring-[#1a3826]/30 focus:border-[#1a3826]/60 outline-none transition"
                  >
                    <option value="INFORMATION">ℹ️ Information</option>
                    <option value="MANDATORY">✅ Pflicht</option>
                    <option value="URGENT">🔴 Dringend</option>
                  </select>
                </Field>
              </div>
            </div>

            {/* ── ROW 2: Kategorie ── */}
            <Field label="Kategorie *">
              <div className="flex gap-2">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl border border-border bg-background text-foreground font-medium focus:ring-2 focus:ring-[#1a3826]/30 focus:border-[#1a3826]/60 outline-none transition"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setCategoriesModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border text-muted-foreground text-sm font-bold hover:bg-muted hover:text-foreground transition shrink-0"
                >
                  <Settings size={17} /> Kategorien
                </button>
              </div>
            </Field>

            {/* ── ROW 3: Titelbild ── */}
            <Field
              label="Titelbild"
              hint="Wird auf der Karte in der Regelübersicht angezeigt. Optional."
            >
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={!imageUrl ? handleCoverDrop : undefined}
                onClick={!imageUrl ? () => fileInputRef.current?.click() : undefined}
                className={`relative rounded-2xl border-2 overflow-hidden flex items-center justify-center transition ${
                  !imageUrl
                    ? "border-dashed border-border cursor-pointer hover:border-[#1a3826]/50 hover:bg-muted/30 aspect-video bg-muted/20"
                    : "border-transparent aspect-video"
                }`}
              >
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
                {uploadingCover ? (
                  <div className="flex flex-col items-center gap-2 p-8">
                    <Loader2 size={32} className="animate-spin text-[#1a3826]" />
                    <p className="text-sm text-muted-foreground">Wird hochgeladen…</p>
                  </div>
                ) : imageUrl ? (
                  <>
                    <NextImage src={imageUrl} alt="Titelbild" fill className="object-cover" sizes="(max-width: 768px) 100vw, 800px" />
                    <div className="absolute inset-0 bg-black/50 flex gap-3 items-center justify-center opacity-0 hover:opacity-100 transition">
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/90 text-slate-900 text-xs font-bold hover:bg-white shadow">
                        <UploadCloud size={15} /> Ersetzen
                      </button>
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); setImageUrl(null); }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/90 text-white text-xs font-bold hover:bg-red-500 shadow">
                        <X size={15} /> Entfernen
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 p-10 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-1">
                      <UploadCloud size={28} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-bold text-foreground">Bild hierher ziehen</p>
                    <p className="text-xs text-muted-foreground">oder klicken, um eine Datei auszuwählen</p>
                  </div>
                )}
              </div>
            </Field>

            {/* ── ROW 4: Inhalt (Tiptap) ── */}
            <Field label="Inhalt">
              <>
                <style dangerouslySetInnerHTML={{ __html: `
                  .rule-editor-prose h1 { font-size: 1.875rem; font-weight: 700; margin-top: 0.75rem; margin-bottom: 0.5rem; }
                  .rule-editor-prose h2 { font-size: 1.5rem; font-weight: 700; margin-top: 0.75rem; margin-bottom: 0.5rem; }
                  .rule-editor-prose ul { list-style: disc; padding-left: 1.5rem; }
                  .rule-editor-prose ol { list-style: decimal; padding-left: 1.5rem; }
                  .rule-editor-prose p { margin-bottom: 0.5rem; }
                `}} />
                <div className="rounded-2xl border border-border overflow-hidden bg-background">
                  <TiptapToolbar editor={editor} />
                  <div className="px-2 py-1 border-b border-border bg-muted/30 flex items-center gap-1">
                    <input ref={imageUploadRef} type="file" accept="image/*" className="hidden" onChange={handleImageUploadInEditor} />
                    <button type="button" onClick={() => imageUploadRef.current?.click()}
                      className="text-[11px] font-bold text-muted-foreground hover:text-[#1a3826] flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#1a3826]/10 transition">
                      <UploadCloud size={13} /> Bild in Inhalt hochladen
                    </button>
                  </div>
                  <div className="cursor-text">
                    <EditorContent editor={editor} />
                  </div>
                </div>
              </>
            </Field>

            {/* ── ROW 5: Galerie-Bilder ── */}
            <Field label="Galerie-Bilder" hint={`Zusätzliche Bilder für die Galerieansicht (max. ${MAX_GALLERY}).`}>
              <>
                <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleGalleryAdd} />
                {galleryUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {galleryUrls.map((url, i) => (
                      <div key={`${url}-${i}`} className="relative group">
                        <div className="w-20 h-20 rounded-xl overflow-hidden border border-border bg-muted relative">
                          <NextImage src={url} alt="" fill className="object-cover" sizes="80px" />
                        </div>
                        <button type="button"
                          onClick={() => setGalleryUrls((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow">
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {galleryUrls.length < MAX_GALLERY ? (
                  <button type="button" onClick={() => galleryInputRef.current?.click()} disabled={uploadingGallery}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition">
                    {uploadingGallery ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Bild hinzufügen ({galleryUrls.length}/{MAX_GALLERY})
                  </button>
                ) : (
                  <p className="text-xs font-semibold text-amber-600">
                    Maximum erreicht ({MAX_GALLERY}/{MAX_GALLERY} Bilder).
                  </p>
                )}
              </>
            </Field>

            {/* ── ROW 6: Video-URL ── */}
            <Field label="Video-URL (optional)" hint="YouTube-Link oder direkte Video-URL. Wird auf der Detailseite eingebettet.">
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Youtube size={18} />
                </div>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-[#1a3826]/30 focus:border-[#1a3826]/60 outline-none transition"
                />
              </div>
            </Field>

            {/* ── ROW 7: PDF-Anhänge ── */}
            <Field label="PDF-Anhänge" hint={`Dokumente für die Detailseite (max. ${MAX_PDF} PDFs).`}>
              <>
                <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handlePdfAdd} />
                {pdfUrls.length > 0 && (
                  <ul className="space-y-2 mb-3">
                    {pdfUrls.map((url, i) => (
                      <li key={`${url}-${i}`} className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                        <FileText size={18} className="text-red-500 shrink-0" />
                        <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-[#1a3826] truncate flex-1 hover:underline">
                          PDF {i + 1}
                        </a>
                        <button type="button" onClick={() => setPdfUrls((prev) => prev.filter((_, j) => j !== i))}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition">
                          <Trash2 size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {pdfUrls.length < MAX_PDF ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => pdfInputRef.current?.click()} disabled={uploadingPdf}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition">
                      {uploadingPdf ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      PDF hochladen ({pdfUrls.length}/{MAX_PDF})
                    </button>
                    <button type="button"
                      onClick={() => { const link = window.prompt("PDF-URL eingeben:"); if (link?.trim()) setPdfUrls((prev) => [...prev, link.trim()]); }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#1a3826]/30 text-[#1a3826] text-sm font-bold hover:bg-[#1a3826]/10 transition">
                      <Globe size={16} /> Link hinzufügen
                    </button>
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-amber-600">
                    Maximum erreicht ({MAX_PDF}/{MAX_PDF} PDFs).
                  </p>
                )}
              </>
            </Field>

            {/* ── ROW 8: Sichtbarkeit ── */}
            <Field label="Sichtbarkeit" hint={isGlobal ? "Diese Regel ist für alle Restaurants sichtbar." : "Diese Regel ist nur für ausgewählte Restaurants sichtbar."}>
              <>
                <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit">
                  <button type="button" onClick={() => setIsGlobal(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${isGlobal ? "bg-[#1a3826] text-white shadow-sm" : "text-muted-foreground hover:bg-muted/60"}`}>
                    <Globe size={15} /> Global (alle Restaurants)
                  </button>
                  <button type="button" onClick={() => setIsGlobal(false)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${!isGlobal ? "bg-[#1a3826] text-white shadow-sm" : "text-muted-foreground hover:bg-muted/60"}`}>
                    {isGlobal ? <Eye size={15} /> : <EyeOff size={15} />} Ausgewählte
                  </button>
                </div>
                {!isGlobal && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3">
                    {restaurants.map((r) => (
                      <label key={r.id} className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 hover:bg-muted transition">
                        <input type="checkbox" checked={restaurantIds.includes(r.id)} onChange={() => toggleRestaurant(r.id)}
                          className="rounded border-border text-[#1a3826] focus:ring-[#1a3826] h-4 w-4" />
                        <span className="text-sm font-medium text-foreground truncate">{r.name ?? r.id}</span>
                      </label>
                    ))}
                  </div>
                )}
              </>
            </Field>

            {/* ── Save / Cancel ── */}
            <div className="pt-4 border-t border-border flex flex-col-reverse sm:flex-row justify-end gap-3">
              <Link href="/admin/rules"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border font-bold text-muted-foreground hover:bg-muted transition">
                Abbrechen
              </Link>
              <button type="button" onClick={handleSave} disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl bg-[#1a3826] text-white font-black shadow-lg hover:opacity-90 disabled:opacity-60 transition">
                {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                {saving ? "Wird gespeichert…" : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── KATEGORIEN MODAL ── */}
      {categoriesModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl border border-border overflow-hidden">
            <div className="bg-[#1a3826] px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">Kategorien verwalten</h3>
                <p className="text-xs text-white/70 mt-0.5">Kategorien hinzufügen oder löschen.</p>
              </div>
              <button type="button" onClick={() => setCategoriesModalOpen(false)}
                className="p-2 rounded-lg text-white/70 hover:bg-white/15 transition">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCategory()}
                  placeholder="Neue Kategorie eingeben…"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-medium focus:ring-2 focus:ring-[#1a3826]/30 focus:border-[#1a3826]/60 outline-none"
                />
                <button type="button" onClick={addCategory}
                  className="px-4 py-2.5 rounded-xl bg-[#1a3826] text-white font-bold hover:opacity-90 transition">
                  <Plus size={18} />
                </button>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Noch keine Kategorien vorhanden.</p>
                ) : (
                  categories.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border hover:bg-muted/40 transition">
                      <span className="text-sm font-semibold text-foreground">{c.name}</span>
                      <button type="button" onClick={() => removeCategory(c.id)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <button type="button" onClick={() => setCategoriesModalOpen(false)}
                className="w-full py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition">
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
