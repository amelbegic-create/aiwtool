/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Search,
  Plus,
  Trash2,
  Edit2,
  Settings,
  Loader2,
  X,
  List,
  Filter,
  Image as ImageIcon,
  UploadCloud,
  Video,
  Youtube,
  Paperclip,
  Eye,
  EyeOff,
  Bold,
  Italic,
  Heading1,
  Heading2,
  ListOrdered,
  List as ListIcon,
  Quote,
  Code,
  Link as LinkIcon,
  SplitSquareVertical,
} from "lucide-react";
import {
  saveRule,
  deleteRule,
  toggleRuleStatus,
  uploadFile,
  createCategory,
  deleteCategory,
  RuleFormData,
} from "@/app/actions/ruleActions";
import { useRouter } from "next/navigation";

interface AdminViewProps {
  initialRules: any[];
  categories: any[];
  restaurants: any[];
  userId: string;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function bytesToNiceSize(bytes: number) {
  if (!Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let v = bytes;
  while (v >= 1024 && idx < units.length - 1) {
    v /= 1024;
    idx++;
  }
  return `${v.toFixed(v >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

// --- super-light markdown preview (bez vanjskih biblioteka) ---
function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function mdToHtml(md: string) {
  const src = escapeHtml(md || "");

  // code blocks ``` ```
  const withCodeBlocks = src.replace(/```([\s\S]*?)```/g, (_m, code) => {
    return `<pre class="rounded-xl border border-slate-200 bg-slate-950 text-slate-50 p-4 overflow-auto text-xs leading-relaxed"><code>${code}</code></pre>`;
  });

  // inline code
  let html = withCodeBlocks.replace(/`([^`]+)`/g, `<code class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[12px] font-mono">$1</code>`);

  // headings
  html = html
    .replace(/^### (.*)$/gm, `<h3 class="text-lg font-black mt-4 mb-2">$1</h3>`)
    .replace(/^## (.*)$/gm, `<h2 class="text-xl font-black mt-5 mb-2">$1</h2>`)
    .replace(/^# (.*)$/gm, `<h1 class="text-2xl font-black mt-6 mb-3">$1</h1>`);

  // bold / italic
  html = html
    .replace(/\*\*([^\*]+)\*\*/g, `<strong class="font-black">$1</strong>`)
    .replace(/\*([^\*]+)\*/g, `<em class="italic">$1</em>`);

  // blockquote
  html = html.replace(/^> (.*)$/gm, `<blockquote class="border-l-4 border-[#1a3826] bg-[#1a3826]/5 rounded-xl px-4 py-3 my-3 text-slate-700 font-medium">$1</blockquote>`);

  // links [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, `<a class="text-[#1a3826] font-bold underline underline-offset-4" href="$2" target="_blank" rel="noreferrer">$1</a>`);

  // unordered list "- "
  html = html.replace(/^\- (.*)$/gm, `<li class="ml-5 list-disc">$1</li>`);
  // ordered list "1. "
  html = html.replace(/^\d+\. (.*)$/gm, `<li class="ml-5 list-decimal">$1</li>`);

  // wrap consecutive li into ul/ol (simple heuristic)
  html = html.replace(/(<li class="ml-5 list-disc">[\s\S]*?<\/li>)/g, `<ul class="my-3 space-y-1">$1</ul>`);
  html = html.replace(/(<li class="ml-5 list-decimal">[\s\S]*?<\/li>)/g, `<ol class="my-3 space-y-1">$1</ol>`);

  // paragraphs / line breaks
  const lines = html.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(`<div class="h-3"></div>`);
      continue;
    }
    if (
      trimmed.startsWith("<h1") ||
      trimmed.startsWith("<h2") ||
      trimmed.startsWith("<h3") ||
      trimmed.startsWith("<pre") ||
      trimmed.startsWith("<blockquote") ||
      trimmed.startsWith("<ul") ||
      trimmed.startsWith("<ol") ||
      trimmed.startsWith("<li")
    ) {
      out.push(trimmed);
      continue;
    }
    out.push(`<p class="text-slate-800 leading-relaxed font-medium">${trimmed}</p>`);
  }
  return out.join("\n");
}

// --- Markdown editor sa toolbarom + preview (bez dependency-a) ---
function MarkdownEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [split, setSplit] = useState(true);

  const applyWrap = (before: string, after = before) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);

    // restore selection
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = end + before.length;
    });
  };

  const applyLinePrefix = (prefix: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;

    const before = value.slice(0, start);
    const selection = value.slice(start, end);
    const after = value.slice(end);

    const lines = selection.length ? selection.split("\n") : [""];
    const prefixed = lines.map((l) => (l.startsWith(prefix) ? l : prefix + l)).join("\n");
    const next = before + prefixed + after;

    onChange(next);

    requestAnimationFrame(() => {
      ta.focus();
      // keep selection roughly same
      ta.selectionStart = start;
      ta.selectionEnd = start + prefixed.length;
    });
  };

  const insertAtCursor = (text: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.selectionStart = pos;
      ta.selectionEnd = pos;
    });
  };

  const addLink = () => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const selected = value.slice(start, end) || "link";
    const tpl = `[${selected}](https://)`;
    const next = value.slice(0, start) + tpl + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      // select https:// part
      const urlStart = start + tpl.indexOf("https://");
      const urlEnd = urlStart + "https://".length;
      ta.selectionStart = urlStart;
      ta.selectionEnd = urlEnd;
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyWrap("**", "**")}
            className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition text-xs font-black uppercase inline-flex items-center gap-2"
            title="Bold"
          >
            <Bold size={16} /> Bold
          </button>
          <button
            type="button"
            onClick={() => applyWrap("*", "*")}
            className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition text-xs font-black uppercase inline-flex items-center gap-2"
            title="Italic"
          >
            <Italic size={16} /> Italic
          </button>
          <button
            type="button"
            onClick={() => applyLinePrefix("# ")}
            className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition text-xs font-black uppercase inline-flex items-center gap-2"
            title="H1"
          >
            <Heading1 size={16} /> H1
          </button>
          <button
            type="button"
            onClick={() => applyLinePrefix("## ")}
            className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition text-xs font-black uppercase inline-flex items-center gap-2"
            title="H2"
          >
            <Heading2 size={16} /> H2
          </button>
          <button
            type="button"
            onClick={() => applyLinePrefix("- ")}
            className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition text-xs font-black uppercase inline-flex items-center gap-2"
            title="Bullets"
          >
            <ListIcon size={16} /> Lista
          </button>
          <button
            type="button"
            onClick={() => applyLinePrefix("1. ")}
            className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition text-xs font-black uppercase inline-flex items-center gap-2"
            title="Ordered list"
          >
            <ListOrdered size={16} /> Numer.
          </button>
          <button
            type="button"
            onClick={() => applyLinePrefix("> ")}
            className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition text-xs font-black uppercase inline-flex items-center gap-2"
            title="Quote"
          >
            <Quote size={16} /> Quote
          </button>
          <button
            type="button"
            onClick={() => applyWrap("`", "`")}
            className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition text-xs font-black uppercase inline-flex items-center gap-2"
            title="Inline code"
          >
            <Code size={16} /> Code
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor("\n``` \n\n```\n")}
            className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition text-xs font-black uppercase inline-flex items-center gap-2"
            title="Code block"
          >
            <Code size={16} /> Block
          </button>
          <button
            type="button"
            onClick={addLink}
            className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition text-xs font-black uppercase inline-flex items-center gap-2"
            title="Link"
          >
            <LinkIcon size={16} /> Link
          </button>
        </div>

        <button
          type="button"
          onClick={() => setSplit((s) => !s)}
          className={cn(
            "px-4 py-2 rounded-lg border text-xs font-black uppercase inline-flex items-center gap-2 transition",
            split
              ? "bg-[#1a3826] text-white border-[#1a3826]"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          )}
          title="Toggle split view"
        >
          <SplitSquareVertical size={16} />
          {split ? "Split" : "Editor"}
        </button>
      </div>

      {/* editor + preview */}
      <div className={cn("grid", split ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
        <div className={cn("border-slate-200", split && "lg:border-r")}>
          <div className="px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center justify-between bg-white">
            <span>Editor</span>
            <span className="text-slate-300">Markdown</span>
          </div>
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-[520px] resize-none outline-none bg-white px-4 pb-4 text-base font-medium text-slate-900 leading-relaxed"
            placeholder="Napiši pravilo… (Markdown podržan)"
          />
        </div>

        {split && (
          <div className="bg-slate-50/60">
            <div className="px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center justify-between bg-white border-b border-slate-200">
              <span>Preview</span>
              <span className="text-slate-300">Live</span>
            </div>
            <div
              className="p-5 h-[520px] overflow-auto"
              dangerouslySetInnerHTML={{ __html: mdToHtml(value || "") }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "yellow" | "red" | "blue" }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600 border-slate-200",
    green: "bg-green-50 text-green-700 border-green-200",
    yellow: "bg-[#FFC72C]/20 text-[#1a3826] border-[#FFC72C]/40",
    red: "bg-red-50 text-red-600 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return (
    <span className={cn("px-2 py-1 rounded-lg text-[10px] font-black uppercase border", tones[tone])}>
      {children}
    </span>
  );
}

function FilePills({
  items,
  onRemove,
  kind,
}: {
  items: File[];
  onRemove: (idx: number) => void;
  kind: "image" | "video" | "pdf";
}) {
  if (!items.length) return null;

  const icon =
    kind === "image" ? <ImageIcon size={14} /> : kind === "video" ? <Video size={14} /> : <Paperclip size={14} />;

  return (
    <div className="mt-3 grid gap-2">
      {items.map((f, idx) => (
        <div
          key={`${f.name}-${idx}`}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="rounded-lg bg-slate-100 p-1.5 text-slate-600">{icon}</div>
            <div className="min-w-0">
              <div className="truncate text-xs font-extrabold text-slate-800">{f.name}</div>
              <div className="text-[10px] font-bold text-slate-400">{bytesToNiceSize(f.size)}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onRemove(idx)}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 hover:bg-red-50 px-2 py-1 text-[10px] font-black uppercase text-slate-600 hover:text-red-600 transition"
            title="Ukloni"
          >
            <Trash2 size={14} />
            Ukloni
          </button>
        </div>
      ))}
    </div>
  );
}

export default function AdminView({ initialRules, categories, restaurants }: AdminViewProps) {
  const router = useRouter();

  // (ne diram funkcionalnost; ostavljam state kako je bio)
  const [rules, setRules] = useState(initialRules);

  const [viewMode, setViewMode] = useState<"TABLE" | "GRID">("TABLE");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("SVE");

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [mediaTab, setMediaTab] = useState(0);

  const initialFormState: RuleFormData = {
    title: "",
    categoryId: categories[0]?.id || "",
    priority: "INFORMATION" as any,
    content: "",
    videoUrl: "",
    pdfUrls: [],
    isGlobal: true,
    restaurantIds: [],
  };
  const [formData, setFormData] = useState<RuleFormData>(initialFormState);

  const [newImages, setNewImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<any[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [newPdfFiles, setNewPdfFiles] = useState<File[]>([]);
  const [existingPdfUrls, setExistingPdfUrls] = useState<string[]>([]);
  const [newCatName, setNewCatName] = useState("");

  // --- HANDLERS (funkcionalnost ista) ---
  const handleEdit = (rule: any) => {
    setFormData({
      id: rule.id,
      title: rule.title,
      categoryId: rule.categoryId,
      priority: rule.priority,
      content: rule.content || "",
      videoUrl: rule.videoUrl || "",
      pdfUrls: rule.pdfUrls || [],
      isGlobal: rule.isGlobal,
      restaurantIds: rule.restaurants.map((r: any) => r.restaurantId),
    });
    setExistingImages(rule.images || []);
    setExistingPdfUrls(rule.pdfUrls || []);
    setNewImages([]);
    setVideoFile(null);
    setNewPdfFiles([]);
    setIsRuleModalOpen(true);
  };

  const handleCreateNew = () => {
    setFormData({ ...initialFormState, categoryId: categories[0]?.id || "" });
    setExistingImages([]);
    setExistingPdfUrls([]);
    setNewImages([]);
    setVideoFile(null);
    setNewPdfFiles([]);
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = async () => {
    if (!formData.title || !formData.content || !formData.categoryId) return alert("Obavezno: Naslov, Kategorija, Sadržaj");

    setIsSubmitting(true);
    try {
      let finalVideoUrl = formData.videoUrl;
      const uploadedImageUrls: string[] = [];
      const allPdfUrls: string[] = [...existingPdfUrls];

      // 1. Upload Images
      if (newImages.length > 0) {
        for (const file of newImages) {
          const fd = new FormData();
          fd.append("file", file);
          const url = await uploadFile(fd);
          uploadedImageUrls.push(url);
        }
      }

      // 2. Upload Video
      if (videoFile) {
        const fd = new FormData();
        fd.append("file", videoFile);
        finalVideoUrl = await uploadFile(fd);
      }

      // 3. Upload PDFs
      if (newPdfFiles.length > 0) {
        for (const file of newPdfFiles) {
          const fd = new FormData();
          fd.append("file", file);
          const url = await uploadFile(fd);
          allPdfUrls.push(url);
        }
      }

      await saveRule(
        {
          ...formData,
          videoUrl: finalVideoUrl,
          pdfUrls: allPdfUrls,
        },
        uploadedImageUrls
      );

      setIsRuleModalOpen(false);
      router.refresh();
    } catch (e: any) {
      alert("Greška: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, current: boolean) => {
    await toggleRuleStatus(id, current);
    router.refresh();
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Sigurno obrisati?")) return;
    await deleteRule(id);
    router.refresh();
  };

  const handleAddCategory = async () => {
    if (!newCatName) return;
    try {
      await createCategory(newCatName);
      setNewCatName("");
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Brisanje kategorije?")) return;
    try {
      await deleteCategory(id);
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filteredData = useMemo(() => {
    return initialRules.filter(
      (r) => (filterCategory === "SVE" || r.categoryId === filterCategory) && r.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [initialRules, filterCategory, searchQuery]);

  const priorityTone = (p: string) => (p === "URGENT" ? "red" : p === "MANDATORY" ? "yellow" : "blue");
  const priorityLabel = (p: string) => (p === "URGENT" ? "HITNO" : p === "MANDATORY" ? "OBAVEZNO" : "INFO");

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* HEADER (isti “feel” kao tvoj vacation admin) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-200 pb-6 gap-5">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] uppercase tracking-tighter mb-2">
              ADMIN <span className="text-[#FFC72C]">PRAVILA</span>
            </h1>
            <p className="text-slate-500 text-sm font-medium">Upravljanje pravilima i medijima</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
            >
              <Settings size={16} /> KATEGORIJE
            </button>
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-5 py-2 bg-[#1a3826] text-white rounded-lg text-xs font-black transition-all hover:bg-[#142e1e]"
            >
              <Plus size={16} /> NOVO PRAVILO
            </button>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="Pretraži pravila..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none text-sm font-bold text-slate-700 w-full md:w-80"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="SVE">Sve kategorije</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode("TABLE")}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                  viewMode === "TABLE" ? "bg-[#1a3826] text-white" : "text-slate-500 hover:bg-slate-100"
                )}
              >
                <List size={16} />
                TABELA
              </button>
              <button
                onClick={() => setViewMode("GRID")}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                  viewMode === "GRID" ? "bg-[#1a3826] text-white" : "text-slate-500 hover:bg-slate-100"
                )}
              >
                <Filter size={16} />
                GRID
              </button>
            </div>

            <span className="hidden md:inline-flex text-[10px] font-black uppercase bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg text-slate-600">
              {filteredData.length} pravila
            </span>
          </div>
        </div>

        {/* LIST */}
        {viewMode === "TABLE" ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase">
              <div className="col-span-5">Naslov</div>
              <div className="col-span-3">Kategorija</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Akcije</div>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredData.map((rule) => (
                <div key={rule.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-5">
                    <div className="font-bold text-base text-slate-800">{rule.title}</div>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      <Chip tone="slate">{rule.category?.name}</Chip>
                      <Chip tone={priorityTone(rule.priority)}>{priorityLabel(rule.priority)}</Chip>
                      <Chip tone={rule.isGlobal ? "blue" : "slate"}>{rule.isGlobal ? "GLOBAL" : "ODABRANI"}</Chip>
                    </div>
                  </div>

                  <div className="col-span-3">
                    <span className="text-[11px] bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 font-bold text-slate-700">
                      {rule.category?.name}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <button
                      onClick={() => handleToggleStatus(rule.id, rule.isActive)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-[10px] font-black uppercase border transition-all inline-flex items-center gap-2",
                        rule.isActive
                          ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                          : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                      )}
                    >
                      {rule.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                      {rule.isActive ? "AKTIVNO" : "UGAŠENO"}
                    </button>
                  </div>

                  <div className="col-span-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(rule)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                        title="Uredi"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                        title="Obriši"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredData.length === 0 && (
                <div className="py-14 text-center text-slate-400 italic">Nema pravila za prikaz.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredData.map((rule) => (
              <div key={rule.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Chip tone="slate">{rule.category?.name}</Chip>
                      <Chip tone={priorityTone(rule.priority)}>{priorityLabel(rule.priority)}</Chip>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 leading-snug">{rule.title}</h3>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(rule.id, rule.isActive)}
                    className={cn(
                      "p-2 rounded-lg border transition-all",
                      rule.isActive ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-600"
                    )}
                    title="Status"
                  >
                    {rule.isActive ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 flex gap-2">
                  <button
                    onClick={() => handleEdit(rule)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-black uppercase transition-colors"
                  >
                    Uredi
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="bg-red-50 hover:bg-red-100 text-red-600 py-2.5 px-4 rounded-xl text-xs font-black uppercase transition-colors"
                    title="Obriši"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- RULE MODAL (VELIKI, MODERAN, JASAN) --- */}
        {isRuleModalOpen && (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-[1600px] h-[92vh] rounded-2xl shadow-2xl overflow-hidden border border-white/10 flex flex-col">
              {/* Modal header */}
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#1a3826] text-white flex items-center justify-center shadow">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-[#1a3826] tracking-tight">
                      {formData.id ? "Uredi pravilo" : "Novo pravilo"}
                    </h2>
                    <p className="text-sm font-medium text-slate-500">
                      Napredni editor + preview, uz isti backend i iste server actions.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsRuleModalOpen(false)}
                  className="h-10 w-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-center"
                  title="Zatvori"
                  type="button"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal body */}
              <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                {/* LEFT: Title + Editor */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-5">
                  {/* Title */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Naslov</div>
                    <input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none text-lg font-bold text-slate-800 focus:border-[#1a3826] transition"
                      placeholder="Naslov pravila"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Chip tone={formData.isGlobal ? "blue" : "slate"}>{formData.isGlobal ? "GLOBAL" : "ODABRANI"}</Chip>
                      <Chip tone={priorityTone(formData.priority as any)}>{priorityLabel(formData.priority as any)}</Chip>
                    </div>
                  </div>

                  {/* Advanced Editor + Preview */}
                  <MarkdownEditor
                    value={formData.content}
                    onChange={(v) => setFormData({ ...formData, content: v })}
                  />
                </div>

                {/* RIGHT: Settings + Media (sticky feel) */}
                <div className="w-full lg:w-[520px] overflow-y-auto bg-[#F8FAFC] border-l border-slate-200 p-6 md:p-8 space-y-5">
                  {/* Visibility */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Vidljivost</h3>
                        <p className="text-sm text-slate-500 font-medium mt-1">Globalno ili odabrani restorani.</p>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                        {formData.isGlobal ? <Eye size={18} /> : <EyeOff size={18} />}
                      </div>
                    </div>

                    <div className="mt-4 flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isGlobal: true })}
                        className={cn(
                          "flex-1 px-5 py-2.5 rounded-lg text-xs font-bold transition-all",
                          formData.isGlobal ? "bg-[#1a3826] text-white" : "text-slate-500 hover:bg-slate-50"
                        )}
                      >
                        SVI
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isGlobal: false })}
                        className={cn(
                          "flex-1 px-5 py-2.5 rounded-lg text-xs font-bold transition-all",
                          !formData.isGlobal ? "bg-[#1a3826] text-white" : "text-slate-500 hover:bg-slate-50"
                        )}
                      >
                        ODABRANI
                      </button>
                    </div>

                    {!formData.isGlobal && (
                      <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="grid grid-cols-2 gap-2">
                          {restaurants.map((r) => (
                            <label
                              key={r.id}
                              className="flex gap-2 text-sm items-center bg-white border border-slate-200 rounded-xl px-3 py-2 hover:bg-slate-50 transition"
                            >
                              <input
                                type="checkbox"
                                checked={formData.restaurantIds?.includes(r.id)}
                                onChange={(e) => {
                                  const ids = formData.restaurantIds || [];
                                  setFormData({
                                    ...formData,
                                    restaurantIds: e.target.checked ? [...ids, r.id] : ids.filter((i) => i !== r.id),
                                  });
                                }}
                                className="h-4 w-4 accent-[#1a3826]"
                              />
                              <span className="font-bold text-slate-700 truncate">{r.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Meta podaci</h3>
                        <p className="text-sm text-slate-500 font-medium mt-1">Kategorija i prioritet.</p>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                        <Settings size={18} />
                      </div>
                    </div>

                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kategorija</label>
                        <select
                          value={formData.categoryId}
                          onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                          className="mt-2 w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none text-sm font-bold text-slate-700"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prioritet</label>
                        <select
                          value={formData.priority}
                          onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                          className="mt-2 w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none text-sm font-bold text-slate-700"
                        >
                          <option value="INFORMATION">Info</option>
                          <option value="MANDATORY">Obavezno</option>
                          <option value="URGENT">Hitno</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Media (sređeno, veliko, čisto) */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Media</h3>
                        <p className="text-sm text-slate-500 font-medium mt-1">Slike / video / YouTube / PDF.</p>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                        <UploadCloud size={18} />
                      </div>
                    </div>

                    <div className="mt-4 flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                      {[
                        { t: "SLIKE", i: <ImageIcon size={16} /> },
                        { t: "VIDEO", i: <Video size={16} /> },
                        { t: "YOUTUBE", i: <Youtube size={16} /> },
                        { t: "PDF", i: <Paperclip size={16} /> },
                      ].map((x, i) => (
                        <button
                          key={x.t}
                          type="button"
                          onClick={() => setMediaTab(i)}
                          className={cn(
                            "flex-1 px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                            mediaTab === i ? "bg-[#1a3826] text-white" : "text-slate-500 hover:bg-slate-50"
                          )}
                        >
                          {x.i} {x.t}
                        </button>
                      ))}
                    </div>

                    {/* Tab content */}
                    <div className="mt-4 space-y-4">
                      {mediaTab === 0 && (
                        <>
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-black text-slate-800">Upload slika</div>
                                <div className="text-sm text-slate-500 font-medium">Odaberi više slika odjednom.</div>
                              </div>
                              <Chip tone="slate">{newImages.length} novih</Chip>
                            </div>

                            <div className="mt-4 flex items-center gap-3">
                              <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1a3826] text-white rounded-xl text-xs font-black uppercase hover:bg-[#142e1e] transition cursor-pointer">
                                <UploadCloud size={16} />
                                Odaberi slike
                                <input
                                  type="file"
                                  multiple
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => setNewImages(Array.from(e.target.files || []))}
                                />
                              </label>

                              {existingImages?.length ? <Chip tone="slate">{existingImages.length} postojeće</Chip> : null}
                            </div>
                          </div>

                          <FilePills
                            items={newImages}
                            kind="image"
                            onRemove={(idx) => setNewImages((prev) => prev.filter((_, i) => i !== idx))}
                          />

                          {existingImages?.length > 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                Postojeće slike
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {existingImages.slice(0, 12).map((img: any, idx: number) => (
                                  <div
                                    key={`${img?.url || idx}`}
                                    className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                                    title={img?.url || "image"}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={img?.url} alt="Existing" className="h-full w-full object-cover" />
                                  </div>
                                ))}
                              </div>
                              {existingImages.length > 12 && (
                                <div className="mt-2 text-xs font-medium text-slate-500">
                                  Prikaz prvih 12 / {existingImages.length}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {mediaTab === 1 && (
                        <>
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-black text-slate-800">Upload videa</div>
                                <div className="text-sm text-slate-500 font-medium">Odaberi jedan video fajl.</div>
                              </div>
                              <Chip tone="slate">{videoFile ? "1 odabran" : "0"}</Chip>
                            </div>

                            <div className="mt-4 flex items-center gap-3">
                              <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1a3826] text-white rounded-xl text-xs font-black uppercase hover:bg-[#142e1e] transition cursor-pointer">
                                <UploadCloud size={16} />
                                Odaberi video
                                <input
                                  type="file"
                                  accept="video/*"
                                  className="hidden"
                                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                                />
                              </label>

                              {videoFile ? (
                                <span className="text-sm font-bold text-slate-700 truncate max-w-[260px]">
                                  {videoFile.name} <span className="text-slate-400 font-medium">({bytesToNiceSize(videoFile.size)})</span>
                                </span>
                              ) : (
                                <span className="text-sm font-medium text-slate-500">Nije odabran video</span>
                              )}
                            </div>
                          </div>

                          {videoFile && (
                            <button
                              type="button"
                              onClick={() => setVideoFile(null)}
                              className="w-full px-4 py-3 rounded-xl bg-red-50 text-red-600 border border-red-200 font-black uppercase text-xs hover:bg-red-100 transition inline-flex items-center justify-center gap-2"
                            >
                              <Trash2 size={16} /> Ukloni video
                            </button>
                          )}
                        </>
                      )}

                      {mediaTab === 2 && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            YouTube link
                          </div>
                          <input
                            value={formData.videoUrl || ""}
                            onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none text-sm font-bold text-slate-700"
                            placeholder="https://www.youtube.com/watch?v=..."
                          />
                          <p className="mt-2 text-sm text-slate-500 font-medium">
                            Ako uneseš YouTube link, upload video fajla je opcionalan (funkcionalnost ostaje ista).
                          </p>
                        </div>
                      )}

                      {mediaTab === 3 && (
                        <>
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-black text-slate-800">Upload PDF-ova</div>
                                <div className="text-sm text-slate-500 font-medium">Može više PDF fajlova.</div>
                              </div>
                              <Chip tone="slate">{newPdfFiles.length} novih</Chip>
                            </div>

                            <div className="mt-4 flex items-center gap-3">
                              <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1a3826] text-white rounded-xl text-xs font-black uppercase hover:bg-[#142e1e] transition cursor-pointer">
                                <UploadCloud size={16} />
                                Odaberi PDF
                                <input
                                  type="file"
                                  multiple
                                  accept="application/pdf"
                                  className="hidden"
                                  onChange={(e) => setNewPdfFiles(Array.from(e.target.files || []))}
                                />
                              </label>

                              {existingPdfUrls?.length ? <Chip tone="slate">{existingPdfUrls.length} postojeće</Chip> : null}
                            </div>
                          </div>

                          <FilePills
                            items={newPdfFiles}
                            kind="pdf"
                            onRemove={(idx) => setNewPdfFiles((prev) => prev.filter((_, i) => i !== idx))}
                          />

                          {existingPdfUrls?.length > 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                Postojeći PDF
                              </div>
                              <div className="space-y-2">
                                {existingPdfUrls.slice(0, 8).map((u, idx) => (
                                  <div key={`${u}-${idx}`} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                                    <div className="min-w-0">
                                      <div className="text-sm font-bold text-slate-800">PDF #{idx + 1}</div>
                                      <div className="text-xs font-mono text-slate-500 truncate">{u}</div>
                                    </div>
                                    <a
                                      href={u}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-black uppercase text-slate-700 hover:bg-slate-100 transition"
                                    >
                                      Otvori
                                    </a>
                                  </div>
                                ))}
                                {existingPdfUrls.length > 8 && (
                                  <div className="text-xs font-medium text-slate-500">
                                    Prikaz prvih 8 / {existingPdfUrls.length}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal footer */}
              <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between gap-4">
                <div className="hidden md:block text-sm text-slate-500 font-medium">
                  Tip: koristi “Split” u editoru da odmah vidiš kako pravilo izgleda.
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsRuleModalOpen(false)}
                    className="px-5 py-3 rounded-xl border border-slate-200 bg-white text-xs font-black uppercase text-slate-700 hover:bg-slate-50 transition"
                    type="button"
                  >
                    Otkaži
                  </button>
                  <button
                    onClick={handleSaveRule}
                    disabled={isSubmitting}
                    className="px-6 py-3 rounded-xl bg-[#1a3826] text-white text-xs font-black uppercase hover:bg-[#142e1e] transition inline-flex items-center gap-2 disabled:opacity-70"
                    type="button"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <UploadCloud size={18} />}
                    Sačuvaj
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORY MODAL */}
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-black text-[#1a3826] uppercase tracking-tight">Kategorije</h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">Dodavanje i brisanje kategorija.</p>
                </div>
                <button
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="h-10 w-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-center"
                  title="Zatvori"
                  type="button"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex gap-2 mb-4">
                <input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#1a3826]"
                  placeholder="Nova kategorija..."
                />
                <button
                  onClick={handleAddCategory}
                  className="p-3 bg-[#1a3826] text-white rounded-xl hover:bg-[#142e1e] transition-colors"
                  type="button"
                  title="Dodaj"
                >
                  <Plus size={20} />
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className="flex justify-between items-center p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
                  >
                    <span className="text-sm font-bold text-slate-700">{c.name}</span>
                    <button
                      onClick={() => handleDeleteCategory(c.id)}
                      className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition"
                      type="button"
                      title="Obriši"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="w-full mt-4 py-3 bg-slate-100 rounded-xl text-xs font-black uppercase text-slate-600 hover:bg-slate-200 transition"
                type="button"
              >
                Zatvori
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
