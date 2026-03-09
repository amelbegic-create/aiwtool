"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Map, Building2, BookOpen, ChevronRight, X } from "lucide-react";

interface RestaurantsHubClientProps {
  sitzplanPdfUrl: string | null;
  restaurantName: string;
}

export default function RestaurantsHubClient({ sitzplanPdfUrl, restaurantName }: RestaurantsHubClientProps) {
  const [sitzplanModalOpen, setSitzplanModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
        <div className="border-b border-border pb-6 mb-8">
          <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter mb-2">
            Restaurant Tools
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Firmen, Bedienungsanleitungen und Sitzplan
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Sitzplan & Layout – otvara modal */}
          <motion.button
            type="button"
            onClick={() => setSitzplanModalOpen(true)}
            className="group text-left block rounded-2xl md:rounded-3xl overflow-hidden border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-card shadow-md hover:shadow-xl hover:-translate-y-1 hover:border-[#1a3826]/25 dark:hover:border-[#FFC72C]/40 transition-all duration-300 p-6 flex flex-col min-h-[200px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="h-16 w-16 rounded-2xl bg-[#1a3826] dark:bg-[#FFC72C] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <Map size={32} className="text-[#FFC72C] dark:text-[#1a3826]" />
            </div>
            <h2 className="text-lg md:text-xl font-black text-[#1a3826] dark:text-[#FFC72C] leading-tight mb-2">
              Sitzplan & Layout
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-3">
              Sitzplan und Layout Ihres Restaurants anzeigen
            </p>
            <div className="mt-auto flex items-center gap-1 text-[#FFC72C] text-xs font-bold opacity-0 group-hover:opacity-100 transition-all duration-200">
              Öffnen <ChevronRight size={14} />
            </div>
          </motion.button>

          {/* Firmen und Partner – link */}
          <Link
            href="/tools/partners"
            className="group block rounded-2xl md:rounded-3xl overflow-hidden border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-card shadow-md hover:shadow-xl hover:-translate-y-1 hover:border-[#1a3826]/25 dark:hover:border-[#FFC72C]/40 transition-all duration-300 p-6 flex flex-col min-h-[200px]"
          >
            <div className="h-16 w-16 rounded-2xl bg-[#1a3826] dark:bg-[#FFC72C] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <Building2 size={32} className="text-[#FFC72C] dark:text-[#1a3826]" />
            </div>
            <h2 className="text-lg md:text-xl font-black text-[#1a3826] dark:text-[#FFC72C] leading-tight mb-2">
              Firmen und Partner
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-3">
              Kontakte und Servicedienstleister
            </p>
            <div className="mt-auto flex items-center gap-1 text-[#FFC72C] text-xs font-bold opacity-0 group-hover:opacity-100 transition-all duration-200">
              Öffnen <ChevronRight size={14} />
            </div>
          </Link>

          {/* Bedienungsanleitungen – link */}
          <Link
            href="/tools/rules"
            className="group block rounded-2xl md:rounded-3xl overflow-hidden border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-card shadow-md hover:shadow-xl hover:-translate-y-1 hover:border-[#1a3826]/25 dark:hover:border-[#FFC72C]/40 transition-all duration-300 p-6 flex flex-col min-h-[200px]"
          >
            <div className="h-16 w-16 rounded-2xl bg-[#1a3826] dark:bg-[#FFC72C] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <BookOpen size={32} className="text-[#FFC72C] dark:text-[#1a3826]" />
            </div>
            <h2 className="text-lg md:text-xl font-black text-[#1a3826] dark:text-[#FFC72C] leading-tight mb-2">
              Bedienungsanleitungen
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-3">
              Regeln und Verfahren
            </p>
            <div className="mt-auto flex items-center gap-1 text-[#FFC72C] text-xs font-bold opacity-0 group-hover:opacity-100 transition-all duration-200">
              Öffnen <ChevronRight size={14} />
            </div>
          </Link>
        </div>
      </div>

      {/* Sitzplan Modal */}
      {sitzplanModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSitzplanModalOpen(false);
          }}
        >
          <div
            className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header – zelena pozadina */}
            <div className="flex items-center justify-between px-5 py-4 shrink-0 bg-[#1a3826] border-b border-[#FFC72C]/20">
              <h2 className="text-lg font-black text-white">
                Sitzplan – {restaurantName}
              </h2>
              <button
                type="button"
                onClick={() => setSitzplanModalOpen(false)}
                className="p-2 rounded-lg text-white/70 hover:bg-white/15 hover:text-white transition"
                aria-label="Schließen"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 p-4 overflow-auto">
              {sitzplanPdfUrl ? (
                <iframe
                  src={sitzplanPdfUrl}
                  className="w-full h-[70vh] rounded-md border border-border"
                  title="Sitzplan PDF"
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Map size={48} className="text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground font-medium">
                    Für dieses Restaurant wurde noch kein Sitzplan hinterlegt.
                  </p>
                  <p className="text-sm text-muted-foreground/80 mt-2">
                    Bitte wenden Sie sich an Ihren Administrator.
                  </p>
                </div>
              )}
            </div>

            {/* Footer – Schließen */}
            <div className="shrink-0 px-5 py-4 border-t border-border bg-muted/20 flex justify-end">
              <button
                type="button"
                onClick={() => setSitzplanModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] text-sm font-bold hover:opacity-90 transition-opacity"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
