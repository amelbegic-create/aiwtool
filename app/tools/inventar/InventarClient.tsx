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

  // We don't have per-item stats here (only count), so show what we have
  const itemLabel =
    section.itemCount === 0
      ? "Keine Geräte erfasst"
      : `${section.itemCount} ${section.itemCount === 1 ? "Gerät" : "Geräte"}`;

  return (
    <div
      className={`group relative rounded-2xl border ${style.border} bg-card shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col`}
    >
      {/* Gradient top panel */}
      <div
        className={`bg-gradient-to-br ${style.gradientFrom} ${style.gradientTo} px-6 py-5 flex items-start gap-4 relative overflow-hidden`}
      >
        {/* Background watermark icon */}
        <div className="absolute right-4 top-3 opacity-10 text-white scale-150">
          {style.icon}
        </div>

        {/* Icon circle */}
        <div className={`shrink-0 h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center ${style.accentText}`}>
          {style.icon}
        </div>

        {/* Title + count */}
        <div className="flex-1 min-w-0 z-10">
          <div className="text-[11px] font-black text-white/50 uppercase tracking-[0.2em] mb-1">
            Sektion
          </div>
          <div className="text-2xl font-black text-white uppercase tracking-tight leading-tight">
            {section.name}
          </div>
          <div className={`mt-1.5 text-sm font-bold ${style.accentText}`}>
            {itemLabel}
          </div>
        </div>

        {/* Big count badge */}
        <div className={`shrink-0 z-10 flex flex-col items-center justify-center h-14 w-14 rounded-2xl ${style.badge} shadow-lg`}>
          <span className="text-2xl font-black leading-none">{section.itemCount}</span>
          <span className="text-[9px] font-black uppercase tracking-wider opacity-70 mt-0.5">Stk</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-px bg-border/40 border-t border-border">
        <div className="bg-card px-4 py-3 flex flex-col items-center gap-0.5">
          <Layers size={14} className="text-muted-foreground" />
          <span className="text-xs font-black text-foreground">{section.itemCount}</span>
          <span className="text-[10px] text-muted-foreground">Gesamt</span>
        </div>
        <div className="bg-card px-4 py-3 flex flex-col items-center gap-0.5">
          <Hash size={14} className="text-muted-foreground" />
          <span className="text-xs font-black text-foreground">—</span>
          <span className="text-[10px] text-muted-foreground">Seriennr.</span>
        </div>
        <div className="bg-card px-4 py-3 flex flex-col items-center gap-0.5">
          <ShieldCheck size={14} className="text-muted-foreground" />
          <span className="text-xs font-black text-foreground">—</span>
          <span className="text-[10px] text-muted-foreground">Garantien</span>
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/20 border-t border-border">
        {/* PDF export */}
        <button
          type="button"
          onClick={onExportPdf}
          disabled={exportingPdf}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold text-muted-foreground hover:text-foreground transition disabled:opacity-50"
          title="PDF exportieren"
        >
          {exportingPdf ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <FileText size={13} />
          )}
          {exportingPdf ? "PDF…" : "PDF"}
        </button>

        {/* Open section */}
        <button
          type="button"
          onClick={onOpen}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl ${style.bg} hover:opacity-90 text-[#FFC72C] text-xs font-black transition group-hover:shadow-md`}
        >
          Öffnen
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
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
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-[#1a3826] dark:text-[#FFC72C]">
              EQUIPMENT{" "}
              <span className="text-[#FFC72C] dark:text-white">VERWALTUNG</span>
            </h1>
            <p className="mt-0.5 text-sm font-medium text-muted-foreground">
              Geräte und Ausstattung · Restaurant {activeRestaurantName}
            </p>
          </div>

          {/* Full export button */}
          <button
            type="button"
            onClick={handleFullPdf}
            disabled={exportingAll || sections.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1a3826] hover:bg-[#1a3826]/90 text-[#FFC72C] text-sm font-black transition disabled:opacity-50 shadow-md"
          >
            {exportingAll ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            {exportingAll ? "Wird erstellt…" : "Gesamt-PDF"}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Summary stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Sektionen", value: sections.length, icon: <Layers size={16} /> },
            { label: "Geräte gesamt", value: totalItems, icon: <Package size={16} /> },
            { label: "Seriennummern", value: "—", icon: <Hash size={16} /> },
            { label: "Garantiescheine", value: "—", icon: <ShieldCheck size={16} /> },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm"
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

        {/* Section cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
            <ClipboardList className="mx-auto mb-3 opacity-30" size={32} />
            Kein Inventar gefunden.
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
