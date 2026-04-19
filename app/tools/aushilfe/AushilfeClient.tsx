"use client";

import { useState, useTransition, useCallback, useEffect, useMemo } from "react";
import {
  ClipboardList,
  MapPin,
  Plus,
  CheckCircle2,
  Clock,
  Users,
  CalendarDays,
  Archive,
  ChevronDown,
  X,
  Loader2,
  Trash2,
  FileText,
  Layers,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  createHelpRequest,
  fillHelpSlot,
  getArchivedByMonth,
  archiveHelpRequest,
  deleteHelpRequest,
  getAushilfeSectorOptions,
  type HelpRequestRow,
  type SectorOption,
} from "@/app/actions/aushilfeActions";
import { generateAushilfePDF } from "@/lib/aushilfePdf";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

type Restaurant = { id: string; code: string; name: string | null };

interface Props {
  initialActiveRequests: HelpRequestRow[];
  accessibleRestaurants: Restaurant[];
  providingRestaurants: Restaurant[];
  defaultActiveRestaurantId: string;
  requesterName: string;
  userRole: string;
  userId: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

const DE_MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const DE_MONTHS_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const SHIFT_LABELS: Record<number, string> = {
  1: "Schicht 1 (Frühschicht)",
  2: "Schicht 2 (Mittelschicht)",
  3: "Schicht 3 (Spätschicht)",
};

const SHIFT_SHORT: Record<number, string> = {
  1: "Schicht 1",
  2: "Schicht 2",
  3: "Schicht 3",
};

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString("de-AT", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatRestaurantLine(r: { code: string; name: string | null } | undefined): string {
  if (!r) return "–";
  const name = (r.name ?? "").trim();
  const code = (r.code ?? "").trim();
  if (!name) return code || "–";
  if (!code || name === code) return name;
  return `${name} (${code})`;
}

function restShort(r: { code: string; name: string | null } | undefined): string {
  if (!r) return "–";
  const name = (r.name ?? "").trim();
  return name || (r.code ?? "").trim() || "–";
}

function formatRequesterName(u: { name: string | null; email: string | null } | null | undefined): string | null {
  if (!u) return null;
  return u.name?.trim() || u.email?.trim() || null;
}

function restaurantNumberBadge(r: { code: string; name: string | null } | undefined): string {
  if (!r) return "–";
  return (r.code ?? "").trim() || (r.name ?? "").trim() || "–";
}

/** Display shift + sector or legacy shiftTime */
function shiftDisplay(request: HelpRequestRow): string {
  // Legacy: only shiftTime was set (shiftNumber is default 1 from migration, sectorKey is default)
  if (request.shiftTime && !request.sectorKey) {
    return request.shiftTime;
  }
  const shift = SHIFT_SHORT[request.shiftNumber] ?? `Schicht ${request.shiftNumber}`;
  const sector = request.sectorLabel || request.sectorKey || "–";
  return `${shift} · ${sector}`;
}

/* ─── Progress Bar ───────────────────────────────────────────────────────────── */

function ProgressBar({ filled, total, muted = false, variant = "default" }: {
  filled: number; total: number; muted?: boolean; variant?: "default" | "card" | "brandDark";
}) {
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  const full = filled >= total;
  if (variant === "brandDark") {
    return (
      <div className="flex items-center gap-2.5">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
          <div
            className={`h-full rounded-full transition-all duration-500 ${full ? "bg-emerald-400" : "bg-[#FFC72C]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 whitespace-nowrap tabular-nums text-xs font-black text-white/90">
          {filled}/{total}
        </span>
      </div>
    );
  }
  if (variant === "card") {
    return (
      <div className="flex items-center gap-2.5">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full transition-all duration-500 ${full ? "bg-emerald-500" : "bg-[#1a3826]"}`}
            style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 whitespace-nowrap tabular-nums text-xs font-black text-slate-500">
          {filled}/{total}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex-1 h-2 rounded-full overflow-hidden ${muted ? "bg-slate-200" : "bg-[#1a3826]/20"}`}>
        <div className={`h-full rounded-full transition-all duration-500 ${full ? (muted ? "bg-emerald-500" : "bg-emerald-600") : (muted ? "bg-slate-400" : "bg-[#1a3826]")}`}
          style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[11px] font-black whitespace-nowrap tabular-nums shrink-0 ${muted ? "text-slate-500" : "text-[#1a3826]"}`}>
        {filled}/{total}
      </span>
    </div>
  );
}

/* ─── Slot Row ───────────────────────────────────────────────────────────────── */

function SlotRow({ index, slot, requestId, restaurants, userRestaurantId, onFilled }: {
  index: number;
  slot: HelpRequestRow["slots"][number] | undefined;
  requestId: string;
  restaurants: Restaurant[];
  userRestaurantId: string;
  onFilled: () => void;
}) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [selectedRestId, setSelectedRestId] = useState(userRestaurantId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await fillHelpSlot(requestId, selectedRestId, name.trim());
      if (res.success) {
        toast.success("Mitarbeiter eingetragen.");
        setName("");
        onFilled();
      } else {
        toast.error(res.error ?? "Fehler beim Eintragen.");
      }
    });
  }

  if (slot) {
    const managerName = slot.providerManager?.name?.trim() || slot.providerManager?.email?.trim() || null;
    const restCode = (slot.providingRestaurant.code ?? "").trim() || (slot.providingRestaurant.name ?? "").trim();
    return (
      <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-emerald-50 border border-emerald-100">
        <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
        <div className="flex-1 min-w-0 space-y-0.5">
          <span className="text-sm font-bold text-slate-800 truncate block">{slot.workerName}</span>
          {managerName && (
            <span className="text-[10px] text-slate-500 block truncate">
              Geschickt von: <span className="font-semibold text-slate-700">{managerName}</span> #{restCode}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
      <select
        value={selectedRestId}
        onChange={e => setSelectedRestId(e.target.value)}
        disabled={pending}
        className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:border-[#1a3826] disabled:opacity-60 min-w-[140px]"
      >
        {restaurants.map(r => (
          <option key={r.id} value={r.id}>{formatRestaurantLine(r)}</option>
        ))}
      </select>
      <input
        type="text"
        placeholder={`Platz ${index + 1}: Name des Mitarbeiters...`}
        value={name}
        onChange={e => setName(e.target.value)}
        disabled={pending}
        maxLength={80}
        className="flex-1 rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-base placeholder:text-slate-300 text-slate-800 focus:outline-none focus:border-[#1a3826] disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="inline-flex items-center gap-1.5 rounded-xl bg-[#1a3826] px-5 py-2.5 text-sm font-black text-[#FFC72C] transition hover:opacity-90 disabled:opacity-40 whitespace-nowrap shrink-0"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
        Eintragen
      </button>
    </form>
  );
}

/* ─── Active Card ────────────────────────────────────────────────────────────── */

function ActiveCard({ request, onClick }: { request: HelpRequestRow; onClick: () => void }) {
  const filled = request.slots.length;
  const total = request.neededSpots;
  const isFull = filled >= total;
  const von = formatRequesterName(request.createdByUser);
  const restNr = restaurantNumberBadge(request.requestingRestaurant);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left rounded-2xl md:rounded-3xl overflow-hidden min-h-[200px] bg-gradient-to-br from-[#1a3826] via-[#1a3826] to-[#0b1a12] border border-[#FFC72C]/25 shadow-[0_18px_40px_rgba(0,0,0,0.45)] hover:-translate-y-1 hover:border-[#FFC72C]/55 hover:shadow-[0_22px_55px_rgba(0,0,0,0.55)] transition-all duration-300 flex flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFC72C]"
    >
      <div className="h-1 w-full bg-gradient-to-r from-[#FFC72C] via-[#ffe08a] to-[#FFC72C] opacity-90" aria-hidden />

      <div className="flex flex-1 flex-col p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#FFC72C] ring-1 ring-white/15">
              <MapPin size={22} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFC72C]/70">Restaurant</p>
              <p className="text-3xl font-black tabular-nums leading-none tracking-tight text-white">#{restNr}</p>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${
              isFull ? "bg-emerald-500 text-white ring-emerald-400/40" : "bg-[#FFC72C] text-[#1a3826] ring-black/10"
            }`}
          >
            {isFull ? "Voll" : "Offen"}
          </span>
        </div>

        <div className="mt-4 space-y-1">
          <p className="truncate text-sm font-black text-white">{von ?? "Unbekannt"}</p>
          <p className="text-xs font-semibold text-white/55">sucht Aushilfe</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-lg bg-[#FFC72C] px-2.5 py-1 text-[11px] font-bold text-[#1a3826]">
            <CalendarDays size={11} className="shrink-0" />
            {formatDate(request.date)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-[#FFC72C] ring-1 ring-white/15">
            <Clock size={11} className="shrink-0" />
            {SHIFT_SHORT[request.shiftNumber] ?? `Schicht ${request.shiftNumber}`}
          </span>
          {request.sectorLabel && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-white/15">
              <Layers size={11} className="shrink-0 text-[#FFC72C]/90" />
              {request.sectorLabel}
            </span>
          )}
          {request.shiftTime && !request.sectorLabel && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-[#FFC72C]/90 px-2.5 py-1 text-[11px] font-bold text-[#1a3826]">
              <Clock size={11} className="shrink-0" />
              {request.shiftTime}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/90">
            <Users size={11} className="shrink-0 text-[#FFC72C]" />
            {total} {total === 1 ? "Person" : "Personen"}
          </span>
        </div>

        <div className="mt-5 pt-4 border-t border-white/10">
          <ProgressBar filled={filled} total={total} variant="brandDark" />
        </div>

        <p className="mt-3 text-[11px] font-bold text-[#FFC72C]/80 opacity-0 transition group-hover:opacity-100">
          Details anzeigen →
        </p>
      </div>
    </button>
  );
}

/* ─── Detail Modal ───────────────────────────────────────────────────────────── */

function DetailModal({ request, restaurants, userRestaurantId, userId, userRole, onClose, onRefresh }: {
  request: HelpRequestRow;
  restaurants: Restaurant[];
  userRestaurantId: string;
  userId: string;
  userRole: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [archivePending, startArchiveTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const filled = request.slots.length;
  const total = request.neededSpots;
  const von = formatRequesterName(request.createdByUser);
  const isPrivileged = userRole === "ADMIN" || userRole === "SYSTEM_ARCHITECT";
  const isOwner = request.createdByUserId === userId;
  const canDelete = isPrivileged || isOwner;

  function handleArchive() {
    startArchiveTransition(async () => {
      const res = await archiveHelpRequest(request.id);
      if (res.success) { toast.success("Anfrage abgeschlossen."); onClose(); onRefresh(); }
      else toast.error(res.error ?? "Fehler.");
    });
  }

  function handleDelete() {
    if (!confirm("Anfrage wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.")) return;
    startDeleteTransition(async () => {
      const res = await deleteHelpRequest(request.id);
      if (res.success) { toast.success("Anfrage gelöscht."); onClose(); onRefresh(); }
      else toast.error(res.error ?? "Fehler beim Löschen.");
    });
  }

  const restNr = restaurantNumberBadge(request.requestingRestaurant);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-4xl rounded-2xl md:rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[min(92vh,900px)] min-h-0 border border-[#1a3826]/15 animate-in zoom-in-95 duration-200">
        <div className="relative flex items-start justify-between gap-3 bg-gradient-to-br from-[#1a3826] via-[#1a3826] to-[#0b1a12] px-5 py-5 sm:px-7 sm:py-6 shrink-0 border-b border-[#FFC72C]/20">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#FFC72C] via-[#ffe08a] to-[#FFC72C] opacity-90" aria-hidden />
          <div className="flex min-w-0 flex-1 items-start gap-4 pt-0.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#FFC72C] ring-1 ring-white/15">
              <MapPin size={22} strokeWidth={2.4} aria-hidden />
            </div>
            <div className="flex h-[4.5rem] min-w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-[#FFC72C] text-[#1a3826] shadow-inner ring-2 ring-black/10 sm:h-[5rem] sm:min-w-[5rem]" aria-hidden>
              <span className="text-[2.25rem] font-black tabular-nums leading-none sm:text-[2.5rem]">{restNr}</span>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 className="text-base font-black leading-snug text-white sm:text-lg">
                {von ? <><span className="text-[#FFC72C]">{von}</span> sucht Aushilfe im Restaurant <span className="text-[#FFC72C]">{restNr}</span></>
                  : <><span className="text-white">Aushilfe gesucht im Restaurant</span> <span className="text-[#FFC72C]">{restNr}</span></>}
              </h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-[#FFC72C] ring-1 ring-white/15">
                  <Clock size={11} /> {SHIFT_LABELS[request.shiftNumber] ?? `Schicht ${request.shiftNumber}`}
                </span>
                {request.sectorLabel && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[#FFC72C]/15 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-[#FFC72C]/30">
                    <Layers size={11} className="text-[#FFC72C]" /> {request.sectorLabel}
                  </span>
                )}
                {request.shiftTime && !request.sectorLabel && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-[#FFC72C] ring-1 ring-white/15">
                    <Clock size={11} /> {request.shiftTime}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm font-semibold text-white/70">{formatDate(request.date)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Schließen">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6 space-y-4 bg-gradient-to-b from-slate-50/80 to-white">
          {request.notes && (
            <p className="text-sm text-[#1a3826]/90 bg-white rounded-2xl px-4 py-3 border border-[#1a3826]/10 shadow-sm">
              {request.notes}
            </p>
          )}
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-[#1a3826]/10 shadow-sm">
            <Users size={14} className="text-[#1a3826]/50 shrink-0" />
            <div className="flex-1"><ProgressBar filled={filled} total={total} variant="card" /></div>
            <span className="text-xs font-bold text-[#1a3826] whitespace-nowrap">{filled}/{total} Personen</span>
          </div>

          <div className="space-y-3">
            {Array.from({ length: total }).map((_, i) => (
              <SlotRow
                key={`${request.id}-slot-${i}-${request.slots[i]?.id ?? `open-${i}`}`}
                index={i}
                slot={request.slots[i]}
                requestId={request.id}
                restaurants={restaurants}
                userRestaurantId={userRestaurantId}
                onFilled={onRefresh}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[#1a3826]/10 bg-white px-5 py-4 sm:px-8 shrink-0">
          <button
            type="button"
            onClick={() => generateAushilfePDF(request)}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#1a3826]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#1a3826] hover:bg-[#1a3826]/5 transition"
          >
            <FileText size={14} /> PDF
          </button>
          {!request.isArchived && (
            <button
              type="button"
              onClick={handleArchive}
              disabled={archivePending}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#1a3826]/15 px-4 py-2.5 text-sm font-bold text-[#1a3826] hover:bg-[#1a3826]/5 transition disabled:opacity-50"
            >
              {archivePending ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
              Abschließen
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deletePending}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl border-2 border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition disabled:opacity-50"
            >
              {deletePending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Löschen
            </button>
          )}
          <button type="button" onClick={onClose}
            className="rounded-xl bg-[#1a3826] px-5 py-2.5 text-sm font-black text-[#FFC72C] hover:opacity-90 transition shadow-md">
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Archive Card Row ───────────────────────────────────────────────────────── */

function ArchiveRow({ request, onClick }: { request: HelpRequestRow; onClick: () => void }) {
  const [open, setOpen] = useState(false);
  const filled = request.slots.length;
  const total = request.neededSpots;
  const von = formatRequesterName(request.createdByUser);

  return (
    <div className="rounded-2xl border border-[#1a3826]/12 bg-gradient-to-br from-emerald-50/50 via-card to-[#1a3826]/[0.03] dark:from-[#1a3826]/15 dark:via-card dark:to-[#1a3826]/5 shadow-sm overflow-hidden">
      <div className="h-0.5 w-full bg-gradient-to-r from-[#FFC72C]/80 via-[#ffe08a] to-[#FFC72C]/80" aria-hidden />
      <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1">
            <span className="font-black text-[#1a3826] dark:text-[#FFC72C] text-sm">
              #{restaurantNumberBadge(request.requestingRestaurant)}
            </span>
            <span className="text-[10px] font-bold uppercase text-muted-foreground">
              · {SHIFT_SHORT[request.shiftNumber] ?? `Schicht ${request.shiftNumber}`}
            </span>
            {request.sectorLabel && (
              <span className="text-[10px] font-bold text-[#1a3826]/70 dark:text-white/70">· {request.sectorLabel}</span>
            )}
            {request.shiftTime && !request.sectorLabel && (
              <span className="text-[10px] font-bold text-muted-foreground">· {request.shiftTime}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-2">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <CalendarDays size={10} className="text-[#FFC72C]" /> {formatDate(request.date)}
            </span>
          </div>
          {von && (
            <p className="text-[10px] font-semibold text-muted-foreground mb-2">
              Anfrage von <span className="font-bold text-foreground">{von}</span>
            </p>
          )}
          <ProgressBar filled={filled} total={total} muted />
        </div>
        <button
          type="button"
          onClick={() => { setOpen(v => !v); onClick(); }}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#1a3826] bg-[#FFC72C]/25 hover:bg-[#FFC72C]/40 transition shrink-0"
        >
          Details <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <div className="border-t border-[#1a3826]/10 px-4 pb-4 pt-3 sm:px-5 space-y-1.5 bg-white/60 dark:bg-black/20">
          {request.slots.map(slot => (
            <div key={slot.id} className="flex items-center gap-2 text-xs text-foreground/80">
              <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
              <span className="font-semibold">{slot.workerName}</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-muted-foreground">{restShort(slot.providingRestaurant)}</span>
            </div>
          ))}
          {filled < total && Array.from({ length: total - filled }).map((_, i) => (
            <div key={`empty-${i}`} className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-2.5 w-2.5 rounded-full border border-muted-foreground/40 shrink-0" />
              <span>Nicht besetzt</span>
            </div>
          ))}
          {request.notes && <p className="mt-2 text-xs text-muted-foreground border-t border-[#1a3826]/10 pt-2">{request.notes}</p>}
        </div>
      )}
    </div>
  );
}

/* ─── Create Modal ───────────────────────────────────────────────────────────── */

function CreateModal({
  open, onClose, accessibleRestaurants, defaultRestaurantId, requesterName, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  accessibleRestaurants: Restaurant[];
  defaultRestaurantId: string;
  requesterName: string;
  onCreated: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [sectorOptions, setSectorOptions] = useState<SectorOption[]>([]);
  const [sectorsLoading, setSectorsLoading] = useState(false);

  const [form, setForm] = useState({
    restaurantId: "",
    date: "",
    shiftNumber: 1,
    sectorKey: "",
    neededSpots: 2,
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    const validDefault = defaultRestaurantId && accessibleRestaurants.some(r => r.id === defaultRestaurantId)
      ? defaultRestaurantId
      : accessibleRestaurants[0]?.id ?? "";
    setForm(f => ({ ...f, restaurantId: validDefault, sectorKey: "" }));
  }, [open, defaultRestaurantId, accessibleRestaurants]);

  // Load sector options whenever restaurantId changes
  useEffect(() => {
    if (!form.restaurantId) return;
    setSectorsLoading(true);
    getAushilfeSectorOptions(form.restaurantId).then(opts => {
      setSectorOptions(opts);
      setForm(f => ({ ...f, sectorKey: opts[0]?.key ?? "" }));
      setSectorsLoading(false);
    });
  }, [form.restaurantId]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: name === "neededSpots" || name === "shiftNumber" ? Number(value) : value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const selectedSector = sectorOptions.find(s => s.key === form.sectorKey);
    if (!selectedSector) { toast.error("Bitte Sektor auswählen."); return; }

    startTransition(async () => {
      const res = await createHelpRequest({
        requestingRestaurantId: form.restaurantId,
        date: form.date,
        shiftNumber: form.shiftNumber,
        sectorKey: form.sectorKey,
        sectorLabel: selectedSector.label,
        neededSpots: form.neededSpots,
        notes: form.notes.trim() || undefined,
      });
      if (res.success) {
        toast.success("Aushilfe-Anfrage erstellt!");
        onCreated();
        onClose();
        setForm(f => ({ ...f, date: "", shiftNumber: 1, sectorKey: "", neededSpots: 2, notes: "" }));
      } else {
        toast.error(res.error ?? "Fehler.");
      }
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl md:rounded-3xl bg-white shadow-2xl overflow-hidden border border-[#1a3826]/15 animate-in zoom-in-95 duration-200">
        <div className="h-1 w-full bg-gradient-to-r from-[#FFC72C] via-[#ffe08a] to-[#FFC72C]" aria-hidden />
        <div className="flex items-center justify-between bg-gradient-to-br from-[#1a3826] to-[#0b1a12] px-6 py-4 border-b border-[#FFC72C]/15">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#FFC72C] ring-1 ring-white/15">
              <ClipboardList size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-white uppercase tracking-tight truncate">Aushilfe anfordern</h2>
              <p className="text-[11px] font-semibold text-white/55">Neue Anfrage für dein Restaurant</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-gradient-to-b from-slate-50/60 to-white">
          {/* Info strip */}
          <div className="rounded-2xl border border-[#1a3826]/12 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#1a3826]/50 mb-0.5">Anfrage stellt</p>
            <p className="text-sm font-black text-[#1a3826]">{requesterName}</p>
          </div>

          {/* Restaurant */}
          {accessibleRestaurants.length === 0 ? (
            <p className="rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Sie haben keinem Restaurant zugewiesen.
            </p>
          ) : accessibleRestaurants.length === 1 ? (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Restaurant</label>
              <div className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800">
                {formatRestaurantLine(accessibleRestaurants[0])}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Restaurant *</label>
              <select name="restaurantId" value={form.restaurantId} onChange={handleChange} required
                className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#1a3826]">
                {accessibleRestaurants.map(r => (
                  <option key={r.id} value={r.id}>{formatRestaurantLine(r)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Datum *</label>
            <input type="date" name="date" value={form.date} onChange={handleChange} required
              className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#1a3826]" />
          </div>

          {/* Schicht – radio buttons */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Schicht *</label>
            <div className="grid grid-cols-3 gap-2">
              {([1, 2, 3] as const).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, shiftNumber: n }))}
                  className={`rounded-xl border-2 py-2.5 text-sm font-black transition ${
                    form.shiftNumber === n
                      ? "border-[#1a3826] bg-[#1a3826] text-[#FFC72C]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-[#1a3826]/40"
                  }`}
                >
                  Schicht {n}
                </button>
              ))}
            </div>
          </div>

          {/* Sektor */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Sektor / Arbeitsbereich *
            </label>
            {sectorsLoading ? (
              <div className="flex items-center gap-2 rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm text-slate-400">
                <Loader2 size={14} className="animate-spin" /> Wird geladen…
              </div>
            ) : (
              <select name="sectorKey" value={form.sectorKey} onChange={handleChange} required
                className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#1a3826]">
                {sectorOptions.map(s => (
                  <option key={s.key} value={s.key}>
                    {s.label}{s.isCustom ? " ✦" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Anzahl Personen */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Anzahl benötigter Personen *
            </label>
            <div className="flex items-center gap-3">
              <input type="range" name="neededSpots" min={1} max={20} value={form.neededSpots}
                onChange={handleChange} className="flex-1 accent-[#1a3826]" />
              <span className="w-10 text-center rounded-xl bg-[#FFC72C] text-[#1a3826] text-lg font-black py-1 shadow-sm">
                {form.neededSpots}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Anmerkungen (optional)
            </label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} maxLength={500}
              placeholder="z.B. Erfahrung an der Kasse erwünscht…"
              className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#1a3826] resize-none" />
          </div>

          <div className="flex gap-3 pt-2 border-t border-[#1a3826]/10">
            <button type="button" onClick={onClose} disabled={pending}
              className="flex-1 rounded-xl border-2 border-[#1a3826]/15 py-2.5 text-sm font-bold text-[#1a3826]/80 hover:bg-[#1a3826]/5 transition disabled:opacity-50">
              Abbrechen
            </button>
            <button type="submit"
              disabled={pending || !form.date || !form.sectorKey || accessibleRestaurants.length === 0 || !form.restaurantId}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1a3826] py-2.5 text-sm font-black text-[#FFC72C] shadow-md hover:opacity-90 transition disabled:opacity-50">
              {pending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Anfrage erstellen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Client Component ──────────────────────────────────────────────────── */

export default function AushilfeClient({
  initialActiveRequests,
  accessibleRestaurants,
  providingRestaurants,
  defaultActiveRestaurantId,
  requesterName,
  userRole,
  userId,
}: Props) {
  const [tab, setTab] = useState<"aktiv" | "archiv">("aktiv");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeRequests, setActiveRequests] = useState<HelpRequestRow[]>(initialActiveRequests);
  const [selectedRequest, setSelectedRequest] = useState<HelpRequestRow | null>(null);

  const now = new Date();
  const archiveYearMin = 2026;
  const archiveYearMax = 2030;
  const initialArchiveYear = Math.min(archiveYearMax, Math.max(archiveYearMin, now.getFullYear()));
  const [archiveMonth, setArchiveMonth] = useState(now.getMonth() + 1);
  const [archiveYear, setArchiveYear] = useState(initialArchiveYear);
  const [archiveRows, setArchiveRows] = useState<HelpRequestRow[]>([]);
  const [archivePending, startArchiveTransition] = useTransition();
  const [archiveLoaded, setArchiveLoaded] = useState(false);

  const loadArchive = useCallback((month: number, year: number) => {
    startArchiveTransition(async () => {
      const rows = await getArchivedByMonth(month, year);
      setArchiveRows(rows);
      setArchiveLoaded(true);
    });
  }, []);

  function handleTabChange(newTab: "aktiv" | "archiv") {
    setTab(newTab);
    if (newTab === "archiv" && !archiveLoaded) loadArchive(archiveMonth, archiveYear);
  }

  const handleRefresh = useCallback(() => {
    startArchiveTransition(async () => {
      const rows = await getArchivedByMonth(archiveMonth, archiveYear);
      setArchiveRows(rows);
    });
  }, [archiveMonth, archiveYear]);

  const stats = useMemo(() => {
    const list = activeRequests;
    const openSlots = list.reduce((acc, r) => acc + Math.max(0, r.neededSpots - r.slots.length), 0);
    const filledSlots = list.reduce((acc, r) => acc + r.slots.length, 0);
    const fullCount = list.filter((r) => r.slots.length >= r.neededSpots).length;
    return { activeCount: list.length, openSlots, filledSlots, fullCount };
  }, [activeRequests]);

  const filterSelectClass =
    "h-10 min-w-[9rem] shrink-0 cursor-pointer rounded-xl border border-[#1a3826]/15 bg-white px-3 pr-8 text-sm font-bold text-[#1a3826] shadow-sm outline-none transition focus:border-[#FFC72C] focus:ring-2 focus:ring-[#FFC72C]/40 [&>option]:bg-white [&>option]:text-[#1a3826]";

  return (
    <div className="min-h-screen bg-background font-sans text-foreground pb-24" lang="de" translate="no">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8">
        {/* Hero */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter mb-2 leading-[1.05]">
              <span className="text-[#1a3826] dark:text-white">Aushilfe</span>{" "}
              <span className="text-[#FFC72C]">Anfragen</span>
            </h1>
            <p className="text-muted-foreground text-sm font-medium max-w-xl">
              Koordiniere kurzfristige Unterstützung zwischen Restaurants – Schicht, Sektor und Plätze auf einen Blick.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1a3826] hover:bg-[#1a3826]/90 text-[#FFC72C] text-sm font-black transition shadow-md self-start md:self-auto"
          >
            <Plus size={16} strokeWidth={2.5} /> Neue Anfrage
          </button>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Aktive Anfragen", value: stats.activeCount, icon: <ClipboardList size={16} /> },
            { label: "Offene Plätze", value: stats.openSlots, icon: <Users size={16} /> },
            { label: "Besetzte Plätze", value: stats.filledSlots, icon: <CheckCircle2 size={16} /> },
            { label: "Vollständig besetzt", value: stats.fullCount, icon: <BadgeCheck size={16} /> },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-2xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-gradient-to-br from-emerald-50/60 via-card to-[#1a3826]/5 dark:from-[#1a3826]/10 dark:via-card dark:to-[#1a3826]/5 px-4 py-3 shadow-sm"
            >
              <div className="h-9 w-9 rounded-xl bg-[#1a3826]/8 dark:bg-[#FFC72C]/10 flex items-center justify-center text-[#1a3826] dark:text-[#FFC72C] shrink-0">
                {stat.icon}
              </div>
              <div className="min-w-0">
                <div className="text-lg font-black text-foreground leading-tight tabular-nums">{stat.value}</div>
                <div className="text-[11px] text-muted-foreground leading-tight">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs + content */}
        <div className="mt-8 flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex rounded-2xl bg-[#1a3826]/8 dark:bg-white/5 p-1 border border-[#1a3826]/12 dark:border-white/10 w-fit max-w-full">
              {(["aktiv", "archiv"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTabChange(t)}
                  className={`px-4 sm:px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition ${
                    tab === t
                      ? "bg-[#1a3826] text-[#FFC72C] shadow-md"
                      : "text-[#1a3826]/70 dark:text-white/70 hover:text-foreground"
                  }`}
                >
                  {t === "aktiv" ? "Aktiv" : "Archiv"}
                </button>
              ))}
            </div>
            {tab === "archiv" && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={archiveMonth}
                  onChange={(e) => {
                    const m = Number(e.target.value);
                    setArchiveMonth(m);
                    loadArchive(m, archiveYear);
                  }}
                  className={filterSelectClass}
                >
                  {DE_MONTHS.map((name, i) => (
                    <option key={i + 1} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={archiveYear}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    setArchiveYear(y);
                    loadArchive(archiveMonth, y);
                  }}
                  className={filterSelectClass}
                >
                  {Array.from({ length: archiveYearMax - archiveYearMin + 1 }, (_, i) => archiveYearMin + i).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                {archivePending && <Loader2 size={18} className="animate-spin text-[#1a3826]/40" />}
              </div>
            )}
          </div>

          {tab === "aktiv" ? (
            activeRequests.length === 0 ? (
              <div className="rounded-2xl md:rounded-3xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-gradient-to-br from-emerald-50/40 via-card to-[#1a3826]/5 dark:from-[#1a3826]/10 dark:via-card dark:to-[#1a3826]/5 shadow-lg p-10 md:p-16 text-center">
                <div className="h-16 w-16 rounded-2xl bg-[#1a3826]/8 dark:bg-[#FFC72C]/12 flex items-center justify-center mx-auto mb-5">
                  <ClipboardList size={30} className="text-[#1a3826] dark:text-[#FFC72C]" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Keine aktiven Anfragen</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                  Erstelle eine neue Anfrage, wenn du kurzfristig Unterstützung für eine Schicht und einen Sektor benötigst.
                </p>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(true)}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1a3826] px-5 py-2.5 text-sm font-black text-[#FFC72C] shadow-md hover:opacity-90 transition"
                >
                  <Plus size={16} /> Jetzt anfragen
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {activeRequests.map((r) => (
                  <ActiveCard key={r.id} request={r} onClick={() => setSelectedRequest(r)} />
                ))}
              </div>
            )
          ) : !archiveLoaded ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Archiv wird geladen…
            </p>
          ) : archiveRows.length === 0 ? (
            <div className="rounded-2xl md:rounded-3xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-gradient-to-br from-emerald-50/40 via-card to-[#1a3826]/5 dark:from-[#1a3826]/10 dark:via-card dark:to-[#1a3826]/5 shadow-lg p-10 md:p-14 text-center">
              <div className="h-14 w-14 rounded-2xl bg-[#1a3826]/8 dark:bg-[#FFC72C]/12 flex items-center justify-center mx-auto mb-4">
                <Archive size={26} className="text-[#1a3826] dark:text-[#FFC72C]" />
              </div>
              <p className="text-sm text-muted-foreground">
                Keine archivierten Anfragen für{" "}
                <span className="font-bold text-foreground">
                  {DE_MONTHS[archiveMonth - 1]} {archiveYear}
                </span>
                .
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {archiveRows.map((r) => (
                <ArchiveRow key={r.id} request={r} onClick={() => setSelectedRequest(r)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        accessibleRestaurants={accessibleRestaurants}
        defaultRestaurantId={defaultActiveRestaurantId}
        requesterName={requesterName}
        onCreated={async () => {
          const rows = await getArchivedByMonth(0, 0); // refresh active
          // Reload active from server – fastest via router refresh pattern
          window.location.reload();
        }}
      />

      {selectedRequest && (
        <DetailModal
          request={selectedRequest}
          restaurants={providingRestaurants}
          userRestaurantId={defaultActiveRestaurantId}
          userId={userId}
          userRole={userRole}
          onClose={() => setSelectedRequest(null)}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}
