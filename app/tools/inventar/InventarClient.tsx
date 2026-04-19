"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChefHat,
  Coffee,
  Sofa,
  MonitorSpeaker,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  X,
  Loader2,
  Package,
  ShieldCheck,
  Hash,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { getInventarSection } from "@/app/actions/inventarActions";
import type { InventarSectionRow } from "@/app/actions/inventarActions";
import { generateSectionPDF, generateFullEquipmentPDF } from "@/lib/equipmentPdf";

// ─── Section visual config ────────────────────────────────────────────────────

type SectionStyle = {
  bg: string;
  gradientFrom: string;
  gradientTo: string;
  border: string;
  badge: string;
  icon: React.ReactNode;
  accentText: string;
};

const SECTION_STYLES: Record<string, SectionStyle> = {
  Produktion: {
    bg: "bg-[#1a3826]",
    gradientFrom: "from-[#1a3826]",
    gradientTo: "to-[#0d1f15]",
    border: "border-[#1a3826]/25",
    badge: "bg-[#FFC72C] text-[#1a3826]",
    icon: <ChefHat size={32} strokeWidth={1.8} />,
    accentText: "text-[#FFC72C]",
  },
  Service: {
    bg: "bg-[#1a4a2e]",
    gradientFrom: "from-[#1a4a2e]",
    gradientTo: "to-[#0d2e1a]",
    border: "border-[#1a4a2e]/25",
    badge: "bg-[#FFC72C] text-[#1a3826]",
    icon: <MonitorSpeaker size={32} strokeWidth={1.8} />,
    accentText: "text-[#FFC72C]",
  },
  Lobby: {
    bg: "bg-[#0f2e1c]",
    gradientFrom: "from-[#0f2e1c]",
    gradientTo: "to-[#071a0e]",
    border: "border-[#0f2e1c]/25",
    badge: "bg-[#FFC72C] text-[#1a3826]",
    icon: <Sofa size={32} strokeWidth={1.8} />,
    accentText: "text-[#FFC72C]",
  },
  McCafe: {
    bg: "bg-[#4a1a00]",
    gradientFrom: "from-[#4a1a00]",
    gradientTo: "to-[#2a0e00]",
    border: "border-amber-900/25",
    badge: "bg-amber-400 text-amber-900",
    icon: <Coffee size={32} strokeWidth={1.8} />,
    accentText: "text-amber-400",
  },
};

const FALLBACK_STYLE = SECTION_STYLES.Produktion;

// ─── PDF Preview Modal ────────────────────────────────────────────────────────

