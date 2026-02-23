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
  Share2,
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
    out.push(`<p class="text-foreground leading-relaxed text-base">${t}</p>`);
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

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = rule.title;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url);
        }
      }
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Breadcrumbs */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href="/dashboard" className="hover:text-[#1a3826] dark:hover:text-[#FFC72C] transition-colors">
              Tools
            </Link>
            <ChevronRight size={14} className="opacity-60" />
            <Link href="/tools/rules" className="hover:text-[#1a3826] dark:hover:text-[#FFC72C] transition-colors">
              Bedienungsanleitungen
            </Link>
            {rule.category?.name && (
              <>
                <ChevronRight size={14} className="opacity-60" />
                <span className="text-foreground font-medium">{rule.category.name}</span>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* Action bar */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/tools/rules"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-[#1a3826] dark:hover:text-[#FFC72C] min-h-[44px] items-center touch-manipulation"
          >
            <ArrowLeft size={18} /> Zurück
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-muted/50 hover:bg-muted text-sm font-semibold min-h-[44px] touch-manipulation"
              title="Teilen"
            >
              <Share2 size={18} /> Teilen
            </button>
            <span className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium">
              {rule.category?.name}
            </span>
            {isRead ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                <CheckCircle2 size={14} /> Gelesen
              </span>
            ) : (
              <button
                type="button"
                onClick={handleRead}
                disabled={isMarking}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] text-sm font-semibold hover:opacity-90 disabled:opacity-70 min-h-[44px] touch-manipulation"
              >
                {isMarking ? "…" : <><CheckCircle2 size={14} /> Als gelesen markieren</>}
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
                <span>Aktualisiert: {fmtDate(rule.updatedAt)}</span>
              )}
            </div>
          </header>

          <div
            className="prose prose-slate max-w-none prose-p:text-foreground prose-p:text-base prose-headings:text-slate-900 dark:prose-headings:text-foreground prose-headings:font-bold prose-a:text-[#1a3826] dark:prose-a:text-[#FFC72C] prose-strong:text-slate-900 dark:prose-strong:text-foreground prose-base rounded-xl border border-border bg-card p-6 shadow-sm text-base"
            style={{ fontSize: "1rem" }}
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
                Galerie ({rule.images.length})
              </p>
              <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
                <Image src={rule.images[galleryIndex].url} alt={`Galerija ${galleryIndex + 1} od ${rule.images.length}`} fill className="object-contain" sizes="(max-width: 768px) 100vw, 640px" />
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
                      "h-14 w-14 rounded-lg overflow-hidden border-2 flex-shrink-0 relative",
                      idx === galleryIndex ? "border-[#1a3826]" : "border-transparent opacity-70"
                    )}
                  >
                    <Image src={img.url} alt={`Slika ${idx + 1}`} fill className="object-cover" sizes="56px" />
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
                Dokumente ({pdfs.length})
              </p>
              <div className="space-y-2">
                {pdfs.map((u, idx) => (
                  <a
                    key={`${u}-${idx}`}
                    href={u}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 min-h-[44px] px-3 py-3 rounded-xl bg-muted hover:bg-accent border border-border transition touch-manipulation"
                  >
                    <FileText size={18} className="text-red-500 shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate flex-1">PDF {idx + 1}</span>
                    <span className="text-xs font-bold text-muted-foreground uppercase">Öffnen</span>
                    <Download size={16} className="text-muted-foreground shrink-0" />
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
