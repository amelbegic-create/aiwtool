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
import type { RulePriority } from "@prisma/client";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TiptapYoutube from "@tiptap/extension-youtube";

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

function TiptapToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  const btn = "p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-[#1a3826] hover:text-[#1a3826] transition";
  const active = "bg-[#1a3826]/10 border-[#1a3826] text-[#1a3826]";
  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-200 bg-slate-50/80 rounded-t-xl">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`${btn} ${editor.isActive("bold") ? active : ""}`}
        title="Bold"
      >
        <Bold size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`${btn} ${editor.isActive("italic") ? active : ""}`}
        title="Italic"
      >
        <Italic size={18} />
      </button>
      <span className="w-px h-6 bg-slate-200 mx-1" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`${btn} ${editor.isActive("heading", { level: 1 }) ? active : ""}`}
        title="Heading 1"
      >
        <Heading1 size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`${btn} ${editor.isActive("heading", { level: 2 }) ? active : ""}`}
        title="Heading 2"
      >
        <Heading2 size={18} />
      </button>
      <span className="w-px h-6 bg-slate-200 mx-1" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`${btn} ${editor.isActive("bulletList") ? active : ""}`}
        title="Bullet list"
      >
        <List size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`${btn} ${editor.isActive("orderedList") ? active : ""}`}
        title="Ordered list"
      >
        <ListOrdered size={18} />
      </button>
      <span className="w-px h-6 bg-slate-200 mx-1" />
      <button
        type="button"
        onClick={() => {
          const url = window.prompt("URL slike:");
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }}
        className={btn}
        title="Slika (URL)"
      >
        <ImageIcon size={18} />
      </button>
      <button
        type="button"
        onClick={() => {
          const url = window.prompt("YouTube URL:");
          if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
        }}
        className={btn}
        title="YouTube"
      >
        <Youtube size={18} />
      </button>
    </div>
  );
}

