"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  ArrowLeft, CheckCircle2, FileText, Download,
  ChevronLeft, ChevronRight, X, ZoomIn,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { markRuleAsRead } from "@/app/actions/ruleActions";
import { useRouter } from "next/navigation";
import { formatDateDDMMGGGG } from "@/lib/dateUtils";

export interface RuleDetailRule {
  id: string;
  title: string;
  content: string | null;
  videoUrl?: string | null;
  pdfUrls: string[];
  pdfUrl?: string;
  imageUrl?: string | null;
  images: Array<{ id: string; url: string }>;
  category?: { name: string } | null;
  priority?: string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
  isRead: boolean;
}

const fmtDate = (d: string | Date) => formatDateDDMMGGGG(d);

function escapeHtml(s: string) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function mdToHtml(md: string) {
  const src = escapeHtml(md || "");
  const withCodeBlocks = src.replace(/```([\s\S]*?)```/g, (_m, code) =>
    `<pre class="rounded-xl border border-border bg-slate-900 text-slate-100 p-4 overflow-auto text-sm"><code>${code}</code></pre>`
  );
  let html = withCodeBlocks
    .replace(/`([^`]+)`/g, `<code class="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">$1</code>`)
    .replace(/^### (.*)$/gm, `<h3 class="text-base font-bold mt-4 mb-1">$1</h3>`)
    .replace(/^## (.*)$/gm, `<h2 class="text-lg font-bold mt-5 mb-1">$1</h2>`)
    .replace(/^# (.*)$/gm, `<h1 class="text-xl font-bold mt-5 mb-2">$1</h1>`)
    .replace(/\*\*([^\*]+)\*\*/g, `<strong class="font-semibold">$1</strong>`)
    .replace(/\*([^\*]+)\*/g, `<em>$1</em>`)
    .replace(/^\- (.*)$/gm, `<li class="ml-4 list-disc">$1</li>`)
    .replace(/^\d+\. (.*)$/gm, `<li class="ml-4 list-decimal">$1</li>`);
  html = html.replace(/(<li class="ml-4 list-disc">[\s\S]*?<\/li>)/g, `<ul class="my-2 space-y-0.5">$1</ul>`);
  html = html.replace(/(<li class="ml-4 list-decimal">[\s\S]*?<\/li>)/g, `<ol class="my-2 space-y-0.5">$1</ol>`);
  const lines = html.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) { out.push(`<div class="h-2"></div>`); continue; }
    if (t.startsWith("<h") || t.startsWith("<pre") || t.startsWith("<ul") || t.startsWith("<ol") || t.startsWith("<li")) {
      out.push(t); continue;
    }
    out.push(`<p class="text-foreground leading-relaxed text-base">${t}</p>`);
  }
  return out.join("\n");
}

function ruleContentToHtml(content: string | null | undefined): string {
  const raw = (content || "").trim();
  if (!raw) return "";
  if (raw.startsWith("<") && (raw.includes("</p>") || raw.includes("</h") || raw.includes("<ul") || raw.includes("<ol"))) return raw;
  return mdToHtml(raw);
}

function toYoutubeEmbed(url: string) {
  try {
    if (!url) return "";
    if (url.includes("youtube.com/embed/")) return url;
    if (url.includes("youtu.be/")) { const id = url.split("youtu.be/")[1]?.split(/[?&]/)[0]; return id ? `https://www.youtube.com/embed/${id}` : url; }
    if (url.includes("watch?v=")) { const id = url.split("watch?v=")[1]?.split(/[?&]/)[0]; return id ? `https://www.youtube.com/embed/${id}` : url; }
    return url;
  } catch { return url; }
}

