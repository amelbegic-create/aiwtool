"use client";

import { useState } from "react";
import { Award, X, FileText, Download, Calendar, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type CertItem = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  pdfUrl?: string | null;
  pdfName?: string | null;
  createdAt: Date | string;
};

interface Props {
  certificates: CertItem[];
  canOpenPopup: boolean; // true für Mitarbeiter/Manager – false für globale Admin-Rollen
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function CertificatesWidget({ certificates, canOpenPopup }: Props) {
  const [selected, setSelected] = useState<CertItem | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const handleClick = (cert: CertItem) => {
    if (canOpenPopup) setSelected(cert);
  };

  return (
    <>
      {/* ── List ── */}
      {certificates.length > 0 ? (
        <div className="space-y-2 flex-1 min-h-0 overflow-y-auto">
          {certificates.slice(0, 4).map((cert) => (
            <button
              key={cert.id}
              type="button"
              onClick={() => handleClick(cert)}
              className={`w-full flex items-center gap-3 rounded-xl bg-muted/30 p-3 border border-transparent transition-colors text-left
                ${canOpenPopup
                  ? "hover:border-[#1a3826]/25 hover:bg-[#1a3826]/5 cursor-pointer"
                  : "cursor-default hover:border-[#1a3826]/20 dark:hover:border-[#FFC72C]/20"
                }`}
            >
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#1a3826] to-[#0f2218] flex items-center justify-center flex-shrink-0 overflow-hidden">
                {cert.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cert.imageUrl} alt={cert.title} className="w-full h-full object-cover" />
                ) : (
                  <Award size={16} className="text-[#FFC72C]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-foreground leading-tight truncate">{cert.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(cert.createdAt).toLocaleDateString("de-AT", { month: "short", year: "numeric" })}
                </p>
              </div>
              {canOpenPopup && (
                <ChevronRight size={14} className="text-muted-foreground shrink-0" />
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-5 text-center flex-1 flex flex-col items-center justify-center min-h-[200px]">
          <Award size={20} className="text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-xs font-bold text-muted-foreground">Keine Zertifikate</p>
          <Link
            href="/profile"
            className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-bold text-[#1a3826] dark:text-[#FFC72C] hover:underline"
          >
            Zum Profil <ChevronRight size={10} />
          </Link>
        </div>
      )}

      {/* ── Popup Modal ── */}
      {selected && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div className="relative bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-[#1a3826] px-5 py-4 flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0 overflow-hidden">
                {selected.imageUrl ? (
                  <Image
                    src={selected.imageUrl}
                    alt={selected.title}
                    width={44}
                    height={44}
                    className="w-full h-full object-cover"
                    unoptimized={selected.imageUrl.includes("blob.vercel-storage.com")}
                  />
                ) : (
                  <Award size={22} className="text-[#FFC72C]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-black text-white leading-snug">{selected.title}</h2>
                <p className="text-[11px] text-white/60 mt-0.5 flex items-center gap-1">
                  <Calendar size={11} />
                  {fmtDate(selected.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg text-white/60 hover:bg-white/15 transition shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Zertifikat-Bild groß */}
              {selected.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-border bg-muted aspect-video relative">
                  <Image
                    src={selected.imageUrl}
                    alt={selected.title}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 448px"
                    unoptimized={selected.imageUrl.includes("blob.vercel-storage.com")}
                  />
                </div>
              )}

              {/* Beschreibung */}
              {selected.description && (
                <div className="rounded-xl bg-muted/40 border border-border px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1.5">
                    Beschreibung
                  </p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {selected.description}
                  </p>
                </div>
              )}

              {/* PDF – öffnet als Popup */}
              {selected.pdfUrl && (
                <button
                  type="button"
                  onClick={() => setPdfPreviewUrl(selected.pdfUrl!)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-muted hover:bg-accent border border-border transition text-left"
                >
                  <FileText size={18} className="text-red-500 shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate flex-1">
                    {selected.pdfName ?? "Zertifikat öffnen"}
                  </span>
                  <Download size={16} className="text-muted-foreground shrink-0" />
                </button>
              )}

              {/* Close button */}
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="w-full py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PDF Preview Modal ── */}
      {pdfPreviewUrl && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPdfPreviewUrl(null); }}
        >
          <div className="relative bg-card rounded-2xl shadow-2xl border border-border w-full max-w-4xl h-[82vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40 shrink-0">
              <div className="flex items-center gap-2">
                <FileText size={17} className="text-red-500" />
                <span className="text-sm font-black text-foreground uppercase tracking-wider">
                  Dokument anzeigen
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={pdfPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-muted hover:bg-accent text-muted-foreground transition"
                >
                  <Download size={13} /> Herunterladen
                </a>
                <button
                  type="button"
                  onClick={() => setPdfPreviewUrl(null)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            {/* iFrame */}
            <div className="flex-1 overflow-hidden bg-muted">
              <iframe
                src={pdfPreviewUrl}
                className="w-full h-full border-0"
                title="PDF Vorschau"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
