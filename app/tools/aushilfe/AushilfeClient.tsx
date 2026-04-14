"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import {
  HandHelping,
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
} from "lucide-react";
import { toast } from "sonner";
import {
  createHelpRequest,
  fillHelpSlot,
  getArchivedByMonth,
  archiveHelpRequest,
  deleteHelpRequest,
  type HelpRequestRow,
} from "@/app/actions/aushilfeActions";
import { generateAushilfePDF } from "@/lib/aushilfePdf";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

type Restaurant = { id: string; code: string; name: string | null };

interface Props {
  initialActiveRequests: HelpRequestRow[];
  /** Restorani za koje korisnik smije tražiti pomoć (isti skup kao u top navigaciji). */
  accessibleRestaurants: Restaurant[];
  /** Svi aktivni restorani za odabir „stavljača“ pri popunjavanju slotova. */
  providingRestaurants: Restaurant[];
  /** Aktivni restoran iz navigacije (cookie), već validiran za korisnika. */
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

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString("de-AT", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** Jedan prikaz bez duplog „7 (7)“: kod u zagradi samo ako se razlikuje od naziva. */
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
  const code = (r.code ?? "").trim();
  if (!name) return code || "–";
  if (name === code) return name;
  return name;
}

function formatRequesterName(u: { name: string | null; email: string | null } | null | undefined): string | null {
  if (!u) return null;
  const n = u.name?.trim();
  if (n) return n;
  const e = u.email?.trim();
  return e || null;
}

/** Broj / kod restorana za badge (npr. „1“, „39“). */
function restaurantNumberBadge(r: { code: string; name: string | null } | undefined): string {
  if (!r) return "–";
  const c = (r.code ?? "").trim();
  if (c) return c;
  return (r.name ?? "").trim() || "–";
}

/* ─── Progress Bar ───────────────────────────────────────────────────────────── */

function ProgressBar({
  filled,
  total,
  muted = false,
  variant = "default",
}: {
  filled: number;
  total: number;
  muted?: boolean;
  variant?: "default" | "card";
}) {
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  const full = filled >= total;

  if (variant === "card") {
    return (
      <div className="flex items-center gap-2.5">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              full ? "bg-emerald-500" : "bg-[#1a3826]"
            }`}
            style={{ width: `${pct}%` }}
          />
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
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            full
              ? muted ? "bg-emerald-500" : "bg-emerald-600"
              : muted ? "bg-slate-400" : "bg-[#1a3826]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[11px] font-black whitespace-nowrap tabular-nums shrink-0 ${muted ? "text-slate-500" : "text-[#1a3826]"}`}>
        {filled}/{total}
      </span>
    </div>
  );
}

/* ─── Slot Row (inside detail modal) ────────────────────────────────────────── */