function pdfLabel(url: string, i: number) {
  try {
    const seg = decodeURIComponent(url.split("?")[0].split("/").filter(Boolean).pop() ?? "");
    return seg || `Dokument ${i + 1}`;
  } catch { return `Dokument ${i + 1}`; }
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ images, startIndex, onClose }: { images: Array<{ id: string; url: string }>; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + images.length) % images.length);
      else if (e.key === "ArrowRight") setIdx((i) => (i + 1) % images.length);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  return (
    <div className="fixed inset-0 z-[300] bg-black/96 flex flex-col items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <button type="button" onClick={onClose} className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition"><X size={22} /></button>
      <div className="relative w-full max-w-5xl aspect-[4/3]">
        <Image src={images[idx].url} alt="" fill className="object-contain" sizes="100vw" unoptimized={images[idx].url.includes("blob.vercel-storage.com")} />
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center"><ChevronLeft size={22} /></button>
            <button type="button" onClick={() => setIdx((i) => (i + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center"><ChevronRight size={22} /></button>
          </>
        )}
      </div>
      <p className="mt-3 text-white/40 text-sm">{idx + 1} / {images.length}</p>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto max-w-xl">
          {images.map((img, i) => (
            <button key={img.id} type="button" onClick={() => setIdx(i)} className={`relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 transition ${i === idx ? "border-[#FFC72C]" : "border-transparent opacity-40 hover:opacity-70"}`}>
              <Image src={img.url} alt="" fill className="object-cover" sizes="56px" unoptimized={img.url.includes("blob.vercel-storage.com")} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PDF Modal ────────────────────────────────────────────────────────────────
function PdfModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0 bg-[#1a3826]">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText size={18} className="text-[#FFC72C] shrink-0" />
            <span className="text-sm font-black text-white truncate">{title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <a href={url} download className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFC72C] text-[#1a3826] text-xs font-black hover:bg-amber-300 transition"><Download size={13} /> Download</a>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 min-h-0 bg-slate-100 dark:bg-slate-900">
          <iframe src={url} className="w-full h-full border-0" title={title} />
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function RuleDetailClient({ rule, userId: _userId }: { rule: RuleDetailRule; userId: string }) {
  const router = useRouter();
  const [isRead, setIsRead] = useState(rule.isRead);
  const [isMarking, setIsMarking] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfTitle, setPdfTitle] = useState("");

  useEffect(() => {
    if (!rule?.id || rule.isRead) return;
    markRuleAsRead(rule.id).then(() => { setIsRead(true); router.refresh(); }).catch(() => {});
  }, [rule?.id, rule?.isRead, router]);

  const pdfs = useMemo(() => {
    if (Array.isArray(rule.pdfUrls)) return rule.pdfUrls.filter(Boolean);
    if (rule.pdfUrl) return [rule.pdfUrl];
    return [];
  }, [rule.pdfUrls, rule.pdfUrl]);

  const hasGallery = rule.images && rule.images.length > 0;
  const youtubeEmbed = rule.videoUrl ? toYoutubeEmbed(rule.videoUrl) : "";

  const handleRead = async () => {
    setIsMarking(true);
    await markRuleAsRead(rule.id);
    setIsRead(true);
    setIsMarking(false);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background pb-20">

      {/* ── ZELENI HEADER ────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#1a3826] to-[#0f2218]">
        <div className="max-w-4xl mx-auto px-4 md:px-8">
          {/* Back row */}
          <div className="flex items-center justify-between py-4 border-b border-white/10">
            <Link href="/tools/rules" className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white transition">
              <ArrowLeft size={16} /> Zurück
            </Link>
            {rule.category?.name && (
              <span className="text-[11px] font-bold text-[#FFC72C]/80 uppercase tracking-widest">{rule.category.name}</span>
            )}
          </div>

          {/* Title + meta */}
          <div className="py-8">
            <h1 className="text-2xl md:text-4xl font-black text-white leading-tight tracking-tight">
              {rule.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-xs text-white/40">{fmtDate(rule.createdAt)}</span>
              {rule.updatedAt && <span className="text-xs text-white/40">· Aktualisiert: {fmtDate(rule.updatedAt)}</span>}
              {isRead ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
                  <CheckCircle2 size={12} /> Gelesen
                </span>
              ) : (
                <button type="button" onClick={handleRead} disabled={isMarking}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FFC72C]/15 text-[#FFC72C] text-xs font-bold border border-[#FFC72C]/30 hover:bg-[#FFC72C]/25 disabled:opacity-60 transition">
                  <CheckCircle2 size={12} />
                  {isMarking ? "…" : "Als gelesen markieren"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-8">

        {/* Beschreibung */}
        {!!(rule.content?.trim()) && (
          <div
            className="prose prose-slate max-w-none prose-p:text-foreground prose-p:text-base prose-headings:text-[#1a3826] dark:prose-headings:text-[#FFC72C] prose-headings:font-bold prose-a:text-[#1a3826] dark:prose-a:text-[#FFC72C] prose-strong:text-foreground"
            dangerouslySetInnerHTML={{ __html: ruleContentToHtml(rule.content) }}
          />
        )}

        {/* Video */}
        {rule.videoUrl && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-border bg-muted/30">
              <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">Video</span>
            </div>
            <div className="aspect-video bg-slate-900">
              {(rule.videoUrl.includes("youtube") || rule.videoUrl.includes("youtu.be")) ? (
                <iframe src={youtubeEmbed} className="w-full h-full" allowFullScreen title="Video" />
              ) : (
                <video src={rule.videoUrl} controls className="w-full h-full object-contain" />
              )}
            </div>
          </div>
        )}

        {/* PDF Documents */}
        {pdfs.length > 0 && (
          <div>
            <h2 className="text-sm font-black text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText size={15} className="text-[#1a3826] dark:text-[#FFC72C]" />
              Dokumente ({pdfs.length})
            </h2>
            <div className="space-y-3">
              {pdfs.map((url, idx) => {
                const name = pdfLabel(url, idx);
                return (
                  <div key={`pdf-${idx}`} className="flex items-stretch rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:border-[#1a3826]/30 dark:hover:border-[#FFC72C]/20 transition-all overflow-hidden w-full min-w-0">
                    <div className="w-14 shrink-0 flex items-center justify-center bg-gradient-to-br from-[#1a3826] to-[#0f2218]">
                      <FileText size={22} className="text-[#FFC72C]" />
                    </div>
                    <div className="flex-1 min-w-0 px-4 py-3.5 flex flex-col gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">PDF Dokument</p>
                        <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button type="button" onClick={() => { setPdfTitle(name); setPdfUrl(url); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1a3826] text-white text-xs font-bold hover:bg-[#142d1f] transition">
                          <FileText size={12} /> Vorschau
                        </button>
                        <a href={url} download className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-muted/50 text-foreground text-xs font-semibold hover:bg-muted transition">
                          <Download size={12} /> Download
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Gallery */}
        {hasGallery && (
          <div>
            <h2 className="text-sm font-black text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <ZoomIn size={15} className="text-[#1a3826] dark:text-[#FFC72C]" />
              Galerie ({rule.images.length})
            </h2>
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              {/* Main image */}
              <div className="relative aspect-video bg-muted cursor-zoom-in group" onClick={() => setLightboxIdx(galleryIdx)}>
                <Image
                  src={rule.images[galleryIdx].url}
                  alt={`Bild ${galleryIdx + 1}`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 896px) 100vw, 896px"
                  unoptimized={rule.images[galleryIdx].url.includes("blob.vercel-storage.com")}
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/20">
                  <div className="p-3 rounded-full bg-black/60 text-white"><ZoomIn size={20} /></div>
                </div>
                {rule.images.length > 1 && (
                  <>
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); setGalleryIdx((i) => (i - 1 + rule.images.length) % rule.images.length); }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition">
                      <ChevronLeft size={18} />
                    </button>
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); setGalleryIdx((i) => (i + 1) % rule.images.length); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition">
                      <ChevronRight size={18} />
                    </button>
                    <div className="absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-black/60 text-white text-xs font-bold">
                      {galleryIdx + 1} / {rule.images.length}
                    </div>
                  </>
                )}
              </div>

              {/* Thumbnail strip */}
              {rule.images.length > 1 && (
                <div className="flex gap-2 p-3 bg-muted/30 border-t border-border overflow-x-auto">
                  {rule.images.map((img, i) => (
                    <button key={img.id} type="button" onClick={() => setGalleryIdx(i)}
                      className={`relative w-16 h-16 shrink-0 rounded-xl overflow-hidden border-2 transition ${i === galleryIdx ? "border-[#1a3826] dark:border-[#FFC72C] scale-105 shadow-md" : "border-transparent opacity-55 hover:opacity-100"}`}>
                      <Image src={img.url} alt="" fill className="object-cover" sizes="64px" unoptimized={img.url.includes("blob.vercel-storage.com")} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && hasGallery && (
        <Lightbox images={rule.images} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}

      {/* PDF Modal */}
      {pdfUrl && (
        <PdfModal url={pdfUrl} title={pdfTitle} onClose={() => { setPdfUrl(null); setPdfTitle(""); }} />
      )}
    </div>
  );
}
