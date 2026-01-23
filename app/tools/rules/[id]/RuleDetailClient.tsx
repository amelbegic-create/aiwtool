/* eslint-disable @typescript-eslint/no-explicit-any */
// app/tools/rules/[id]/RuleDetailClient.tsx
"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Download,
  PlayCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import Link from "next/link";
import { markRuleAsRead } from "@/app/actions/ruleActions";
import { useRouter } from "next/navigation";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const fmtDate = (d: string | Date) =>
  new Intl.DateTimeFormat("bs-BA", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(d));

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// light markdown preview (bez vanjskih libova)
function mdToHtml(md: string) {
  const src = escapeHtml(md || "");

  const withCodeBlocks = src.replace(/```([\s\S]*?)```/g, (_m, code) => {
    return `<pre class="rounded-2xl border border-slate-200 bg-slate-950 text-slate-50 p-5 overflow-auto text-xs leading-relaxed"><code>${code}</code></pre>`;
  });

  let html = withCodeBlocks
    .replace(
      /`([^`]+)`/g,
      `<code class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[12px] font-mono">$1</code>`
    )
    .replace(/^### (.*)$/gm, `<h3 class="text-lg font-black mt-5 mb-2">$1</h3>`)
    .replace(/^## (.*)$/gm, `<h2 class="text-xl font-black mt-6 mb-2">$1</h2>`)
    .replace(/^# (.*)$/gm, `<h1 class="text-2xl font-black mt-7 mb-3">$1</h1>`)
    .replace(/\*\*([^\*]+)\*\*/g, `<strong class="font-black">$1</strong>`)
    .replace(/\*([^\*]+)\*/g, `<em class="italic">$1</em>`)
    .replace(
      /^> (.*)$/gm,
      `<blockquote class="border-l-4 border-[#1a3826] bg-[#1a3826]/5 rounded-2xl px-5 py-4 my-4 text-slate-700 font-medium">$1</blockquote>`
    )
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
      `<a class="text-[#1a3826] font-black underline underline-offset-4" href="$2" target="_blank" rel="noreferrer">$1</a>`
    )
    .replace(/^\- (.*)$/gm, `<li class="ml-5 list-disc">$1</li>`)
    .replace(/^\d+\. (.*)$/gm, `<li class="ml-5 list-decimal">$1</li>`);

  // wrap li chunks
  html = html.replace(
    /(<li class="ml-5 list-disc">[\s\S]*?<\/li>)/g,
    `<ul class="my-3 space-y-1">$1</ul>`
  );
  html = html.replace(
    /(<li class="ml-5 list-decimal">[\s\S]*?<\/li>)/g,
    `<ol class="my-3 space-y-1">$1</ol>`
  );

  const lines = html.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      out.push(`<div class="h-3"></div>`);
      continue;
    }
    if (
      t.startsWith("<h1") ||
      t.startsWith("<h2") ||
      t.startsWith("<h3") ||
      t.startsWith("<pre") ||
      t.startsWith("<blockquote") ||
      t.startsWith("<ul") ||
      t.startsWith("<ol") ||
      t.startsWith("<li")
    ) {
      out.push(t);
      continue;
    }
    out.push(`<p class="text-slate-800 leading-relaxed font-medium">${t}</p>`);
  }
  return out.join("\n");
}

const priorityMeta = (p: string) => {
  if (p === "URGENT")
    return {
      label: "HITNO",
      chip: "bg-red-50 text-red-700 border-red-200",
      dot: "bg-red-500",
      ring: "ring-red-200",
    };
  if (p === "MANDATORY")
    return {
      label: "OBAVEZNO",
      chip: "bg-[#FFC72C]/20 text-[#1a3826] border-[#FFC72C]/40",
      dot: "bg-[#FFC72C]",
      ring: "ring-[#FFC72C]/40",
    };
  return {
    label: "INFO",
    chip: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    ring: "ring-blue-200",
  };
};

// YouTube embed normalize
function toYoutubeEmbed(url: string) {
  try {
    if (!url) return "";
    if (url.includes("youtube.com/embed/")) return url;

    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1]?.split(/[?&]/)[0];
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }

    if (url.includes("watch?v=")) {
      const id = url.split("watch?v=")[1]?.split(/[?&]/)[0];
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }

    return url;
  } catch {
    return url;
  }
}

