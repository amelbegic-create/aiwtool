"use client";

import Link from "next/link";
import { Award, ExternalLink, FileText, Download, X } from "lucide-react";
import { useState } from "react";

type CertItem = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  pdfUrl?: string | null;
  pdfName?: string | null;
  createdAt: string;
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("de-AT", { day: "2-digit", month: "long", year: "numeric" });
}

function PdfModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#1a3826] shrink-0">
          <span className="text-sm font-black text-white truncate">{title}</span>
          <div className="flex items-center gap-2">
            <a href={url} download={`${title}.pdf`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFC72C] text-[#1a3826] text-xs font-black">
              <Download size={12} /> Herunterladen
            </a>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10">
              <X size={17} />
            </button>
          </div>
        </div>
        <iframe src={url} className="flex-1 w-full border-0" title={title} />
      </div>
    </div>
  );
}

export default function CertificatesTab({ certificates }: { certificates: CertItem[]; userId: string }) {
  const [pdfModal, setPdfModal] = useState<{ url: string; title: string } | null>(null);

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-xl font-black text-foreground">Meine Zertifikate</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{certificates.length} Einträge</p>
      </div>

      {certificates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Award size={28} className="mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Noch keine Zertifikate vorhanden.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden divide-y divide-border">
          {certificates.map((cert) => (
            <div key={cert.id} className="p-4 flex items-start gap-4">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#1a3826] to-[#0f2218] flex items-center justify-center shrink-0 overflow-hidden">
                {cert.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cert.imageUrl} alt={cert.title} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <Award size={18} className="text-[#FFC72C]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-foreground">{cert.title}</p>
                {cert.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{cert.description}</p>
                )}
                <p className="text-[10px] text-muted-foreground/60 mt-1">{fmtDate(cert.createdAt)}</p>
              </div>
              {cert.pdfUrl && (
                <button
                  type="button"
                  onClick={() => setPdfModal({ url: cert.pdfUrl!, title: cert.title })}
                  className="shrink-0 p-2 rounded-xl border border-border hover:bg-muted transition text-muted-foreground hover:text-foreground"
                  title="PDF anzeigen"
                >
                  <FileText size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Link
        href="/tools/certificates"
        className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 hover:bg-muted/50 transition shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#1a3826]/10 text-[#1a3826] dark:bg-[#FFC72C]/10 dark:text-[#FFC72C]">
            <Award size={16} />
          </div>
          <div>
            <p className="text-sm font-black text-foreground">Zertifikat-Modul</p>
            <p className="text-xs text-muted-foreground">Neue Zertifikate hochladen und verwalten</p>
          </div>
        </div>
        <ExternalLink size={14} className="text-muted-foreground" />
      </Link>

      {pdfModal && (
        <PdfModal url={pdfModal.url} title={pdfModal.title} onClose={() => setPdfModal(null)} />
      )}
    </div>
  );
}
