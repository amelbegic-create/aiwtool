"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Award, FileText, X, Download } from "lucide-react";
import Image from "next/image";

type Certificate = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  pdfUrl: string | null;
  pdfName: string | null;
  createdAt: Date | string;
};

export default function CertificatesPageClient({ certificates }: { certificates: Certificate[] }) {
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const openCertModal = (cert: Certificate) => {
    setSelectedCert(cert);
  };

  const closeCertModal = () => {
    setSelectedCert(null);
    setPdfPreviewUrl(null);
  };

  const openPdfPreview = (url: string) => {
    setPdfPreviewUrl(url);
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
        <div className="border-b border-border pb-6 mb-8">
          <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter mb-2">
            MEINE ZERTIFIKATE
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Übersicht aller Ihrer Zertifikate und Qualifikationen
          </p>
        </div>

        {certificates.length === 0 ? (
          <div className="rounded-2xl md:rounded-3xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-gradient-to-br from-emerald-50/40 via-card to-[#1a3826]/5 dark:from-[#1a3826]/10 dark:via-card dark:to-[#1a3826]/5 shadow-lg p-10 md:p-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-[#1a3826]/8 dark:bg-[#FFC72C]/12 flex items-center justify-center mx-auto mb-5">
              <Award size={30} className="text-[#1a3826] dark:text-[#FFC72C]" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Keine Zertifikate</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              Sie haben noch keine Zertifikate. Bitte wenden Sie sich an Ihren Vorgesetzten.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {certificates.map((cert, index) => (
              <motion.article
                key={cert.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <button
                  type="button"
                  onClick={() => openCertModal(cert)}
                  className="group w-full text-left block rounded-2xl md:rounded-3xl overflow-hidden border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-card shadow-md hover:shadow-xl hover:-translate-y-1 hover:border-[#1a3826]/25 dark:hover:border-[#FFC72C]/40 transition-all duration-300"
                >
                  {cert.imageUrl ? (
                    <div className="relative w-full aspect-[4/3] bg-muted">
                      <Image
                        src={cert.imageUrl}
                        alt={cert.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-[4/3] bg-gradient-to-br from-[#1a3826]/5 to-[#1a3826]/10 dark:from-[#FFC72C]/5 dark:to-[#FFC72C]/10 flex items-center justify-center">
                      <Award size={48} className="text-[#1a3826]/30 dark:text-[#FFC72C]/30" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="text-base font-bold text-[#1a3826] dark:text-[#FFC72C] leading-snug line-clamp-2 mb-1">
                      {cert.title}
                    </h3>
                    {cert.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {cert.description}
                      </p>
                    )}
                  </div>
                </button>
              </motion.article>
            ))}
          </div>
        )}
      </div>

      {selectedCert && !pdfPreviewUrl && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCertModal();
          }}
        >
          <div className="relative bg-card rounded-2xl shadow-2xl border border-border w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-[#1a3826]">
              <div className="flex items-center gap-2.5">
                <Award size={20} className="text-[#FFC72C]" />
                <span className="text-sm md:text-base font-black text-white uppercase tracking-wider">
                  Zertifikat
                </span>
              </div>
              <button
                type="button"
                onClick={closeCertModal}
                className="p-2 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition"
                aria-label="Schließen"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {selectedCert.imageUrl && (
                <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-muted">
                  <Image
                    src={selectedCert.imageUrl}
                    alt={selectedCert.title}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 640px"
                  />
                </div>
              )}
              <div>
                <h2 className="text-xl font-black text-[#1a3826] dark:text-[#FFC72C] mb-2">
                  {selectedCert.title}
                </h2>
                {selectedCert.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedCert.description}
                  </p>
                )}
              </div>
              {selectedCert.pdfUrl && (
                <button
                  type="button"
                  onClick={() => openPdfPreview(selectedCert.pdfUrl!)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] hover:bg-[#142e1e] dark:hover:bg-[#e6b328] text-sm font-bold shadow-sm transition-all"
                >
                  <FileText size={18} />
                  PDF anzeigen
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {pdfPreviewUrl && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPdfPreviewUrl(null);
          }}
        >
          <div className="relative bg-card rounded-2xl shadow-2xl border border-[#1a3826]/20 w-full max-w-[75vw] h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 shrink-0 bg-[#1a3826] border-b border-[#FFC72C]/20">
              <div className="flex items-center gap-2.5">
                <FileText size={20} className="text-[#FFC72C]" aria-hidden />
                <span className="text-sm md:text-base font-black text-white uppercase tracking-wider">
                  Zertifikat PDF
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={pdfPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#FFC72C] text-[#1a3826] hover:bg-[#FFC72C]/90 transition shadow-sm"
                >
                  <Download size={16} />
                  Herunterladen
                </a>
                <button
                  type="button"
                  onClick={() => setPdfPreviewUrl(null)}
                  className="p-2 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition"
                  aria-label="Schließen"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-slate-100 dark:bg-slate-900/50 min-h-0">
              <iframe
                src={pdfPreviewUrl}
                className="w-full h-full border-0"
                title="PDF Vorschau"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