export default function RuleEditor({
  initialRule,
  categories: initialCategories,
  restaurants,
  redirectTo = "/admin/rules",
}: RuleEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialRule?.title ?? "");
  const [categoryId, setCategoryId] = useState(initialRule?.categoryId ?? initialCategories[0]?.id ?? "");
  const [priority, setPriority] = useState<RulePriority>(
    (initialRule?.priority as RulePriority) ?? "INFORMATION"
  );
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
        class: "rule-editor-prose prose prose-slate max-w-none min-h-[280px] p-4 focus:outline-none text-slate-800 cursor-text",
      },
    },
  });

  const handleCoverDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file?.type.startsWith("image/")) return;
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const url = await uploadFile(formData);
      setImageUrl(url);
    } catch (err) {
      console.error(err);
      alert("Greška pri uploadu slike.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const url = await uploadFile(formData);
      setImageUrl(url);
    } catch (err) {
      console.error(err);
      alert("Greška pri uploadu slike.");
    } finally {
      setUploadingCover(false);
    }
    e.target.value = "";
  };

  const handleImageUploadInEditor = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.set("file", file);
      const url = await uploadFile(formData);
      editor?.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      console.error(err);
      alert("Greška pri uploadu slike.");
    }
    e.target.value = "";
  }, [editor]);

  const handleGalleryAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith("image/")) return;
    setUploadingGallery(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const url = await uploadFile(formData);
      setGalleryUrls((prev) => [...prev, url]);
    } catch (err) {
      console.error(err);
      alert("Greška pri uploadu slike.");
    } finally {
      setUploadingGallery(false);
    }
    e.target.value = "";
  };

  const handlePdfAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const url = await uploadFile(formData);
      setPdfUrls((prev) => [...prev, url]);
    } catch (err) {
      console.error(err);
      alert("Greška pri uploadu PDF-a.");
    } finally {
      setUploadingPdf(false);
    }
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert("Unesite naslov.");
      return;
    }
    if (!categoryId) {
      alert("Odaberite kategoriju.");
      return;
    }
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
      toast.success(initialRule?.id ? "Pravilo ažurirano." : "Pravilo kreirano.");
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Greška pri spremanju.");
    } finally {
      setSaving(false);
    }
  };

  const toggleRestaurant = (id: string) => {
    setRestaurantIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const addCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      await createCategory(name);
      const list = await getCategories();
      setCategories(list);
      setNewCategoryName("");
      setCategoryId(list.find((c) => c.name === name)?.id ?? list[list.length - 1]?.id ?? "");
    } catch (e) {
      alert((e as Error)?.message ?? "Greška.");
    }
  };

  const removeCategory = async (id: string) => {
    try {
      await deleteCategory(id);
      const list = await getCategories();
      setCategories(list);
      if (categoryId === id) setCategoryId(list[0]?.id ?? "");
    } catch (e) {
      alert((e as Error)?.message ?? "Greška.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 pb-20">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-[#1a3826] px-6 py-5">
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">
            {initialRule ? "Uredi pravilo" : "Novo pravilo"}
          </h1>
          <p className="text-sm text-white/80 mt-1">
            {initialRule ? "Izmjena postojećeg pravila" : "Kreiranje novog pravila ili procedure"}
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lijevo: Naslov, Kategorija, Cover */}
            <div className="lg:col-span-1 space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Naslov
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Naslov pravila"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-lg font-bold text-slate-900 focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Kategorija
                </label>
                <div className="flex gap-2">
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-800 focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826] outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setCategoriesModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition shrink-0"
                    title="Dodaj novu ili ukloni kategoriju"
                  >
                    <Settings size={18} />
                    Uredi / Dodaj kategorije
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  1. Dodaj naslovnu sliku
                </label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={!imageUrl ? handleCoverDrop : undefined}
                  onClick={!imageUrl ? () => fileInputRef.current?.click() : undefined}
                  className={`border-2 border-dashed border-slate-200 rounded-xl transition relative aspect-video flex items-center justify-center overflow-hidden bg-slate-50 ${!imageUrl ? "cursor-pointer hover:border-[#1a3826]/50 hover:bg-slate-50/50 p-6" : ""}`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverSelect}
                  />
                  {uploadingCover ? (
                    <Loader2 size={28} className="animate-spin text-[#1a3826]" />
                  ) : imageUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 p-3 opacity-0 hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                          className="px-3 py-2 rounded-lg bg-white/90 text-slate-800 text-xs font-bold hover:bg-white"
                        >
                          Zamijeni sliku
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setImageUrl(null); }}
                          className="px-3 py-2 rounded-lg bg-red-500/90 text-white text-xs font-bold hover:bg-red-500"
                        >
                          Ukloni sliku
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-400 text-center p-6">
                      <UploadCloud size={36} className="mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-500">Povuci sliku ovdje ili klikni za dodavanje</p>
                    </div>
                  )}
                </div>
                {imageUrl && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-bold text-[#1a3826] hover:underline"
                    >
                      Zamijeni
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageUrl(null)}
                      className="text-xs font-bold text-red-600 hover:underline"
                    >
                      Ukloni naslovnu sliku
                    </button>
                  </div>
                )}
              </div>

              {/* Sekcija 2: Ostale slike u pravilu (galerija) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  2. Dodaj ostale slike u pravilu
                </label>
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleGalleryAdd}
                />
                {galleryUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {galleryUrls.map((url, i) => (
                      <div key={`${url}-${i}`} className="relative group">
                        <div className="w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </div>
                        <button
                          type="button"
                          onClick={() => setGalleryUrls((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-90 hover:opacity-100"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={uploadingGallery}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 disabled:opacity-50"
                >
                  {uploadingGallery ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Dodaj sliku u galeriju
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Prioritet
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as RulePriority)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-800 focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826] outline-none"
                >
                  <option value="INFORMATION">Informacija</option>
                  <option value="MANDATORY">Obavezno</option>
                  <option value="URGENT">Hitno</option>
                </select>
              </div>
            </div>

            {/* Desno: Tiptap Editor */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Sadržaj
              </label>
              <style dangerouslySetInnerHTML={{ __html: `
                .rule-editor-prose.ProseMirror,
                .rule-editor-prose .ProseMirror,
                div[contenteditable="true"].ProseMirror { cursor: text; }
                .rule-editor-prose h1,
                .ProseMirror h1 { font-size: 1.875rem; font-weight: 700; line-height: 2.25rem; margin-top: 0.75rem; margin-bottom: 0.5rem; }
                .rule-editor-prose h2,
                .ProseMirror h2 { font-size: 1.5rem; font-weight: 700; line-height: 2rem; margin-top: 0.75rem; margin-bottom: 0.5rem; }
              `}} />
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white [&_.ProseMirror]:cursor-text">
                <TiptapToolbar editor={editor} />
                <div className="flex items-center gap-1 px-2 py-1 border-b border-slate-100 bg-slate-50/50">
                  <input
                    ref={imageUploadRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUploadInEditor}
                  />
                  <button
                    type="button"
                    onClick={() => imageUploadRef.current?.click()}
                    className="text-xs font-bold text-slate-600 hover:text-[#1a3826] flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#1a3826]/10"
                  >
                    <UploadCloud size={14} /> Upload slike u sadržaj
                  </button>
                </div>
                <div className="cursor-text">
                  <EditorContent editor={editor} />
                </div>
              </div>
            </div>
          </div>

          {/* Video URL */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Video URL (opcionalno)
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826] outline-none"
            />
          </div>

          {/* PDF prilozi */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              PDF prilozi (linkovi ili upload)
            </label>
            <ul className="space-y-2 mb-2">
              {pdfUrls.map((url, i) => (
                <li
                  key={`${url}-${i}`}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <FileText size={18} className="text-red-600 shrink-0" />
                  <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-[#1a3826] truncate flex-1">
                    PDF {i + 1}
                  </a>
                  <button
                    type="button"
                    onClick={() => setPdfUrls((prev) => prev.filter((_, j) => j !== i))}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handlePdfAdd}
              />
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                disabled={uploadingPdf}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50 transition"
              >
                {uploadingPdf ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Dodaj PDF (upload)
              </button>
              <button
                type="button"
                onClick={() => {
                  const link = window.prompt("URL PDF dokumenta:");
                  if (link?.trim()) setPdfUrls((prev) => [...prev, link.trim()]);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#1a3826] text-[#1a3826] font-bold hover:bg-[#1a3826]/10 transition"
              >
                <Plus size={18} /> Dodaj link
              </button>
            </div>
          </div>

          {/* Vidljivost */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Vidljivost
            </label>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={isGlobal}
                onChange={(e) => setIsGlobal(e.target.checked)}
                className="rounded border-slate-300 text-[#1a3826] focus:ring-[#1a3826]"
              />
              <span className="font-medium text-slate-800">Globalno (svi restorani)</span>
            </label>
            {!isGlobal && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-3">
                {restaurants.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={restaurantIds.includes(r.id)}
                      onChange={() => toggleRestaurant(r.id)}
                      className="rounded border-slate-300 text-[#1a3826] focus:ring-[#1a3826]"
                    />
                    <span className="text-sm font-medium text-slate-700 truncate">
                      {r.name ?? r.id}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1a3826] text-white font-black hover:bg-[#142e1e] disabled:opacity-60 transition shadow-lg"
            >
              {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              Sačuvaj
            </button>
          </div>
        </div>
      </div>

      {categoriesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCategoriesModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-black text-slate-900">Uredi kategorije</h3>
              <button
                type="button"
                onClick={() => setCategoriesModalOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Dodaj novu kategoriju ili obriši postojeću.</p>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Naziv kategorije"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826] outline-none"
              />
              <button
                type="button"
                onClick={addCategory}
                className="px-4 py-2 rounded-xl bg-[#1a3826] text-white font-bold text-sm hover:bg-[#142e1e]"
              >
                <Plus size={18} />
              </button>
            </div>
            <ul className="space-y-2">
              {categories.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2"
                >
                  <span className="font-medium text-slate-800">{c.name}</span>
                  <button
                    type="button"
                    onClick={() => removeCategory(c.id)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
