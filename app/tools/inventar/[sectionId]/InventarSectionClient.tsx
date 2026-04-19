"use client";

import React, { useState, useTransition, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  FileText,
  Upload,
  X,
  ChevronDown,
  ExternalLink,
  AlertTriangle,
  Check,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  createInventarItem,
  updateInventarItem,
  deleteInventarItem,
  uploadGarantie,
} from "@/app/actions/inventarActions";
import type { InventarSectionDetail, InventarItemRow, InventarItemData } from "@/app/actions/inventarActions";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormState = {
  geraet: string;
  marke: string;
  modell: string;
  seriennummer: string;
  anschaffungsjahr: string;
  garantieUrl: string;
  garantieName: string;
};

const EMPTY_FORM: FormState = {
  geraet: "",
  marke: "",
  modell: "",
  seriennummer: "",
  anschaffungsjahr: "",
  garantieUrl: "",
  garantieName: "",
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
    garantieUrl: item.garantieUrl ?? "",
    garantieName: item.garantieName ?? "",
  };
}

function formToData(form: FormState): InventarItemData {
  return {
    geraet: form.geraet,
    marke: form.marke || null,
    modell: form.modell || null,
    seriennummer: form.seriennummer || null,
    anschaffungsjahr: form.anschaffungsjahr ? parseInt(form.anschaffungsjahr, 10) || null : null,
    garantieUrl: form.garantieUrl || null,
    garantieName: form.garantieName || null,
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

// ─── Guarantee upload ─────────────────────────────────────────────────────────

function GarantieUploader({
  restaurantId,
  currentUrl,
  currentName,
  onUploaded,
}: {
  restaurantId: string;
  currentUrl: string;
  currentName: string;
  onUploaded: (url: string, name: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadGarantie(fd, restaurantId);
      if (!res.success) {
        toast.error(res.error);
      } else {
        onUploaded(res.url, res.fileName);
        toast.success("Garantieschein hochgeladen.");
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
        Garantieschein
      </label>
      <div className="flex items-center gap-2 flex-wrap">
        {currentUrl && (
          <a
            href={currentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1a3826]/20 bg-[#1a3826]/5 text-xs font-semibold text-[#1a3826] dark:text-[#FFC72C] hover:bg-[#1a3826]/10 transition"
          >
            <FileText size={12} />
            {currentName || "Garantieschein"}
            <ExternalLink size={11} />
          </a>
        )}
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted text-xs font-semibold text-muted-foreground transition disabled:opacity-50"
        >
          <Upload size={12} />
          {uploading ? "Wird hochgeladen…" : currentUrl ? "Ersetzen" : "Hochladen"}
        </button>
        {currentUrl && (
          <button
            type="button"
            onClick={() => onUploaded("", "")}
            className="text-xs text-muted-foreground hover:text-destructive transition"
            title="Garantieschein entfernen"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

// ─── Add Modal ────────────────────────────────────────────────────────────────

function AddModal({
  sectionName,
  sectionId,
  restaurantId,
  standardDeviceNames,
  onClose,
  onSaved,
}: {
  sectionName: string;
  sectionId: string;
  restaurantId: string;
  standardDeviceNames: string[];
  onClose: () => void;
  onSaved: (item: InventarItemRow) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isPending, startTransition] = useTransition();
  const [useCustomName, setUseCustomName] = useState(standardDeviceNames.length === 0);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const set = (key: keyof FormState, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const filteredDevices = deviceSearch
    ? standardDeviceNames.filter((d) => d.toLowerCase().includes(deviceSearch.toLowerCase()))
    : standardDeviceNames;

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
        {!useCustomName ? (
          <div className="space-y-1">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Gerät *
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1a3826]/40"
              >
                <span className={form.geraet ? "text-foreground" : "text-muted-foreground"}>
                  {form.geraet || "Gerät aus Standardliste wählen…"}
                </span>
                <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
              </button>
              {dropdownOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
                      <Search size={13} className="text-muted-foreground shrink-0" />
                      <input
                        autoFocus
                        value={deviceSearch}
                        onChange={(e) => setDeviceSearch(e.target.value)}
                        placeholder="Suchen…"
                        className="flex-1 bg-transparent text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {filteredDevices.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          set("geraet", name);
                          setDropdownOpen(false);
                          setDeviceSearch("");
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/5 flex items-center justify-between"
                      >
                        {name}
                        {form.geraet === name && (
                          <Check size={13} className="text-[#1a3826] dark:text-[#FFC72C]" />
                        )}
                      </button>
                    ))}
                    {filteredDevices.length === 0 && (
                      <p className="px-4 py-3 text-sm text-muted-foreground">Keine Ergebnisse.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setUseCustomName(true)}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Benutzerdefinierter Name
            </button>
          </div>
        ) : (
          <FormField label="Gerät *">
            <input
              autoFocus
              value={form.geraet}
              onChange={(e) => set("geraet", e.target.value)}
              placeholder="z.B. Griller 3"
              className={INPUT_CLS}
            />
            {standardDeviceNames.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setUseCustomName(false);
                  set("geraet", "");
                }}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Aus Standardliste wählen
              </button>
            )}
          </FormField>
        )}

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
        <GarantieUploader
          restaurantId={restaurantId}
          currentUrl={form.garantieUrl}
          currentName={form.garantieName}
          onUploaded={(url, name) => {
            set("garantieUrl", url);
            set("garantieName", name);
          }}
        />
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
        <GarantieUploader
          restaurantId={restaurantId}
          currentUrl={form.garantieUrl}
          currentName={form.garantieName}
          onUploaded={(url, name) => {
            set("garantieUrl", url);
            set("garantieName", name);
          }}
        />
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
  standardDeviceNames: string[];
};

export default function InventarSectionClient({
  section: initialSection,
  restaurantName,
  restaurantId,
  canEdit,
  standardDeviceNames,
}: Props) {
  const [items, setItems] = useState<InventarItemRow[]>(initialSection.items);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventarItemRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<InventarItemRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = search
    ? items.filter(
        (it) =>
          it.geraet.toLowerCase().includes(search.toLowerCase()) ||
          (it.marke ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (it.seriennummer ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : items;

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
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a3826] hover:bg-[#1a3826]/90 text-[#FFC72C] text-sm font-black min-h-[44px] touch-manipulation transition self-start md:self-auto"
            >
              <Plus size={16} />
              Neues Gerät
            </button>
          )}
        </div>

      <div className="mt-6 space-y-4">
        {/* Search */}
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

        {/* Table */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="bg-[#1a3826] px-4 py-3">
            <div
              className={`grid gap-3 text-[10px] font-black text-[#FFC72C]/80 uppercase tracking-wider ${
                canEdit
                  ? "grid-cols-[2fr_1.2fr_1.2fr_1.4fr_1fr_1fr_44px]"
                  : "grid-cols-[2fr_1.2fr_1.2fr_1.4fr_1fr_1fr]"
              }`}
            >
              <span>Gerät</span>
              <span>Marke</span>
              <span>Modell</span>
              <span>Seriennummer</span>
              <span>Baujahr</span>
              <span>Garantie</span>
              {canEdit && <span />}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              {search ? "Keine Ergebnisse für diese Suche." : "Keine Geräte in dieser Sektion."}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className={`group grid gap-3 px-4 py-3 items-center hover:bg-muted/30 transition-colors ${
                    canEdit
                      ? "grid-cols-[2fr_1.2fr_1.2fr_1.4fr_1fr_1fr_44px]"
                      : "grid-cols-[2fr_1.2fr_1.2fr_1.4fr_1fr_1fr]"
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
                  <span>
                    {item.garantieUrl ? (
                      <a
                        href={item.garantieUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#1a3826] dark:text-[#FFC72C] hover:underline"
                        title={item.garantieName ?? "Garantieschein"}
                      >
                        <FileText size={13} />
                        <span className="truncate max-w-[80px]">
                          {item.garantieName ?? "PDF"}
                        </span>
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
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
          <span>
            <strong className="text-foreground">
              {items.filter((i) => i.garantieUrl).length}
            </strong>{" "}
            Garantiescheine hinterlegt
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
          standardDeviceNames={standardDeviceNames}
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
    </div>
  );
}