function SlotRow({
  index,
  slot,
  requestId,
  restaurants,
  userRestaurantId,
  onFilled,
}: {
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

/* ─── Active request card (list) ───────────────────────────────────────────── */

function ActiveCard({
  request,
  onClick,
}: {
  request: HelpRequestRow;
  onClick: () => void;
}) {
  const filled = request.slots.length;
  const total = request.neededSpots;
  const isFull = filled >= total;
  const von = formatRequesterName(request.createdByUser);
  const restNr = restaurantNumberBadge(request.requestingRestaurant);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 transition-all duration-200 overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a3826]"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 bg-[#1a3826] px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC72C]/15 ring-1 ring-[#FFC72C]/20">
          <MapPin size={17} className="text-[#FFC72C]" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xl font-black text-white tabular-nums leading-none tracking-tight">
            #{restNr}
          </span>
          <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#FFC72C]/70">
            Restaurant
          </span>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
            isFull
              ? "bg-emerald-500 text-white"
              : "bg-white/15 text-[#FFC72C] ring-1 ring-white/20"
          }`}
        >
          {isFull ? "Voll" : "Offen"}
        </span>
      </div>

      {/* ── Body ── */}
      <div className="px-4 pt-3.5 pb-4 space-y-3">
        {/* Requester info – name always on its own line, subtitle fixed */}
        <div className="space-y-0.5">
          <p className="text-sm font-black text-slate-900 truncate leading-tight">
            {von ?? "Unbekannt"}
          </p>
          <p className="text-xs font-semibold text-slate-400">sucht Aushilfe</p>
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-lg bg-[#FFC72C] px-2.5 py-1 text-[11px] font-bold text-[#1a3826]">
            <CalendarDays size={11} className="shrink-0" />
            {formatDate(request.date)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-[#FFC72C] px-2.5 py-1 text-[11px] font-bold text-[#1a3826]">
            <Clock size={11} className="shrink-0" />
            {request.shiftTime}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-[#FFC72C] px-2.5 py-1 text-[11px] font-bold text-[#1a3826]">
            <Users size={11} className="shrink-0" />
            {total} {total === 1 ? "Person" : "Personen"}
          </span>
        </div>

        {/* Progress bar */}
        <ProgressBar filled={filled} total={total} variant="card" />
      </div>
    </button>
  );
}

/* ─── Detail Modal (slots + archive + delete) ────────────────────────────────── */

function DetailModal({
  request,
  restaurants,
  userRestaurantId,
  userId,
  userRole,
  onClose,
  onRefresh,
}: {
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
      if (res.success) {
        toast.success("Anfrage abgeschlossen.");
        onClose();
        onRefresh();
      } else {
        toast.error(res.error ?? "Fehler.");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Anfrage wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.")) return;
    startDeleteTransition(async () => {
      const res = await deleteHelpRequest(request.id);
      if (res.success) {
        toast.success("Anfrage gelöscht.");
        onClose();
        onRefresh();
      } else {
        toast.error(res.error ?? "Fehler beim Löschen.");
      }
    });
  }

  function handleFilled() {
    onRefresh();
  }

  const restNr = restaurantNumberBadge(request.requestingRestaurant);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[min(92vh,900px)] min-h-0">
        {/* Modal header */}
        <div className="flex items-start justify-between gap-3 bg-[#FFC72C] px-5 py-5 sm:px-7 sm:py-6 shrink-0">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <MapPin className="text-[#1a3826] shrink-0 mt-1.5" size={24} strokeWidth={2.5} aria-hidden />
            <div
              className="flex h-[5rem] min-w-[5rem] shrink-0 items-center justify-center rounded-xl bg-[#1a3826] text-[#FFC72C] shadow-inner ring-2 ring-black/10 sm:h-[5.5rem] sm:min-w-[5.5rem]"
              aria-hidden
            >
              <span className="text-[2.5rem] font-black tabular-nums leading-none sm:text-[2.75rem]">
                {restNr}
              </span>
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <h2 className="text-base font-black leading-snug text-[#1a3826] sm:text-lg">
                {von ? (
                  <>
                    <span className="font-black">{von}</span> sucht Aushilfe im Restaurant{" "}
                    <span className="font-black">{restNr}</span>
                  </>
                ) : (
                  <>
                    <span className="font-black">Aushilfe gesucht im Restaurant</span>{" "}
                    <span className="font-black">{restNr}</span>
                  </>
                )}
              </h2>
              <p className="mt-2 text-sm font-semibold text-[#1a3826]/80">
                {formatDate(request.date)} · {request.shiftTime}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1a3826]/10 text-[#1a3826] transition hover:bg-[#1a3826]/20"
            aria-label="Schließen"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6 space-y-4">
          {/* Notes */}
          {request.notes && (
            <p className="text-xs text-slate-600 italic bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
              {request.notes}
            </p>
          )}

          {/* Progress */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <Users size={14} className="text-slate-400 shrink-0" />
            <div className="flex-1">
              <ProgressBar filled={filled} total={total} />
            </div>
            <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
              {filled}/{total} Personen
            </span>
          </div>

          {/* Slots */}
          <div className="space-y-3">
            {Array.from({ length: total }).map((_, i) => (
              <SlotRow
                key={`${request.id}-slot-${i}-${request.slots[i]?.id ?? `open-${i}`}`}
                index={i}
                slot={request.slots[i]}
                requestId={request.id}
                restaurants={restaurants}
                userRestaurantId={userRestaurantId}
                onFilled={handleFilled}
              />
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-slate-100 px-5 py-4 sm:px-8 flex flex-wrap gap-2 shrink-0 bg-slate-50/80">
          <button
            type="button"
            onClick={() => generateAushilfePDF(request)}
            className="flex items-center gap-1.5 rounded-xl bg-[#FFC72C] px-3 py-2 text-xs font-bold text-[#1a3826] hover:opacity-90 transition"
          >
            <FileText size={12} />
            PDF Export
          </button>

          <button
            type="button"
            onClick={handleArchive}
            disabled={archivePending || deletePending}
            className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition disabled:opacity-50"
          >
            {archivePending ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
            Abschließen
          </button>

          <div className="flex-1" />

          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deletePending || archivePending}
              className="flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition disabled:opacity-50"
            >
              {deletePending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Löschen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Archive Card (grey, compact) ──────────────────────────────────────────── */

function ArchiveCard({ request }: { request: HelpRequestRow }) {
  const [open, setOpen] = useState(false);
  const filled = request.slots.length;
  const total = request.neededSpots;
  const von = formatRequesterName(request.createdByUser);

  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
            <span className="text-sm font-bold text-slate-700 truncate">
              {restShort(request.requestingRestaurant)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition shrink-0"
          >
            Details <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-2">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <CalendarDays size={10} /> {formatDate(request.date)}
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Clock size={10} /> {request.shiftTime}
          </span>
        </div>
        {von && (
          <p className="text-[10px] font-semibold text-slate-500 mb-2">
            Anfrage von <span className="font-bold text-slate-600">{von}</span>
          </p>
        )}
        <ProgressBar filled={filled} total={total} muted />
      </div>

      {open && (
        <div className="border-t border-slate-200 px-4 pb-3 pt-2.5 space-y-1.5">
          {request.slots.map((slot) => (
            <div key={slot.id} className="flex items-center gap-2 text-xs text-slate-600">
              <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
              <span className="font-semibold">{slot.workerName}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-400">{restShort(slot.providingRestaurant)}</span>
            </div>
          ))}
          {filled < total &&
            Array.from({ length: total - filled }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-2 text-xs text-slate-400">
                <div className="h-2.5 w-2.5 rounded-full border border-slate-300 shrink-0" />
                <span>Nicht besetzt</span>
              </div>
            ))}
          {request.notes && (
            <p className="mt-1 text-xs text-slate-400 italic">{request.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Create Modal ───────────────────────────────────────────────────────────── */

function CreateModal({
  open,
  onClose,
  accessibleRestaurants,
  defaultRestaurantId,
  requesterName,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  accessibleRestaurants: Restaurant[];
  defaultRestaurantId: string;
  requesterName: string;
  onCreated: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    restaurantId: "",
    date: "",
    shiftTime: "",
    neededSpots: 2,
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    const validDefault =
      defaultRestaurantId && accessibleRestaurants.some((r) => r.id === defaultRestaurantId)
        ? defaultRestaurantId
        : accessibleRestaurants[0]?.id ?? "";
    setForm((f) => ({ ...f, restaurantId: validDefault }));
  }, [open, defaultRestaurantId, accessibleRestaurants]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: name === "neededSpots" ? Number(value) : value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createHelpRequest({
        requestingRestaurantId: form.restaurantId,
        date: form.date,
        shiftTime: form.shiftTime.trim(),
        neededSpots: form.neededSpots,
        notes: form.notes.trim() || undefined,
      });
      if (res.success) {
        toast.success("Aushilfe-Anfrage erstellt!");
        onCreated();
        onClose();
        setForm(f => ({ ...f, date: "", shiftTime: "", neededSpots: 2, notes: "" }));
      } else {
        toast.error(res.error ?? "Fehler.");
      }
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between bg-[#1a3826] px-6 py-4">
          <div className="flex items-center gap-3">
            <HandHelping size={20} className="text-[#FFC72C]" />
            <h2 className="text-base font-black text-white">Aushilfe anfordern</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 text-white hover:bg-white/20 transition"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="rounded-xl border-2 border-[#1a3826]/15 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
              Anfrage stellt
            </p>
            <p className="text-sm font-black text-[#1a3826]">{requesterName}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Restaurant entspricht Ihrer Auswahl in der oberen Leiste (nur Ihre zugewiesenen Standorte).
            </p>
          </div>

          {accessibleRestaurants.length === 0 ? (
            <p className="rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Sie haben keinem Restaurant zugewiesen. Bitte wenden Sie sich an einen Administrator.
            </p>
          ) : accessibleRestaurants.length === 1 ? (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Restaurant
              </label>
              <div className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800">
                {formatRestaurantLine(accessibleRestaurants[0])}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Restaurant für diese Anfrage *
              </label>
              <select
                name="restaurantId"
                value={form.restaurantId}
                onChange={handleChange}
                required
                className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#1a3826]"
              >
                {accessibleRestaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {formatRestaurantLine(r)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Datum *
              </label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                required
                className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#1a3826]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Schicht (z.B. 06:00–14:00) *
              </label>
              <input
                type="text"
                name="shiftTime"
                value={form.shiftTime}
                onChange={handleChange}
                required
                placeholder="06:00–14:00"
                maxLength={40}
                className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#1a3826]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Anzahl benötigter Personen *
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                name="neededSpots"
                min={1}
                max={20}
                value={form.neededSpots}
                onChange={handleChange}
                className="flex-1 accent-[#1a3826]"
              />
              <span className="w-10 text-center rounded-xl bg-[#FFC72C] text-[#1a3826] text-lg font-black py-1 shadow-sm">
                {form.neededSpots}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Anmerkungen (optional)
            </label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={2}
              maxLength={500}
              placeholder="z.B. Erfahrung an der Kasse erwünscht..."
              className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#1a3826] resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex-1 rounded-xl border-2 border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={
                pending ||
                !form.date ||
                !form.shiftTime ||
                accessibleRestaurants.length === 0 ||
                !form.restaurantId
              }
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FFC72C] py-2.5 text-sm font-black text-[#1a3826] hover:opacity-90 transition disabled:opacity-50"
            >
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

  // Archive state (Jahre 2026–2030)
  const now = new Date();
  const archiveYearMin = 2026;
  const archiveYearMax = 2030;
  const initialArchiveYear = Math.min(
    archiveYearMax,
    Math.max(archiveYearMin, now.getFullYear())
  );
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
    if (newTab === "archiv" && !archiveLoaded) {
      loadArchive(archiveMonth, archiveYear);
    }
  }

  const handleRefresh = useCallback(() => {
    startArchiveTransition(async () => {
      const { getHelpRequests } = await import("@/app/actions/aushilfeActions");
      const fresh = await getHelpRequests(false);
      setActiveRequests(fresh);
      setSelectedRequest((prev) => {
        if (!prev) return null;
        const updated = fresh.find((r) => r.id === prev.id);
        return updated ?? null;
      });
    });
  }, []);

  function handleCardClick(req: HelpRequestRow) {
    setSelectedRequest(req);
  }

  function handleDetailClose() {
    setSelectedRequest(null);
  }

  const yearOptions = Array.from(
    { length: archiveYearMax - archiveYearMin + 1 },
    (_, i) => archiveYearMin + i
  );

  return (
    <>
      {/* ─── Tabs + Create Button ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1 w-fit">
          {(["aktiv", "archiv"] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => handleTabChange(t)}
              className={`flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-bold transition ${
                tab === t ? "bg-[#1a3826] text-[#FFC72C] shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "aktiv" ? <HandHelping size={13} /> : <Archive size={13} />}
              {t === "aktiv" ? "Aktuelle Anfragen" : "Archiv"}
              {t === "aktiv" && activeRequests.length > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                  tab === "aktiv" ? "bg-[#FFC72C] text-[#1a3826]" : "bg-slate-300 text-slate-700"
                }`}>
                  {activeRequests.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          disabled={accessibleRestaurants.length === 0}
          title={
            accessibleRestaurants.length === 0
              ? "Kein Restaurant zugewiesen"
              : undefined
          }
          className="inline-flex items-center gap-2 rounded-xl bg-[#FFC72C] px-5 py-2.5 text-sm font-black text-[#1a3826] shadow-sm shadow-[#FFC72C]/30 hover:-translate-y-0.5 hover:shadow-md hover:shadow-[#FFC72C]/25 transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          <Plus size={16} />
          Aushilfe anfordern
        </button>
      </div>

      {/* ─── AKTIV tab ──────────────────────────────────────────────────────── */}
      {tab === "aktiv" && (
        <>
          {activeRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border-2 border-dashed border-border">
              <HandHelping size={48} className="text-muted-foreground/30 mb-4" />
              <p className="text-base font-semibold text-muted-foreground">Keine aktiven Aushilfe-Anfragen</p>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Klicken Sie auf „Aushilfe anfordern", um eine neue Anfrage zu erstellen.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeRequests.map(req => (
                <ActiveCard
                  key={req.id}
                  request={req}
                  onClick={() => handleCardClick(req)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── ARCHIV tab ─────────────────────────────────────────────────────── */}
      {tab === "archiv" && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-5 p-4 rounded-2xl bg-card border border-border">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Monat auswählen:</p>
            <select
              value={archiveMonth}
              onChange={e => {
                const m = Number(e.target.value);
                setArchiveMonth(m);
                loadArchive(m, archiveYear);
              }}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-[#1a3826]"
            >
              {DE_MONTHS.map((label, i) => (
                <option key={i + 1} value={i + 1}>{label}</option>
              ))}
            </select>
            <select
              value={archiveYear}
              onChange={e => {
                const y = Number(e.target.value);
                setArchiveYear(y);
                loadArchive(archiveMonth, y);
              }}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-[#1a3826]"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            {archivePending && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
          </div>

          {archivePending ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={32} className="animate-spin text-muted-foreground/40" />
            </div>
          ) : archiveRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border-2 border-dashed border-border">
              <Archive size={40} className="text-muted-foreground/30 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">
                Keine archivierten Anfragen für {DE_MONTHS_SHORT[archiveMonth - 1]} {archiveYear}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-semibold">
                {archiveRows.length} Anfrage{archiveRows.length !== 1 ? "n" : ""} im {DE_MONTHS[archiveMonth - 1]} {archiveYear}
              </p>
              {archiveRows.map(req => (
                <ArchiveCard key={req.id} request={req} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Detail Modal ───────────────────────────────────────────────────── */}
      {selectedRequest && (
        <DetailModal
          request={selectedRequest}
          restaurants={providingRestaurants}
          userRestaurantId={defaultActiveRestaurantId}
          userId={userId}
          userRole={userRole}
          onClose={handleDetailClose}
          onRefresh={handleRefresh}
        />
      )}

      {/* ─── Create Modal ───────────────────────────────────────────────────── */}
      <CreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        accessibleRestaurants={accessibleRestaurants}
        defaultRestaurantId={defaultActiveRestaurantId}
        requesterName={requesterName}
        onCreated={handleRefresh}
      />
    </>
  );
}
