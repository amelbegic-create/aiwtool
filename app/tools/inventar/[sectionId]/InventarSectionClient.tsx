"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  FileText,
  X,
  AlertTriangle,
  Check,
  Search,
  Download,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createInventarItem,
  updateInventarItem,
  deleteInventarItem,
} from "@/app/actions/inventarActions";
import type { InventarSectionDetail, InventarItemRow, InventarItemData } from "@/app/actions/inventarActions";
import { generateSectionPDF } from "@/lib/equipmentPdf";

type FilterState = {
  geraet: Set<string>;
  marke: Set<string>;
  modell: Set<string>;
  seriennummer: Set<string>;
  anschaffungsjahr: Set<string>;
};

function uniq(values: string[]) {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "de", { numeric: true, sensitivity: "base" })
  );
}

function FilterPopover({
  title,
  values,
  selected,
  onToggle,
  onClose,
}: {
  title: string;
  values: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const visible = q.trim()
    ? values.filter((v) => v.toLowerCase().includes(q.trim().toLowerCase()))
    : values;

  return (
    <div className="absolute z-[80] mt-2 w-[min(340px,90vw)] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted/20">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground">{selected.size} ausgewählt</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
        >
          <X size={16} />
        </button>
      </div>
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Suchen…"
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto p-2">
        {visible.length === 0 ? (
          <p className="px-3 py-6 text-sm text-muted-foreground text-center">Keine Werte.</p>
        ) : (
          visible.map((v) => {
            const checked = selected.has(v);
            return (
              <label
                key={v}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/40 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(v)}
                  className="h-4 w-4 accent-[#1a3826]"
                />
                <span className="text-sm font-semibold text-foreground truncate">{v}</span>
              </label>
            );
          })
        )}
      </div>
      <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-muted/10">
        <button
          type="button"
          onClick={() => {
            // clear selection
            selected.forEach((v) => onToggle(v));
          }}
          className="text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          Auswahl löschen
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-black rounded-lg bg-[#1a3826] text-[#FFC72C] px-3 py-2 hover:bg-[#1a3826]/90 transition"
        >
          Fertig
        </button>
      </div>
    </div>
  );
}

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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-card rounded-2xl shadow-2xl border border-[#1a3826]/20 w-full max-w-6xl h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
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
        <div className="flex-1 min-h-0 bg-slate-100 dark:bg-slate-900">
          <iframe src={url} className="w-full h-full border-0" title={title} />
        </div>
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type FormState = {
  geraet: string;
  marke: string;
  modell: string;
  seriennummer: string;
  anschaffungsjahr: string;
};

const EMPTY_FORM: FormState = {
  geraet: "",
  marke: "",
  modell: "",
  seriennummer: "",
  anschaffungsjahr: "",
};

const INPUT_CLS =
  "w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3826]/40 dark:focus:ring-[#FFC72C]/40";

function itemToForm(item: InventarItemRow): FormState {
  return {
    geraet: item.geraet,
    marke: item.marke ?? "",
    modell: item.modell ?? "",
    seriennummer: item.seriennummer ?? "",
    anschaffungsjahr: item.anschaffungsjahr ? String(item.anschaffungsjahr) : "",
  };
}

function formToData(form: FormState): InventarItemData {
  return {
    geraet: form.geraet,
    marke: form.marke || null,
    modell: form.modell || null,
    seriennummer: form.seriennummer || null,
    anschaffungsjahr: form.anschaffungsjahr ? parseInt(form.anschaffungsjahr, 10) || null : null,
  };
}

// ─── Reusable primitives ──────────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card rounded-2xl shadow-2xl border border-[#1a3826]/20 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-4 bg-[#1a3826] border-b border-[#FFC72C]/20">
          <span className="text-sm font-black text-white uppercase tracking-wider truncate">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

function ModalFooter({
  onClose,
  isPending,
  submitLabel,
}: {
  onClose: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2.5 rounded-xl border border-border bg-muted/50 hover:bg-muted text-sm font-semibold transition"
      >
        Abbrechen
      </button>
      <button
        type="submit"
        disabled={isPending}
        className="px-5 py-2.5 rounded-xl bg-[#1a3826] hover:bg-[#1a3826]/90 text-[#FFC72C] text-sm font-black transition disabled:opacity-50"
      >
        {isPending ? "Wird gespeichert…" : submitLabel}
      </button>
    </div>
  );
}

// ─── Add Modal ────────────────────────────────────────────────────────────────

function AddModal({
  sectionName,
  sectionId,
  restaurantId,
  onClose,
  onSaved,
}: {
  sectionName: string;
  sectionId: string;
  restaurantId: string;
  onClose: () => void;
  onSaved: (item: InventarItemRow) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isPending, startTransition] = useTransition();

  const set = (key: keyof FormState, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.geraet.trim()) {
      toast.error("Gerätename ist erforderlich.");
      return;
    }
    startTransition(async () => {
      const res = await createInventarItem(sectionId, formToData(form));
      if (!res.success) {
        toast.error(res.error);
      } else {
        onSaved(res.item);
      }
    });
  };

  return (
    <ModalShell title={`Gerät hinzufügen – ${sectionName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Device name */}
        <FormField label="Gerät *">
          <input
            autoFocus
            value={form.geraet}
            onChange={(e) => set("geraet", e.target.value)}
            placeholder="z.B. Griller 3"
            className={INPUT_CLS}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Marke">
            <input
              value={form.marke}
              onChange={(e) => set("marke", e.target.value)}
              placeholder="z.B. Garland"
              className={INPUT_CLS}
            />
          </FormField>
          <FormField label="Modell">
            <input
              value={form.modell}
              onChange={(e) => set("modell", e.target.value)}
              placeholder="z.B. MWE3S-1"
              className={INPUT_CLS}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Seriennummer">
            <input
              value={form.seriennummer}
              onChange={(e) => set("seriennummer", e.target.value)}
              placeholder="z.B. 1310100101322"
              className={INPUT_CLS}
            />
          </FormField>
          <FormField label="Anschaffungsjahr">
            <input
              type="number"
              min={1990}
              max={2050}
              value={form.anschaffungsjahr}
              onChange={(e) => set("anschaffungsjahr", e.target.value)}
              placeholder="z.B. 2015"
              className={INPUT_CLS}
            />
          </FormField>
        </div>
        <ModalFooter onClose={onClose} isPending={isPending} submitLabel="Hinzufügen" />
      </form>
    </ModalShell>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({
  item,
  restaurantId,
  onClose,
  onSaved,
}: {
  item: InventarItemRow;
  restaurantId: string;
  onClose: () => void;
  onSaved: (item: InventarItemRow) => void;
}) {
  const [form, setForm] = useState<FormState>(itemToForm(item));
  const [isPending, startTransition] = useTransition();

  const set = (key: keyof FormState, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.geraet.trim()) {
      toast.error("Gerätename ist erforderlich.");
      return;
    }
    startTransition(async () => {
      const res = await updateInventarItem(item.id, formToData(form));
      if (!res.success) {
        toast.error(res.error);
      } else {
        onSaved(res.item);
        toast.success("Gerät gespeichert.");
      }
    });
  };

  return (
    <ModalShell title="Gerät bearbeiten" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Gerät *">
          <input
            autoFocus
            value={form.geraet}
            onChange={(e) => set("geraet", e.target.value)}
            className={INPUT_CLS}
          />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Marke">
            <input
              value={form.marke}
              onChange={(e) => set("marke", e.target.value)}
              placeholder="z.B. Garland"
              className={INPUT_CLS}
            />
          </FormField>
          <FormField label="Modell">
            <input
              value={form.modell}
              onChange={(e) => set("modell", e.target.value)}
              placeholder="z.B. MWE3S-1"
              className={INPUT_CLS}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Seriennummer">
            <input
              value={form.seriennummer}
              onChange={(e) => set("seriennummer", e.target.value)}
              className={INPUT_CLS}
            />
          </FormField>
          <FormField label="Anschaffungsjahr">
            <input
              type="number"
              min={1990}
              max={2050}
              value={form.anschaffungsjahr}
              onChange={(e) => set("anschaffungsjahr", e.target.value)}
              placeholder="z.B. 2015"
              className={INPUT_CLS}
            />
          </FormField>
        </div>
        <ModalFooter onClose={onClose} isPending={isPending} submitLabel="Speichern" />
      </form>
    </ModalShell>
  );
}

// ─── Delete confirmation ──────────────────────────────────────────────────────

function DeleteConfirm({
  item,
  onCancel,
  onConfirm,
  isPending,
}: {
  item: InventarItemRow;
  onCancel: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <ModalShell title="Gerät löschen" onClose={onCancel}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
          <AlertTriangle size={18} className="text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            Soll <strong>{item.geraet}</strong> wirklich gelöscht werden? Diese Aktion kann nicht
            rückgängig gemacht werden.
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-border bg-muted/50 hover:bg-muted text-sm font-semibold"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="px-5 py-2.5 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-black disabled:opacity-50"
          >
            {isPending ? "Wird gelöscht…" : "Löschen"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  section: InventarSectionDetail;
  restaurantName: string;
  restaurantId: string;
  canEdit: boolean;
};

export default function InventarSectionClient({
  section: initialSection,
  restaurantName,
  restaurantId,
  canEdit,
}: Props) {
  const [items, setItems] = useState<InventarItemRow[]>(initialSection.items);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState<null | keyof FilterState>(null);
  const [filters, setFilters] = useState<FilterState>({
    geraet: new Set<string>(),
    marke: new Set<string>(),
    modell: new Set<string>(),
    seriennummer: new Set<string>(),
    anschaffungsjahr: new Set<string>(),
  });
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventarItemRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<InventarItemRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pdfModal, setPdfModal] = useState<{ url: string; title: string } | null>(null);
  const [exportingPdf, startExportPdf] = useTransition();

  const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().trim();
  const filtered = items.filter((it) => {
    const q = norm(search);
    const matchGlobal =
      !q ||
      norm(it.geraet).includes(q) ||
      norm(it.marke).includes(q) ||
      norm(it.modell).includes(q) ||
      norm(it.seriennummer).includes(q) ||
      norm(it.anschaffungsjahr ? String(it.anschaffungsjahr) : "").includes(q);

    const vGeraet = it.geraet?.trim() ?? "";
    const vMarke = it.marke?.trim() ?? "";
    const vModell = it.modell?.trim() ?? "";
    const vSn = it.seriennummer?.trim() ?? "";
    const vYear = it.anschaffungsjahr ? String(it.anschaffungsjahr) : "";

    const f = filters;
    const matchCols =
      (f.geraet.size === 0 || f.geraet.has(vGeraet)) &&
      (f.marke.size === 0 || f.marke.has(vMarke)) &&
      (f.modell.size === 0 || f.modell.has(vModell)) &&
      (f.seriennummer.size === 0 || f.seriennummer.has(vSn)) &&
      (f.anschaffungsjahr.size === 0 || f.anschaffungsjahr.has(vYear));

    return matchGlobal && matchCols;
  });

  const handleDelete = () => {
    if (!deleteItem) return;
    startTransition(async () => {
      const res = await deleteInventarItem(deleteItem.id);
      if (!res.success) {
        toast.error(res.error);
      } else {
        setItems((prev) => prev.filter((it) => it.id !== deleteItem.id));
        setDeleteItem(null);
        toast.success("Gerät gelöscht.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-background pb-16 font-sans text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8">

        {/* ── Header ── */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/tools/inventar"
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-[#1a3826] dark:hover:text-[#FFC72C] mb-3"
            >
              <ArrowLeft size={18} /> Zurück zu Equipment
            </Link>
            <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter mb-2 flex items-center gap-3">
              {initialSection.name}
              <span className="text-base px-2.5 py-1 rounded-full bg-[#FFC72C] text-[#1a3826] font-black">
                {items.length}
              </span>
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              Restaurant {restaurantName}
            </p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                type="button"
                onClick={() => {
                  startExportPdf(() => {
                    const detail: InventarSectionDetail = { ...initialSection, items: filtered };
                    const url = generateSectionPDF(detail, restaurantName);
                    setPdfModal({ url, title: `Equipment – ${initialSection.name} – ${restaurantName}` });
                  });
                }}
                disabled={exportingPdf}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#1a3826]/15 bg-white hover:bg-[#1a3826]/5 text-[#1a3826] text-sm font-black min-h-[44px] touch-manipulation transition"
              >
                {exportingPdf ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                PDF
              </button>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a3826] hover:bg-[#1a3826]/90 text-[#FFC72C] text-sm font-black min-h-[44px] touch-manipulation transition"
              >
                <Plus size={16} />
                Neues Gerät
              </button>
            </div>
          )}
        </div>

      <div className="mt-6 space-y-4">
        {/* Search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-[#1a3826]/15 dark:border-[#FFC72C]/20 bg-gradient-to-br from-emerald-50/80 via-card to-[#1a3826]/5 dark:from-[#1a3826]/15 dark:via-card dark:to-[#1a3826]/10 px-4 py-2.5 max-w-sm shadow-sm focus-within:ring-2 focus-within:ring-[#1a3826]/20 dark:focus-within:ring-[#FFC72C]/20 transition-all">
            <Search size={15} className="text-[#1a3826]/50 dark:text-[#FFC72C]/60 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen…"
              className="flex-1 bg-transparent text-sm focus:outline-none text-foreground placeholder:text-muted-foreground"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")}>
                <X size={13} className="text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              setFilters({
                geraet: new Set(),
                marke: new Set(),
                modell: new Set(),
                seriennummer: new Set(),
                anschaffungsjahr: new Set(),
              })
            }
            className="text-xs font-bold text-muted-foreground hover:text-[#1a3826] dark:hover:text-[#FFC72C] px-3 py-2 rounded-lg hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10 transition-colors w-fit"
          >
            Filter zurücksetzen
          </button>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-visible">
          {/* Table header */}
          <div className="bg-[#1a3826] px-4 py-3 relative z-[20]">
            <div
              className={`grid gap-3 text-[10px] font-black text-[#FFC72C]/80 uppercase tracking-wider ${
                canEdit
                  ? "grid-cols-[2.2fr_1.2fr_1.2fr_1.4fr_0.8fr_44px]"
                  : "grid-cols-[2.2fr_1.2fr_1.2fr_1.4fr_0.8fr]"
              }`}
            >
              <span>Gerät</span>
              <span>Marke</span>
              <span>Modell</span>
              <span>Seriennummer</span>
              <span>Baujahr</span>
              {canEdit && <span />}
            </div>
          </div>
          {/* Column filters (checkbox popovers) */}
          <div className="px-4 py-3 border-b border-border bg-card/60 relative z-[30]">
            {(() => {
              const values = {
                geraet: uniq(items.map((i) => i.geraet ?? "")),
                marke: uniq(items.map((i) => i.marke ?? "")),
                modell: uniq(items.map((i) => i.modell ?? "")),
                seriennummer: uniq(items.map((i) => i.seriennummer ?? "")),
                anschaffungsjahr: uniq(items.map((i) => (i.anschaffungsjahr ? String(i.anschaffungsjahr) : ""))),
              } as const;

              const btn = (key: keyof FilterState, label: string) => (
                <div key={key} className="relative">
                  <button
                    type="button"
                    onClick={() => setFilterOpen((v) => (v === key ? null : key))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition flex items-center justify-between gap-2"
                    title="Filtern"
                  >
                    <span className="truncate">{label}</span>
                    <span className="shrink-0 rounded-full bg-[#1a3826]/10 px-2 py-0.5 text-[10px] font-black text-[#1a3826]">
                      {filters[key].size}
                    </span>
                  </button>
                  {filterOpen === key && (
                    <FilterPopover
                      title={label}
                      values={values[key]}
                      selected={filters[key]}
                      onToggle={(value) => {
                        setFilters((prev) => {
                          const next = { ...prev } as FilterState;
                          const set = new Set(next[key]);
                          if (set.has(value)) set.delete(value);
                          else set.add(value);
                          next[key] = set;
                          return next;
                        });
                      }}
                      onClose={() => setFilterOpen(null)}
                    />
                  )}
                </div>
              );

              return (
                <div
                  className={`grid gap-3 ${
                    canEdit
                      ? "grid-cols-[2.2fr_1.2fr_1.2fr_1.4fr_0.8fr_44px]"
                      : "grid-cols-[2.2fr_1.2fr_1.2fr_1.4fr_0.8fr]"
                  }`}
                >
                  {btn("geraet", "Gerät")}
                  {btn("marke", "Marke")}
                  {btn("modell", "Modell")}
                  {btn("seriennummer", "Seriennummer")}
                  {btn("anschaffungsjahr", "Baujahr")}
                  {canEdit && <div />}
                </div>
              );
            })()}
          </div>

          {filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              {search ? "Keine Ergebnisse für diese Suche." : "Keine Geräte in dieser Sektion."}
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-b-2xl">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className={`group grid gap-3 px-4 py-3 items-center hover:bg-muted/30 transition-colors ${
                    canEdit
                      ? "grid-cols-[2.2fr_1.2fr_1.2fr_1.4fr_0.8fr_44px]"
                      : "grid-cols-[2.2fr_1.2fr_1.2fr_1.4fr_0.8fr]"
                  }`}
                >
                  <span className="text-sm font-semibold text-foreground truncate">
                    {item.geraet}
                  </span>
                  <span className="text-sm text-muted-foreground truncate">
                    {item.marke || "—"}
                  </span>
                  <span className="text-sm text-muted-foreground truncate">
                    {item.modell || "—"}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground truncate">
                    {item.seriennummer || "—"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {item.anschaffungsjahr || "—"}
                  </span>
                  {canEdit && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => setEditItem(item)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-[#1a3826] dark:hover:text-[#FFC72C] hover:bg-[#1a3826]/10 transition"
                        title="Bearbeiten"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteItem(item)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                        title="Löschen"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats footer */}
        <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground">
              {items.filter((i) => i.seriennummer).length}
            </strong>{" "}
            / {items.length} mit Seriennummer
          </span>
        </div>
      </div>
      </div>

      {/* Add modal */}
      {addOpen && (
        <AddModal
          sectionName={initialSection.name}
          sectionId={initialSection.id}
          restaurantId={restaurantId}
          onClose={() => setAddOpen(false)}
          onSaved={(item) => {
            setItems((prev) => [...prev, item]);
            setAddOpen(false);
            toast.success("Gerät hinzugefügt.");
          }}
        />
      )}

      {/* Edit modal */}
      {editItem && (
        <EditModal
          item={editItem}
          restaurantId={restaurantId}
          onClose={() => setEditItem(null)}
          onSaved={(item) => {
            setItems((prev) => prev.map((it) => (it.id === item.id ? item : it)));
            setEditItem(null);
          }}
        />
      )}

      {/* Delete confirm */}
      {deleteItem && (
        <DeleteConfirm
          item={deleteItem}
          onCancel={() => setDeleteItem(null)}
          onConfirm={handleDelete}
          isPending={isPending}
        />
      )}

      {pdfModal && (
        <PdfPreviewModal
          url={pdfModal.url}
          title={pdfModal.title}
          onClose={() => {
            try {
              URL.revokeObjectURL(pdfModal.url);
            } catch {
              // ignore
            }
            setPdfModal(null);
          }}
        />
      )}
    </div>
  );
}
