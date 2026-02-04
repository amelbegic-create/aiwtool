"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  Loader2,
  Save,
  X,
  Plus,
  Trash2,
  FileText,
  Settings,
} from "lucide-react";
import {
  saveRule,
  uploadFile,
  getCategories,
  createCategory,
  deleteCategory,
  type RuleFormData,
} from "@/app/actions/ruleActions";
import { useRouter } from "next/navigation";
import type { RulePriority } from "@prisma/client";

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
  /** After save, redirect here (e.g. "/admin/rules" when used in admin). */
  redirectTo?: string;
}

export default function RuleEditor({
  initialRule,
  categories: initialCategories,
  restaurants,
  redirectTo = "/tools/rules",
}: RuleEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialRule?.title ?? "");
  const [categoryId, setCategoryId] = useState(initialRule?.categoryId ?? initialCategories[0]?.id ?? "");
  const [priority, setPriority] = useState<RulePriority>(
    (initialRule?.priority as RulePriority) ?? "INFORMATION"
  );
  const [content, setContent] = useState(initialRule?.content ?? "");
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

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
    setSaving(true);
    try {
      const data: RuleFormData = {
        id: initialRule?.id,
        title: title.trim(),
        categoryId,
        priority,
        content: content.trim(),
        videoUrl: videoUrl.trim() || undefined,
        pdfUrls,
        imageUrl: imageUrl || undefined,
        isGlobal,
        restaurantIds: isGlobal ? [] : restaurantIds,
      };
      await saveRule(data);
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
    <div className="max-w-4xl mx-auto p-6 pb-20">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-[#1a3826] px-6 py-5">
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">
            {initialRule ? "Uredi pravilo" : "Novo pravilo"}
          </h1>
          <p className="text-sm text-white/80 mt-1">
            {initialRule ? "Izmjena postojećeg pravila" : "Kreiranje novog pravila ili procedure"}
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Cover */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
              Cover slika
            </label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleCoverDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-[#1a3826]/50 hover:bg-slate-50/50 transition relative aspect-video flex items-center justify-center overflow-hidden"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverSelect}
              />
              {uploadingCover ? (
                <Loader2 size={32} className="animate-spin text-[#1a3826]" />
              ) : imageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition">
                    <UploadCloud size={24} className="text-white" />
                  </div>
                </>
              ) : (
                <div className="text-slate-400">
                  <UploadCloud size={40} className="mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-500">Povuci sliku ovdje ili klikni za upload</p>
                </div>
              )}
            </div>
          </div>

          {/* Naslov */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
              Naslov
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Naslov pravila"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg font-bold text-slate-900 focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826] outline-none"
            />
          </div>

          {/* Kategorija + Uredi kategorije */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                Kategorija
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-800 focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826] outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setCategoriesModalOpen(true)}
                className="flex items-center gap-2 px-4 py-3 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition"
              >
                <Settings size={18} />
                Uredi kategorije
              </button>
            </div>
          </div>

          {/* Video URL (opcionalno) */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
              Video URL (opcionalno)
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826] outline-none"
            />
          </div>

          {/* Prioritet */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
              Prioritet
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as RulePriority)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-800 focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826] outline-none"
            >
              <option value="INFORMATION">Informacija</option>
              <option value="MANDATORY">Obavezno</option>
              <option value="URGENT">Hitno</option>
            </select>
          </div>

          {/* Sadržaj */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
              Sadržaj
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tekst pravila (podrška za HTML ili običan tekst)"
              rows={14}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-800 focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826] outline-none resize-y"
            />
            <p className="text-xs text-slate-400 mt-1">
              Možete koristiti HTML (naslovi, bold, liste). Za bogatiji editor dodajte TipTap ili React Quill.
            </p>
          </div>

          {/* PDF prilozi */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
              PDF prilozi
            </label>
            <ul className="space-y-2 mb-2">
              {pdfUrls.map((url, i) => (
                <li
                  key={url}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
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
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50"
            >
              {uploadingPdf ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              Dodaj PDF
            </button>
          </div>

          {/* Vidljivost */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
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

          {/* Sačuvaj */}
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

      {/* Categories modal */}
      {categoriesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCategoriesModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-900">Uredi kategorije</h3>
              <button
                type="button"
                onClick={() => setCategoriesModalOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Naziv kategorije"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826] outline-none"
              />
              <button
                type="button"
                onClick={addCategory}
                className="px-4 py-2 rounded-lg bg-[#1a3826] text-white font-bold text-sm hover:bg-[#142e1e]"
              >
                <Plus size={18} />
              </button>
            </div>
            <ul className="space-y-2">
              {categories.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
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