export default function RuleDetailClient({
  rule,
  userId,
}: {
  rule: any;
  userId: string;
}) {
  const router = useRouter();
  const [isRead, setIsRead] = useState(rule.isRead);
  const [isMarking, setIsMarking] = useState(false);

  // Gallery
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const hasImages = rule.images && rule.images.length > 0;

  const pr = priorityMeta(rule.priority);

  const nextImage = () => {
    if (hasImages)
      setCurrentImageIndex((prev) => (prev + 1) % rule.images.length);
  };
  const prevImage = () => {
    if (hasImages)
      setCurrentImageIndex(
        (prev) => (prev - 1 + rule.images.length) % rule.images.length
      );
  };

  const handleRead = async () => {
    setIsMarking(true);
    await markRuleAsRead(rule.id);
    setIsRead(true);
    setIsMarking(false);
    router.refresh();
  };

  // PDFs (podržava i pdfUrls[] i pdfUrl)
  const pdfs: string[] = useMemo(() => {
    if (Array.isArray(rule.pdfUrls)) return rule.pdfUrls.filter(Boolean);
    if (rule.pdfUrl) return [rule.pdfUrl];
    return [];
  }, [rule.pdfUrls, rule.pdfUrl]);

  const youtubeEmbed = rule.videoUrl ? toYoutubeEmbed(rule.videoUrl) : "";

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans text-slate-900">
      {/* HEADER NAV */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 md:px-10 py-4 flex items-center justify-between gap-4">
          <Link
            href="/tools/rules"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-[#1a3826] font-black text-xs uppercase tracking-widest transition-colors"
          >
            <ArrowLeft size={16} /> Nazad na listu
          </Link>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border",
                pr.chip
              )}
            >
              <span
                className={cn(
                  "inline-block h-2 w-2 rounded-full mr-2 align-middle",
                  pr.dot
                )}
              />
              {pr.label}
            </span>
            <span className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border bg-slate-100 text-slate-600 border-slate-200">
              {rule.category?.name}
            </span>
          </div>
        </div>
      </div>

      {/* HERO */}
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 pt-8">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 md:px-10 py-8 md:py-10 relative">
            {/* professional subtle background */}
            <div className="absolute -top-28 -right-28 h-64 w-64 rounded-full bg-[#FFC72C]/12 blur-3xl" />
            <div className="absolute -bottom-28 -left-28 h-64 w-64 rounded-full bg-[#1a3826]/8 blur-3xl" />

            <div className="relative">
              <div className="flex items-start justify-between gap-8 flex-col lg:flex-row">
                <div className="max-w-4xl">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                    <Sparkles size={16} className="text-[#1a3826]" />
                    Pravilo / Procedura
                  </div>

                  <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight">
                    {rule.title}
                  </h1>

                  <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-500 font-medium">
                    <span className="inline-flex items-center gap-2">
                      <Calendar size={16} className="text-slate-400" />
                      Objavljeno:{" "}
                      <span className="font-mono font-bold text-slate-700">
                        {fmtDate(rule.createdAt)}
                      </span>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-2">
                      <Clock size={16} className="text-slate-400" />
                      Izmjena:{" "}
                      <span className="font-mono font-bold text-slate-700">
                        {fmtDate(rule.updatedAt)}
                      </span>
                    </span>

                    {isRead && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="inline-flex items-center gap-2 text-emerald-700 font-bold">
                          <CheckCircle2 size={16} />
                          Pročitano
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right hero mini card */}
                <div className="w-full lg:w-[420px]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Opseg primjene
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span
                            className={cn(
                              "px-3 py-2 rounded-xl text-[10px] font-black uppercase border",
                              pr.chip
                            )}
                          >
                            {pr.label}
                          </span>
                          <span className="px-3 py-2 rounded-xl text-[10px] font-black uppercase border bg-white text-slate-700 border-slate-200">
                            {rule.isGlobal ? "GLOBAL" : "RESTORANI"}
                          </span>
                        </div>
                      </div>

                      <div className="h-12 w-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-[#1a3826]">
                        <ShieldCheck size={22} />
                      </div>
                    </div>

                    <div className="mt-4 text-sm font-medium text-slate-600 leading-relaxed">
                      Ovo pravilo je{" "}
                      <span className="font-black text-slate-800">
                        {rule.isGlobal ? "globalno važeće" : "specifično"}
                      </span>{" "}
                      {rule.isGlobal
                        ? "za sve restorane."
                        : "za odabrane restorane."}
                    </div>
                  </div>
                </div>
              </div>

              {/* quick anchors */}
              <div className="mt-6 flex flex-wrap gap-2">
                <a
                  href="#sadrzaj"
                  className="px-4 py-2.5 rounded-xl bg-[#1a3826] text-white text-xs font-black uppercase hover:bg-[#142e1e] transition inline-flex items-center gap-2"
                >
                  <Eye size={16} /> Sadržaj
                </a>
                {hasImages && (
                  <a
                    href="#galerija"
                    className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-black uppercase hover:bg-slate-50 transition inline-flex items-center gap-2"
                  >
                    <ImageIcon size={16} /> Galerija
                  </a>
                )}
                {rule.videoUrl && (
                  <a
                    href="#video"
                    className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-black uppercase hover:bg-slate-50 transition inline-flex items-center gap-2"
                  >
                    <PlayCircle size={16} /> Video
                  </a>
                )}
                {pdfs.length > 0 && (
                  <a
                    href="#dokumenti"
                    className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-black uppercase hover:bg-slate-50 transition inline-flex items-center gap-2"
                  >
                    <FileText size={16} /> Dokumenti
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 mt-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* LEFT (content) */}
        <div className="lg:col-span-8 space-y-8">
          {/* CONTENT CARD (Preview only - RAW removed) */}
          <div
            id="sadrzaj"
            className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="px-6 md:px-8 py-5 border-b border-slate-200 bg-slate-50/80">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Sadržaj
              </div>
              <div className="text-sm font-medium text-slate-500 mt-1">
                Pregled sa formatiranjem (Markdown).
              </div>
            </div>

            <div
              className="p-6 md:p-8"
              dangerouslySetInnerHTML={{ __html: mdToHtml(rule.content || "") }}
            />
          </div>

          {/* GALLERY */}
          {hasImages && (
            <div
              id="galerija"
              className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="px-6 md:px-8 py-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                    <ImageIcon size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-900 uppercase tracking-tight">
                      Galerija
                    </div>
                    <div className="text-sm font-medium text-slate-500">
                      {rule.images.length} slika
                    </div>
                  </div>
                </div>

                <div className="text-xs font-black uppercase text-slate-500 bg-white border border-slate-200 px-3 py-2 rounded-xl">
                  {currentImageIndex + 1} / {rule.images.length}
                </div>
              </div>

              <div className="p-6 md:p-8 space-y-4">
                <div
                  className={cn(
                    "relative rounded-3xl overflow-hidden border border-slate-200 bg-black shadow-lg group",
                    pr.ring,
                    "ring-0 hover:ring-4 transition-all"
                  )}
                >
                  <div className="aspect-video bg-slate-900 flex items-center justify-center">
                    <img
                      src={rule.images[currentImageIndex].url}
                      alt="Slide"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {rule.images.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-md p-3 rounded-full text-white transition-all opacity-0 group-hover:opacity-100"
                        type="button"
                        title="Prethodna"
                      >
                        <ChevronLeft size={24} />
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-md p-3 rounded-full text-white transition-all opacity-0 group-hover:opacity-100"
                        type="button"
                        title="Sljedeća"
                      >
                        <ChevronRight size={24} />
                      </button>
                    </>
                  )}

                  <div className="absolute bottom-4 left-4 bg-black/55 backdrop-blur-md text-white px-3 py-2 rounded-2xl text-xs font-black uppercase inline-flex items-center gap-2">
                    <Eye size={14} /> Pregled
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {rule.images.map((img: any, idx: number) => (
                    <button
                      key={img.id}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={cn(
                        "h-20 w-20 rounded-2xl overflow-hidden border-2 flex-shrink-0 transition-all",
                        idx === currentImageIndex
                          ? "border-[#1a3826] scale-105"
                          : "border-transparent opacity-60 hover:opacity-100"
                      )}
                      type="button"
                      title={`Slika ${idx + 1}`}
                    >
                      <img
                        src={img.url}
                        className="w-full h-full object-cover"
                        alt="Thumb"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIDEO */}
          {rule.videoUrl && (
            <div
              id="video"
              className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="px-6 md:px-8 py-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                    <PlayCircle size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-900 uppercase tracking-tight">
                      Video
                    </div>
                    <div className="text-sm font-medium text-slate-500">
                      Prilog uz pravilo
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8">
                <div
                  className={cn(
                    "aspect-video bg-black rounded-3xl overflow-hidden shadow-lg border border-slate-200",
                    pr.ring,
                    "ring-0 hover:ring-4 transition-all"
                  )}
                >
                  {rule.videoUrl.includes("youtube") ||
                  rule.videoUrl.includes("youtu.be") ? (
                    <iframe
                      src={youtubeEmbed}
                      className="w-full h-full"
                      allowFullScreen
                      title="YouTube video"
                    />
                  ) : (
                    <video
                      src={rule.videoUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* DOCUMENTS */}
          {pdfs.length > 0 && (
            <div
              id="dokumenti"
              className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="px-6 md:px-8 py-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                    <FileText size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-900 uppercase tracking-tight">
                      Dokumenti
                    </div>
                    <div className="text-sm font-medium text-slate-500">
                      {pdfs.length} prilog(a)
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8 grid gap-3">
                {pdfs.map((u, idx) => (
                  <a
                    key={`${u}-${idx}`}
                    href={u}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all group cursor-pointer"
                  >
                    <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-red-600 shadow-sm border border-slate-200 group-hover:scale-105 transition-transform">
                      <FileText size={22} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-black text-slate-800 text-sm truncate group-hover:text-[#1a3826] transition-colors">
                        PDF dokument #{idx + 1}
                      </p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Otvori / Preuzmi
                      </p>
                    </div>
                    <Download
                      size={18}
                      className="text-slate-300 group-hover:text-[#1a3826]"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT (sidebar) - STICKY WHOLE BLOCK */}
        <div className="lg:col-span-4">
          {/* One sticky container so the whole block stays visible while scrolling */}
          <div className="sticky top-24">
            {/* Make it fit viewport (so it NEVER “goes down”), and scroll inside if needed */}
            <div className="max-h-[calc(100vh-120px)] overflow-auto pr-1 space-y-6">
              {/* STATUS + NOTE (as one card, stays) */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                  Vaš status
                </h3>

                {isRead ? (
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center gap-4 text-emerald-800">
                    <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-emerald-100">
                      <CheckCircle2 size={22} />
                    </div>
                    <div>
                      <p className="font-black text-sm uppercase">Potvrđeno</p>
                      <p className="text-xs font-medium opacity-80">
                        Zabilježili smo da ste pročitali.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-900 text-sm font-medium">
                      Molimo vas da pažljivo pročitate sadržaj pravila prije potvrde.
                    </div>
                    <button
                      onClick={handleRead}
                      disabled={isMarking}
                      className="w-full py-4 bg-[#1a3826] text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-[#142e1e] hover:shadow-xl transition-all active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2"
                      type="button"
                    >
                      {isMarking ? (
                        "Obrađujem..."
                      ) : (
                        <>
                          <CheckCircle2 size={18} /> Označi kao pročitano
                        </>
                      )}
                    </button>
                  </div>
                )}

                <div className="mt-5 pt-5 border-t border-slate-200">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Napomena
                  </h3>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">
                    Ovo pravilo je{" "}
                    <span className="font-black text-slate-900">
                      {rule.isGlobal ? "globalno važeće" : "specifično"}
                    </span>{" "}
                    {rule.isGlobal ? "za sve restorane." : "za odabrane restorane."}
                  </p>
                  <ul className="mt-3 text-sm text-slate-600 font-medium leading-relaxed list-disc ml-5 space-y-1">
                    <li>Nepridržavanje može rezultirati disciplinskim mjerama.</li>
                  </ul>
                </div>
              </div>

              {/* QUICK NAV */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                  Brza navigacija
                </h3>

                <div className="space-y-2">
                  <a
                    href="#sadrzaj"
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition"
                  >
                    <span className="font-black text-sm text-slate-800">
                      Sadržaj
                    </span>
                    <ChevronRightIcon className="text-slate-400" size={18} />
                  </a>

                  {hasImages && (
                    <a
                      href="#galerija"
                      className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition"
                    >
                      <span className="font-black text-sm text-slate-800">
                        Galerija
                      </span>
                      <ChevronRightIcon className="text-slate-400" size={18} />
                    </a>
                  )}

                  {rule.videoUrl && (
                    <a
                      href="#video"
                      className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition"
                    >
                      <span className="font-black text-sm text-slate-800">
                        Video
                      </span>
                      <ChevronRightIcon className="text-slate-400" size={18} />
                    </a>
                  )}

                  {pdfs.length > 0 && (
                    <a
                      href="#dokumenti"
                      className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition"
                    >
                      <span className="font-black text-sm text-slate-800">
                        Dokumenti
                      </span>
                      <ChevronRightIcon className="text-slate-400" size={18} />
                    </a>
                  )}
                </div>
              </div>

              {/* Optional: small meta (professional, minimal) */}
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 text-sm text-slate-600 font-medium">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  Sistem
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-800">MCDTool</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-mono">{userId}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="h-10" />
    </div>
  );
}
