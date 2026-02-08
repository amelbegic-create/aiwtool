"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
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
  createdAt: Date | string;
  updatedAt?: Date | string;
  isRead: boolean;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const fmtDate = (d: string | Date) => formatDateDDMMGGGG(d);

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function mdToHtml(md: string) {
  const src = escapeHtml(md || "");
  const withCodeBlocks = src.replace(/```([\s\S]*?)```/g, (_m, code) => {
    return `<pre class="rounded-xl border border-border bg-slate-900 text-slate-100 p-4 overflow-auto text-sm"><code>${code}</code></pre>`;
  });
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
    if (!t) {
      out.push(`<div class="h-2"></div>`);
      continue;
    }
    if (t.startsWith("<h") || t.startsWith("<pre") || t.startsWith("<ul") || t.startsWith("<ol") || t.startsWith("<li")) {
      out.push(t);
      continue;
    }
    out.push(`<p class="text-foreground leading-relaxed text-sm">${t}</p>`);
  }
  return out.join("\n");
}

function ruleContentToHtml(content: string | null | undefined): string {
  const raw = (content || "").trim();
  if (!raw) return "";
  if (raw.startsWith("<") && (raw.includes("</p>") || raw.includes("</h") || raw.includes("<ul") || raw.includes("<ol"))) {
    return raw;
  }
  return mdToHtml(raw);
}

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- userId reserved for future scoped actions
export default function RuleDetailClient({ rule, userId: _userId }: { rule: RuleDetailRule; userId: string }) {
  const router = useRouter();
  const [isRead, setIsRead] = useState(rule.isRead);
  const [isMarking, setIsMarking] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    if (!rule?.id || rule.isRead) return;
    markRuleAsRead(rule.id).then(() => {
      setIsRead(true);
      router.refresh();
    }).catch(() => {});
  }, [rule?.id, rule?.isRead, router]);

  const hasImages = rule.images && rule.images.length > 0;
  const pdfs: string[] = useMemo(() => {
    if (Array.isArray(rule.pdfUrls)) return rule.pdfUrls.filter(Boolean);
    if (rule.pdfUrl) return [rule.pdfUrl];
    return [];
  }, [rule.pdfUrls, rule.pdfUrl]);
  const youtubeEmbed = rule.videoUrl ? toYoutubeEmbed(rule.videoUrl) : "";

  const handleRead = async () => {
    setIsMarking(true);
    await markRuleAsRead(rule.id);
    setIsRead(true);
    setIsMarking(false);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Kompaktna traka */}
      <div className="sticky top-0 z-20 bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link
            href="/tools/rules"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-[#1a3826]"
          >
            <ArrowLeft size={16} /> Natrag
          </Link>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium">
              {rule.category?.name}
            </span>
            {isRead ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium">
                <CheckCircle2 size={12} /> Pročitano
              </span>
            ) : (
              <button
                type="button"
                onClick={handleRead}
                disabled={isMarking}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#1a3826] text-white text-xs font-semibold hover:bg-[#142e1e] disabled:opacity-70"
              >
                {isMarking ? "..." : <><CheckCircle2 size={12} /> Označi pročitano</>}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5 flex gap-6 flex-col lg:flex-row">
        {/* Glavni sadržaj */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Naslov i meta na vrhu – čisto i uredno */}
          <header className="border-b border-border pb-4">
            <h1 className="text-xl md:text-2xl font-bold text-[#1a3826] leading-tight">
              {rule.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              {rule.category?.name && (
                <span className="font-medium text-muted-foreground">{rule.category.name}</span>
              )}
              <span className="inline-flex items-center gap-1">
                <Calendar size={12} />
                {fmtDate(rule.createdAt)}
              </span>
              {rule.updatedAt && (
                <span>Ažurirano: {fmtDate(rule.updatedAt)}</span>
              )}
            </div>
          </header>

          <div
            className="prose prose-slate max-w-none prose-p:text-foreground prose-p:text-sm prose-headings:text-slate-900 prose-headings:font-bold prose-a:text-[#1a3826] prose-strong:text-slate-900 rounded-xl border border-border bg-card p-6 shadow-sm"
            dangerouslySetInnerHTML={{ __html: ruleContentToHtml(rule.content) }}
          />

          {rule.videoUrl && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Video</p>
              <div className="aspect-video rounded-lg overflow-hidden bg-slate-900">
                {(rule.videoUrl.includes("youtube") || rule.videoUrl.includes("youtu.be")) ? (
                  <iframe src={youtubeEmbed} className="w-full h-full" allowFullScreen title="Video" />
                ) : (
                  <video src={rule.videoUrl} controls className="w-full h-full object-contain" />
                )}
              </div>
            </div>
          )}

          {hasImages && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Galerija ({rule.images.length})
              </p>
              <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={rule.images[galleryIndex].url} alt={`Galerija ${galleryIndex + 1} od ${rule.images.length}`} className="w-full h-full object-contain" />
                {rule.images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setGalleryIndex((i) => (i - 1 + rule.images.length) % rule.images.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-card/90 flex items-center justify-center text-foreground shadow"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setGalleryIndex((i) => (i + 1) % rule.images.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-card/90 flex items-center justify-center text-foreground shadow"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </>
                )}
              </div>
              <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
                {rule.images.map((img: { id: string; url: string }, idx: number) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setGalleryIndex(idx)}
                    className={cn(
                      "h-14 w-14 rounded-lg overflow-hidden border-2 flex-shrink-0",
                      idx === galleryIndex ? "border-[#1a3826]" : "border-transparent opacity-70"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={`Slika ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sa strane: Dokumenti */}
        {pdfs.length > 0 && (
          <aside className="lg:w-64 shrink-0">
            <div className="lg:sticky lg:top-20 rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Dokumenti ({pdfs.length})
              </p>
              <div className="space-y-2">
                {pdfs.map((u, idx) => (
                  <a
                    key={`${u}-${idx}`}
                    href={u}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-muted hover:bg-muted border border-slate-100 transition"
                  >
                    <FileText size={16} className="text-red-500 shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate flex-1">PDF {idx + 1}</span>
                    <Download size={14} className="text-muted-foreground shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
