"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  Globe,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Download,
  Share2,
} from "lucide-react";

type PartnerData = {
  id: string;
  companyName: string;
  category: { id: string; name: string } | null;
  logoUrl: string | null;
  serviceDescription: string | null;
  notes: string | null;
  websiteUrl: string | null;
  galleryUrls: string[];
  priceListPdfUrl: string | null;
  contacts: Array<{
    id: string;
    contactName: string;
    phone: string | null;
    email: string | null;
    role: string | null;
  }>;
};

export default function PartnerDetailClient({ partner }: { partner: PartnerData }) {
  const [galleryIndex, setGalleryIndex] = useState(0);
  const hasGallery = partner.galleryUrls.length > 0;

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = partner.companyName;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch (e) {
        if ((e as Error).name !== "AbortError" && navigator.clipboard?.writeText)
          navigator.clipboard.writeText(url);
      }
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Breadcrumbs – kao Pravila */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href="/dashboard" className="hover:text-[#1a3826] dark:hover:text-[#FFC72C] transition-colors">
              Start
            </Link>
            <ChevronRight size={14} className="opacity-60" />
            <Link href="/tools/partners" className="hover:text-[#1a3826] dark:hover:text-[#FFC72C] transition-colors">
              Firmen und Partner
            </Link>
            <ChevronRight size={14} className="opacity-60" />
            <span className="text-foreground font-medium truncate max-w-[200px]">{partner.companyName}</span>
          </nav>
        </div>
      </div>

      {/* Action bar – kao Pravila */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/tools/partners"
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
            {partner.category?.name && (
              <span className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium">
                {partner.category.name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5 flex gap-6 flex-col lg:flex-row">
        {/* Glavni sadržaj – kao Pravila */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Header: logo + naziv + kategorija */}
          <header className="border-b border-border pb-4 flex flex-col sm:flex-row gap-4 items-start">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-[#1a3826]/10 dark:bg-[#1a3826]/20 shrink-0 flex items-center justify-center">
              {partner.logoUrl ? (
                <Image
                  src={partner.logoUrl}
                  alt=""
                  fill
                  className="object-contain p-2"
                  sizes="96px"
                  unoptimized={partner.logoUrl.includes("blob.vercel-storage.com")}
                />
              ) : (
                <Building2 className="h-10 w-10 text-[#1a3826] dark:text-[#FFC72C]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl md:text-2xl font-bold text-[#1a3826] dark:text-[#FFC72C] leading-tight">
                {partner.companyName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                {partner.category?.name && (
                  <span className="font-medium text-muted-foreground">{partner.category.name}</span>
                )}
                {partner.websiteUrl && (
                  <a
                    href={partner.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[#1a3826] dark:text-[#FFC72C] hover:underline"
                  >
                    <Globe size={12} />
                    <span className="truncate max-w-[180px]">
                      {partner.websiteUrl.replace(/^https?:\/\//i, "")}
                    </span>
                  </a>
                )}
              </div>
            </div>
          </header>

          {/* Beschreibung */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm text-base overflow-hidden min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Beschreibung</p>
            {partner.serviceDescription ? (
              <p className="text-foreground leading-relaxed whitespace-pre-line break-words break-all">
                {partner.serviceDescription}
              </p>
            ) : (
              <p className="text-muted-foreground">Keine ausführliche Beschreibung hinterlegt.</p>
            )}
          </div>

          {/* Interne Notizen */}
          {partner.notes && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm overflow-hidden min-w-0">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Interne Notizen
              </p>
              <p className="text-foreground leading-relaxed whitespace-pre-line text-sm break-words break-all">{partner.notes}</p>
            </div>
          )}

          {/* Galerie – kao Pravila (karusel + thumbnails) */}
          {hasGallery && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Galerie ({partner.galleryUrls.length})
              </p>
              <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
                <Image
                  src={partner.galleryUrls[galleryIndex]}
                  alt={`Galerie ${galleryIndex + 1}`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 640px"
                  unoptimized={partner.galleryUrls[galleryIndex]?.includes("blob.vercel-storage.com")}
                />
                {partner.galleryUrls.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setGalleryIndex((i) => (i - 1 + partner.galleryUrls.length) % partner.galleryUrls.length)
                      }
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-card/90 flex items-center justify-center text-foreground shadow"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setGalleryIndex((i) => (i + 1) % partner.galleryUrls.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-card/90 flex items-center justify-center text-foreground shadow"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </>
                )}
              </div>
              <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
                {partner.galleryUrls.map((url, idx) => (
                  <button
                    key={`${url}-${idx}`}
                    type="button"
                    onClick={() => setGalleryIndex(idx)}
                    className={`h-14 w-14 rounded-lg overflow-hidden border-2 flex-shrink-0 relative ${
                      idx === galleryIndex ? "border-[#1a3826]" : "border-transparent opacity-70"
                    }`}
                  >
                    <Image src={url} alt="" fill className="object-cover" sizes="56px" unoptimized={url.includes("blob.vercel-storage.com")} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sa strane: Kontakt + Dokument (PDF cjenovnik) – kao Pravila */}
        <aside className="lg:w-72 shrink-0 space-y-4">
          <div className="lg:sticky lg:top-20 space-y-4">
            {/* Kontakt */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Kontakt</p>
              {partner.contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Kontakte hinterlegt.</p>
              ) : (
                <div className="space-y-4">
                  {partner.contacts.map((c) => (
                    <div key={c.id} className="flex gap-3 text-sm">
                      <div className="shrink-0 h-9 w-9 rounded-full bg-[#1a3826]/10 dark:bg-[#FFC72C]/15 flex items-center justify-center">
                        <UserCircle size={18} className="text-[#1a3826] dark:text-[#FFC72C]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-foreground">
                          {c.contactName}
                          {c.role && (
                            <span className="font-normal text-muted-foreground"> · {c.role}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                          {c.phone && (
                            <a
                              href={`tel:${c.phone.trim()}`}
                              className="inline-flex items-center gap-1.5 text-[#1a3826] dark:text-[#FFC72C] hover:underline font-medium text-[13px]"
                            >
                              <Phone size={14} className="shrink-0" />
                              <span>{c.phone}</span>
                            </a>
                          )}
                          {c.email && (
                            <a
                              href={`mailto:${c.email.trim()}`}
                              className="inline-flex items-center gap-1.5 text-[#1a3826] dark:text-[#FFC72C] hover:underline font-medium text-[13px] truncate max-w-full"
                            >
                              <Mail size={14} className="shrink-0" />
                              <span className="truncate">{c.email}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cjenovnik PDF – kao Dokumente u Pravilima */}
            {partner.priceListPdfUrl && (
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Cjenovnik / Preisliste
                </p>
                <a
                  href={partner.priceListPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 min-h-[44px] px-3 py-3 rounded-xl bg-muted hover:bg-accent border border-border transition touch-manipulation"
                >
                  <FileText size={18} className="text-red-500 shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate flex-1">PDF öffnen</span>
                  <Download size={16} className="text-muted-foreground shrink-0" />
                </a>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