function PdfPreviewModal({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-card rounded-2xl shadow-2xl border border-[#1a3826]/20 w-full max-w-6xl h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0 bg-[#1a3826]">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText size={18} className="text-[#FFC72C] shrink-0" />
            <span className="text-sm font-black text-white uppercase tracking-wider truncate">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={url}
              download={`${title}.pdf`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black bg-[#FFC72C] text-[#1a3826] hover:bg-[#FFC72C]/90 transition"
            >
              <Download size={14} />
              Herunterladen
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        {/* PDF iframe */}
        <div className="flex-1 min-h-0 bg-slate-100 dark:bg-slate-900">
          <iframe
            src={url}
            className="w-full h-full border-0"
            title={title}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  section,
  onOpen,
  onExportPdf,
  exportingPdf,
}: {
  section: InventarSectionRow;
  onOpen: () => void;
  onExportPdf: (e: React.MouseEvent) => void;
  exportingPdf: boolean;
}) {
  const style = SECTION_STYLES[section.name] ?? FALLBACK_STYLE;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full text-left rounded-2xl md:rounded-3xl overflow-hidden min-h-[180px] bg-gradient-to-br from-[#1a3826] via-[#1a3826] to-[#0b1a12] border border-[#FFC72C]/25 shadow-[0_18px_40px_rgba(0,0,0,0.45)] hover:-translate-y-1 hover:border-[#FFC72C]/60 hover:shadow-[0_22px_55px_rgba(0,0,0,0.6)] transition-all duration-300 flex flex-col p-5 md:p-6"
    >
      {/* Header: icon + title */}
      <div className="flex items-start justify-between gap-3 flex-1 min-h-0">
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFC72C]/60">
            Sektion
          </span>
          <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight leading-tight">
            {section.name}
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/60">
              <Layers size={12} className="text-[#FFC72C]/70" />
              {section.itemCount} {section.itemCount === 1 ? "Gerät" : "Geräte"}
            </span>
          </div>
        </div>
        <div className={`shrink-0 flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 ${style.accentText}`}>
          {style.icon}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onExportPdf}
          disabled={exportingPdf}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-xs font-bold transition disabled:opacity-40"
          title="PDF exportieren"
        >
          {exportingPdf ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <FileText size={12} />
          )}
          {exportingPdf ? "PDF…" : "PDF"}
        </button>
        <span className="flex items-center gap-1.5 text-[#FFC72C] text-xs font-bold opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-200">
          Öffnen
          <ChevronRight size={14} />
        </span>
      </div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  sections: InventarSectionRow[];
  activeRestaurantId: string;
  activeRestaurantName: string;
  accessibleRestaurants: { id: string; code: string; name: string | null }[];
  canEdit: boolean;
  userRole: string;
};

export default function InventarClient({
  sections,
  activeRestaurantId: _activeRestaurantId,
  activeRestaurantName,
}: Props) {
  const router = useRouter();
  const totalItems = sections.reduce((sum, s) => sum + s.itemCount, 0);

  // PDF state
  const [pdfModal, setPdfModal] = useState<{ url: string; title: string } | null>(null);
  const [exportingSection, setExportingSection] = useState<string | null>(null);
  const [exportingAll, startExportAll] = useTransition();

  const handleSectionPdf = useCallback(
    async (e: React.MouseEvent, section: InventarSectionRow) => {
      e.stopPropagation();
      setExportingSection(section.id);
      try {
        const detail = await getInventarSection(section.id);
        if (!detail) { toast.error("Sektion nicht gefunden."); return; }
        const url = generateSectionPDF(detail, activeRestaurantName);
        setPdfModal({ url, title: `Equipment – ${section.name}` });
      } catch {
        toast.error("PDF konnte nicht erstellt werden.");
      } finally {
        setExportingSection(null);
      }
    },
    [activeRestaurantName]
  );

  const handleFullPdf = useCallback(() => {
    startExportAll(async () => {
      try {
        const details = await Promise.all(sections.map((s) => getInventarSection(s.id)));
        const valid = details.filter(Boolean) as Awaited<ReturnType<typeof getInventarSection>>[];
        if (!valid.length) { toast.error("Keine Daten gefunden."); return; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const url = generateFullEquipmentPDF(valid as any, activeRestaurantName);
        setPdfModal({ url, title: `Equipment – Restaurant ${activeRestaurantName} – Komplett` });
      } catch {
        toast.error("PDF konnte nicht erstellt werden.");
      }
    });
  }, [sections, activeRestaurantName]);

  const closePdf = useCallback(() => {
    if (pdfModal?.url) URL.revokeObjectURL(pdfModal.url);
    setPdfModal(null);
  }, [pdfModal]);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8">

        {/* ── Header ── */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter mb-2">
              EQUIPMENT
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              Geräte und Ausstattung · Restaurant {activeRestaurantName}
            </p>
          </div>
          <button
            type="button"
            onClick={handleFullPdf}
            disabled={exportingAll || sections.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1a3826] hover:bg-[#1a3826]/90 text-[#FFC72C] text-sm font-black transition disabled:opacity-50 shadow-md self-start md:self-auto"
          >
            {exportingAll ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            {exportingAll ? "Wird erstellt…" : "Gesamt-PDF"}
          </button>
        </div>

        {/* ── Stats bar ── */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Sektionen", value: sections.length, icon: <Layers size={16} /> },
            { label: "Geräte gesamt", value: totalItems, icon: <Package size={16} /> },
            { label: "Seriennummern", value: "—", icon: <Hash size={16} /> },
            { label: "Garantiescheine", value: "—", icon: <ShieldCheck size={16} /> },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-2xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-gradient-to-br from-emerald-50/60 via-card to-[#1a3826]/5 dark:from-[#1a3826]/10 dark:via-card dark:to-[#1a3826]/5 px-4 py-3 shadow-sm"
            >
              <div className="h-9 w-9 rounded-xl bg-[#1a3826]/8 dark:bg-[#FFC72C]/10 flex items-center justify-center text-[#1a3826] dark:text-[#FFC72C] shrink-0">
                {stat.icon}
              </div>
              <div>
                <div className="text-lg font-black text-foreground leading-tight">{stat.value}</div>
                <div className="text-[11px] text-muted-foreground">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Section cards grid ── */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {sections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              onOpen={() => router.push(`/tools/inventar/${section.id}`)}
              onExportPdf={(e) => handleSectionPdf(e, section)}
              exportingPdf={exportingSection === section.id}
            />
          ))}
        </div>

        {sections.length === 0 && (
          <div className="mt-8 rounded-2xl md:rounded-3xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-gradient-to-br from-emerald-50/40 via-card to-[#1a3826]/5 dark:from-[#1a3826]/10 dark:via-card dark:to-[#1a3826]/5 shadow-lg p-10 md:p-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-[#1a3826]/8 dark:bg-[#FFC72C]/12 flex items-center justify-center mx-auto mb-5">
              <ClipboardList size={30} className="text-[#1a3826] dark:text-[#FFC72C]" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Kein Inventar gefunden</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              Für diesen Standort sind noch keine Sektionen erfasst.
            </p>
          </div>
        )}
      </div>

      {/* PDF Preview Modal */}
      {pdfModal && (
        <PdfPreviewModal
          url={pdfModal.url}
          title={pdfModal.title}
          onClose={closePdf}
        />
      )}
    </div>
  );
}
