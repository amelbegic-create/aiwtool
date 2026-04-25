"use client";

import { useState, useTransition, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
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
  Minus,
} from "lucide-react";
import { toast } from "sonner";
import {
  createHelpRequest,
  fillHelpSlot,
  updateHelpSlot,
  deleteHelpSlot,
  getHelpRequests,
  getArchivedByMonth,
  archiveHelpRequest,
  deleteHelpRequest,
  getAushilfeSectorOptions,
  type HelpRequestRow,
  type HelpRequestPositionRow,
  type SectorOption,
  type PositionInput,
} from "@/app/actions/aushilfeActions";
import { openAushilfePDFPopup } from "@/lib/aushilfePdf";

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
  return (r.name ?? "").trim() || (r.code ?? "").trim() || "–";
}

function formatRequesterName(u: { name: string | null; email: string | null } | null | undefined): string | null {
  if (!u) return null;
  return u.name?.trim() || u.email?.trim() || null;
}

function restaurantNumberBadge(r: { code: string; name: string | null } | undefined): string {
  if (!r) return "–";
  return (r.code ?? "").trim() || (r.name ?? "").trim() || "–";
}

function normalizeShiftTimeText(raw: string): string {
  // Only allow: digits, colon, dash/en-dash, spaces; normalize any dash to en-dash.
  const cleaned = raw.replace(/[^\d:\-–\s]/g, "");
  return cleaned.replace(/\s+/g, " ").replace(/-/g, "–").trimStart();
}

function isValidShiftTimeText(value: string): boolean {
  // Strict: "HH:MM–HH:MM" with optional spaces around the dash.
  return /^\d{2}:\d{2}\s*–\s*\d{2}:\d{2}$/.test(value.trim());
}

/** Total needed and filled across all positions */
function requestTotals(req: HelpRequestRow): { needed: number; filled: number } {
  if (req.positions.length > 0) {
    const needed = req.positions.reduce((s, p) => s + p.neededSpots, 0);
    const filled = req.positions.reduce((s, p) => s + p.slots.length, 0) + req.slots.length;
    return { needed, filled };
  }
  // legacy (no positions)
  return { needed: 0, filled: req.slots.length };
}

/* ─── Progress Bar ───────────────────────────────────────────────────────────── */

function ProgressBar({ filled, total, variant = "default" }: {
  filled: number; total: number; variant?: "default" | "card" | "brandDark" | "position";
}) {
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  const full = filled >= total && total > 0;

  if (variant === "brandDark") {
    return (
      <div className="flex items-center gap-2.5">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
          <div className={`h-full rounded-full transition-all duration-500 ${full ? "bg-emerald-400" : "bg-[#FFC72C]"}`}
            style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 whitespace-nowrap tabular-nums text-xs font-black text-white/90">{filled}/{total}</span>
      </div>
    );
  }
  if (variant === "position") {
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1a3826]/10">
          <div className={`h-full rounded-full transition-all duration-500 ${full ? "bg-emerald-500" : "bg-[#1a3826]"}`}
            style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 whitespace-nowrap tabular-nums text-[10px] font-black text-[#1a3826]/70">{filled}/{total}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all duration-500 ${full ? "bg-emerald-500" : "bg-[#1a3826]"}`}
          style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 whitespace-nowrap tabular-nums text-xs font-black text-slate-500">{filled}/{total}</span>
    </div>
  );
}

/* ─── Active Card ────────────────────────────────────────────────────────────── */

function ActiveCard({ request, onClick }: { request: HelpRequestRow; onClick: () => void }) {
  const { needed, filled } = requestTotals(request);
  const isFull = needed > 0 && filled >= needed;
  const von = formatRequesterName(request.createdByUser);
  const restNr = restaurantNumberBadge(request.requestingRestaurant);
  const showPositions = request.positions.slice(0, 3);
  const moreCount = Math.max(0, request.positions.length - 3);

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
          <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${
            isFull ? "bg-emerald-500 text-white ring-emerald-400/40" : "bg-[#FFC72C] text-[#1a3826] ring-black/10"
          }`}>
            {isFull ? "Voll" : "Offen"}
          </span>
        </div>

        <div className="mt-4 space-y-1">
          <p className="truncate text-sm font-black text-white">{von ?? "Unbekannt"}</p>
          <p className="text-xs font-semibold text-white/55">sucht Aushilfe</p>
        </div>

        <div className="mt-3">
          <span className="inline-flex items-center gap-1 rounded-lg bg-[#FFC72C] px-2.5 py-1 text-[11px] font-bold text-[#1a3826]">
            <CalendarDays size={11} className="shrink-0" />
            {formatDate(request.date)}
          </span>
        </div>

        {showPositions.length > 0 && (
          <div className="mt-4 space-y-2">
            {showPositions.map((pos) => (
              <div key={pos.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/8 px-3 py-2 ring-1 ring-white/10">
                <div className="flex min-w-0 items-center gap-2">
                  <Layers size={11} className="shrink-0 text-[#FFC72C]/80" />
                  <span className="truncate text-[11px] font-bold text-white/90">{pos.sectorLabel}</span>
                  <span className="shrink-0 text-[10px] text-white/50">· {pos.shiftTimeText}</span>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums ${
                  pos.slots.length >= pos.neededSpots ? "bg-emerald-500/25 text-emerald-300" : "bg-white/10 text-[#FFC72C]"
                }`}>
                  {pos.slots.length}/{pos.neededSpots}
                </span>
              </div>
            ))}
            {moreCount > 0 && (
              <p className="text-[10px] font-bold text-white/40">+{moreCount} weitere Position{moreCount > 1 ? "en" : ""}</p>
            )}
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-white/10">
          <ProgressBar filled={filled} total={needed} variant="brandDark" />
        </div>

        <p className="mt-3 text-[11px] font-bold text-[#FFC72C]/80 opacity-0 transition group-hover:opacity-100">
          Details anzeigen →
        </p>
      </div>
    </button>
  );
}

/* ─── Slot Form Row ──────────────────────────────────────────────────────────── */

function SlotFormRow({ index, positionId, requestId, restaurants, userRestaurantId, onFilled }: {
  index: number;
  positionId: string;
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
      const res = await fillHelpSlot(requestId, positionId, selectedRestId, name.trim());
      if (res.success) { toast.success("Mitarbeiter eingetragen."); setName(""); onFilled(); }
      else toast.error(res.error ?? "Fehler.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 mt-2">
      <select value={selectedRestId} onChange={e => setSelectedRestId(e.target.value)} disabled={pending}
        className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:border-[#1a3826] disabled:opacity-60 min-w-[140px]">
        {restaurants.map(r => (
          <option key={r.id} value={r.id}>{formatRestaurantLine(r)}</option>
        ))}
      </select>
      <input type="text" placeholder={`Platz ${index + 1}: Name des Mitarbeiters…`}
        value={name} onChange={e => setName(e.target.value)} disabled={pending} maxLength={80}
        className="flex-1 rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-300 text-slate-800 focus:outline-none focus:border-[#1a3826] disabled:opacity-60" />
      <button type="submit" disabled={pending || !name.trim()}
        className="inline-flex items-center gap-1.5 rounded-xl bg-[#1a3826] px-5 py-2.5 text-sm font-black text-[#FFC72C] transition hover:opacity-90 disabled:opacity-40 whitespace-nowrap shrink-0">
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
        Eintragen
      </button>
    </form>
  );
}

/* ─── Position Block (inside Detail Modal) ───────────────────────────────────── */

function PositionBlock({ pos, requestId, restaurants, userRestaurantId, userId, userRole, onFilled }: {
  pos: HelpRequestPositionRow;
  requestId: string;
  restaurants: Restaurant[];
  userRestaurantId: string;
  userId: string;
  userRole: string;
  onFilled: () => void;
}) {
  const filled = pos.slots.length;
  const total = pos.neededSpots;
  const isFull = filled >= total;
  const emptyCount = Math.max(0, total - filled);
  const isPrivileged = userRole === "ADMIN" || userRole === "SYSTEM_ARCHITECT";
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPending, startEditTransition] = useTransition();

  function startEdit(slotId: string, currentName: string) {
    setEditingSlotId(slotId);
    setEditName(currentName);
  }

  function cancelEdit() {
    setEditingSlotId(null);
    setEditName("");
  }

  function saveEdit() {
    const slotId = editingSlotId;
    if (!slotId) return;
    if (!editName.trim()) return;
    startEditTransition(async () => {
      const res = await updateHelpSlot(slotId, editName.trim());
      if (res.success) {
        toast.success("Eintrag aktualisiert.");
        cancelEdit();
        onFilled();
      } else {
        toast.error(res.error ?? "Fehler.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-[#1a3826]/12 bg-gradient-to-br from-emerald-50/40 to-white overflow-hidden">
      {/* Position header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#1a3826]/5 border-b border-[#1a3826]/10">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1a3826]/10 text-[#1a3826]">
            <Layers size={15} />
          </div>
          <div className="min-w-0">
            <p className="font-black text-[#1a3826] text-sm truncate">{pos.sectorLabel}</p>
            <p className="text-[11px] font-semibold text-[#1a3826]/60 flex items-center gap-1">
              <Clock size={10} /> {pos.shiftTimeText}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
            isFull ? "bg-emerald-100 text-emerald-700" : "bg-[#FFC72C]/25 text-[#1a3826]"
          }`}>
            {filled}/{total}
          </span>
          {isFull && <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />}
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        <ProgressBar filled={filled} total={total} variant="position" />

        {/* Filled slots */}
        {pos.slots.map(slot => {
          const manager = slot.providerManager?.name?.trim() || slot.providerManager?.email?.trim() || null;
          const restCode = (slot.providingRestaurant.code ?? "").trim() || (slot.providingRestaurant.name ?? "").trim();
          const canEditSlot = isPrivileged || (slot.providerManagerId && slot.providerManagerId === userId);
          return (
            <div key={slot.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                {editingSlotId === slot.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      disabled={editPending}
                      maxLength={80}
                      className="flex-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-sm font-bold text-slate-800 outline-none focus:border-[#1a3826] disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={editPending || !editName.trim()}
                      className="rounded-lg bg-[#1a3826] px-3 py-1.5 text-xs font-black text-[#FFC72C] disabled:opacity-50"
                    >
                      Speichern
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={editPending}
                      className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-black text-slate-600 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      Abbrechen
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-bold text-slate-800 truncate block">{slot.workerName}</span>
                    {/* Edit button shows only for the person who created this slot (enforced server-side too) */}
                    {canEditSlot && (
                      <div className="shrink-0 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEdit(slot.id, slot.workerName)}
                          className="rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[10px] font-black text-slate-600 hover:bg-emerald-100"
                          title="Eintrag bearbeiten"
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm("Eintrag wirklich löschen?")) return;
                            startEditTransition(async () => {
                              const res = await deleteHelpSlot(slot.id);
                              if (res.success) {
                                toast.success("Eintrag gelöscht.");
                                if (editingSlotId === slot.id) cancelEdit();
                                onFilled();
                              } else {
                                toast.error(res.error ?? "Fehler.");
                              }
                            });
                          }}
                          className="rounded-lg border border-red-200 bg-white px-2 py-1 text-[10px] font-black text-red-600 hover:bg-red-50"
                          title="Eintrag löschen"
                        >
                          Löschen
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {manager && (
                  <span className="text-[10px] text-slate-500 block truncate">
                    Von: <span className="font-semibold text-slate-700">{manager}</span>
                    {restCode && <> · Restaurant <span className="font-semibold">#{restCode}</span></>}
                  </span>
                )}
                <span className="text-[10px] text-slate-400 block">
                  {new Date(slot.createdAt).toLocaleString("de-AT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          );
        })}

        {/* Empty slots + form */}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <SlotFormRow
            key={`empty-${i}`}
            index={filled + i}
            positionId={pos.id}
            requestId={requestId}
            restaurants={restaurants}
            userRestaurantId={userRestaurantId}
            onFilled={onFilled}
          />
        ))}
      </div>
    </div>
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
  const { needed, filled } = requestTotals(request);
  const von = formatRequesterName(request.createdByUser);
  const isPrivileged = userRole === "ADMIN" || userRole === "SYSTEM_ARCHITECT";
  const isOwner = request.createdByUserId === userId;
  const canArchive = isOwner || isPrivileged;
  const canDelete = isOwner || isPrivileged;
  const restNr = restaurantNumberBadge(request.requestingRestaurant);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-4xl rounded-2xl md:rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[min(92vh,900px)] min-h-0 border border-[#1a3826]/15 animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="relative flex items-start justify-between gap-3 bg-gradient-to-br from-[#1a3826] via-[#1a3826] to-[#0b1a12] px-5 py-5 sm:px-7 sm:py-6 shrink-0 border-b border-[#FFC72C]/20">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#FFC72C] via-[#ffe08a] to-[#FFC72C] opacity-90" aria-hidden />
          <div className="flex min-w-0 flex-1 items-start gap-4 pt-0.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#FFC72C] ring-1 ring-white/15">
              <MapPin size={22} strokeWidth={2.4} aria-hidden />
            </div>
            <div className="flex h-[4.5rem] min-w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-[#FFC72C] text-[#1a3826] shadow-inner ring-2 ring-black/10 sm:h-[5rem] sm:min-w-[5rem]">
              <span className="text-[2.25rem] font-black tabular-nums leading-none sm:text-[2.5rem]">{restNr}</span>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 className="text-base font-black leading-snug text-white sm:text-lg">
                {von ? <><span className="text-[#FFC72C]">{von}</span> sucht Aushilfe im Restaurant <span className="text-[#FFC72C]">{restNr}</span></>
                  : <>Aushilfe gesucht · Restaurant <span className="text-[#FFC72C]">{restNr}</span></>}
              </h2>
              <p className="mt-2 text-sm font-semibold text-white/70">{formatDate(request.date)}</p>
              <div className="mt-2 flex items-center gap-3 text-sm text-white/80">
                <Users size={13} className="text-[#FFC72C] shrink-0" />
                <span className="font-bold">{filled}/{needed} Personen besetzt</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Schließen">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6 space-y-4 bg-gradient-to-b from-slate-50/80 to-white">
          {request.notes && (
            <p className="text-sm text-[#1a3826]/90 bg-white rounded-2xl px-4 py-3 border border-[#1a3826]/10 shadow-sm">
              {request.notes}
            </p>
          )}

          {/* Position blocks */}
          {request.positions.map(pos => (
            <PositionBlock
              key={pos.id}
              pos={pos}
              requestId={request.id}
              restaurants={restaurants}
              userRestaurantId={userRestaurantId}
              userId={userId}
              userRole={userRole}
              onFilled={onRefresh}
            />
          ))}

          {/* Legacy slots (no position) */}
          {request.slots.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Ältere Einträge</p>
              {request.slots.map(slot => {
                const manager = slot.providerManager?.name?.trim() || slot.providerManager?.email?.trim() || null;
                const restCode = (slot.providingRestaurant.code ?? "").trim();
                return (
                  <div key={slot.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white border border-slate-100 mb-2 last:mb-0">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-slate-800 block">{slot.workerName}</span>
                      {manager && <span className="text-[10px] text-slate-500">Von {manager} · #{restCode}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap gap-2 border-t border-[#1a3826]/10 bg-white px-5 py-4 sm:px-7 shrink-0">
          <button type="button" onClick={() => openAushilfePDFPopup(request)}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#1a3826]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#1a3826] hover:bg-[#1a3826]/5 transition">
            <FileText size={14} /> PDF
          </button>
          {!request.isArchived && canArchive && (
            <button type="button" onClick={handleArchive} disabled={archivePending}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#1a3826]/15 px-4 py-2.5 text-sm font-bold text-[#1a3826] hover:bg-[#1a3826]/5 transition disabled:opacity-50">
              {archivePending ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
              Abschließen
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={handleDelete} disabled={deletePending}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl border-2 border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition disabled:opacity-50">
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

/* ─── Archive Row ────────────────────────────────────────────────────────────── */

function ArchiveRow({ request, onClick }: { request: HelpRequestRow; onClick: () => void }) {
  const [open, setOpen] = useState(false);
  const { needed, filled } = requestTotals(request);
  const von = formatRequesterName(request.createdByUser);
  const pct = needed > 0 ? Math.round((filled / needed) * 100) : 0;

  return (
    <div className="rounded-2xl border border-[#1a3826]/12 bg-gradient-to-br from-emerald-50/50 via-card to-[#1a3826]/[0.03] shadow-sm overflow-hidden">
      <div className="h-0.5 w-full bg-gradient-to-r from-[#FFC72C]/80 via-[#ffe08a] to-[#FFC72C]/80" aria-hidden />
      <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1">
            <span className="font-black text-[#1a3826] dark:text-[#FFC72C] text-sm">
              #{restaurantNumberBadge(request.requestingRestaurant)}
            </span>
            {request.positions.slice(0, 2).map(p => (
              <span key={p.id} className="text-[10px] font-bold text-[#1a3826]/70">· {p.sectorLabel} ({p.neededSpots})</span>
            ))}
            {request.positions.length > 2 && (
              <span className="text-[10px] font-bold text-muted-foreground">+{request.positions.length - 2}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-2">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <CalendarDays size={10} className="text-[#FFC72C]" /> {formatDate(request.date)}
            </span>
          </div>
          {von && <p className="text-[10px] font-semibold text-muted-foreground mb-2">
            Anfrage von <span className="font-bold text-foreground">{von}</span>
          </p>}
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full rounded-full bg-[#1a3826] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] font-black text-slate-500 tabular-nums whitespace-nowrap">{filled}/{needed}</span>
          </div>
        </div>
        <button type="button" onClick={() => { setOpen(v => !v); onClick(); }}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#1a3826] bg-[#FFC72C]/25 hover:bg-[#FFC72C]/40 transition shrink-0">
          Details <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <div className="border-t border-[#1a3826]/10 px-4 pb-4 pt-3 sm:px-5 space-y-3 bg-white/60">
          {request.positions.map(pos => (
            <div key={pos.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Layers size={11} className="text-[#FFC72C] shrink-0" />
                <span className="text-xs font-black text-[#1a3826]">{pos.sectorLabel}</span>
                <span className="text-[10px] text-muted-foreground">· {pos.shiftTimeText}</span>
                <span className="ml-auto text-[10px] font-bold text-slate-500 tabular-nums">{pos.slots.length}/{pos.neededSpots}</span>
              </div>
              {pos.slots.map(slot => (
                <div key={slot.id} className="flex items-center gap-2 text-xs text-foreground/80 pl-4">
                  <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                  <span className="font-semibold">{slot.workerName}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-muted-foreground">{restShort(slot.providingRestaurant)}</span>
                </div>
              ))}
              {Array.from({ length: Math.max(0, pos.neededSpots - pos.slots.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="flex items-center gap-2 text-xs text-muted-foreground pl-4">
                  <div className="h-2.5 w-2.5 rounded-full border border-muted-foreground/40 shrink-0" />
                  <span>Nicht besetzt</span>
                </div>
              ))}
            </div>
          ))}
          {request.notes && <p className="text-xs text-muted-foreground border-t border-[#1a3826]/10 pt-2">{request.notes}</p>}
        </div>
      )}
    </div>
  );
}

/* ─── Position Row (inside Create Modal) ────────────────────────────────────── */

function PositionRow({ pos, index, sectors, onChange, onRemove, canRemove }: {
  pos: PositionInput;
  index: number;
  sectors: SectorOption[];
  onChange: (updated: PositionInput) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#1a3826]/12 bg-white p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#1a3826]/60">Position {index + 1}</span>
        {canRemove && (
          <button type="button" onClick={onRemove}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition">
            <Minus size={13} />
          </button>
        )}
      </div>

      {/* Sector + Needed spots */}
      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 mb-1.5">
            Sektor / Bereich *
          </label>
          <select
            value={pos.sectorKey}
            onChange={(e) => {
              const opt = sectors.find((s) => s.key === e.target.value);
              onChange({ ...pos, sectorKey: e.target.value, sectorLabel: opt?.label ?? e.target.value });
            }}
            className="w-full rounded-xl border-2 border-[#1a3826]/15 px-3 py-2.5 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#1a3826]"
          >
            {sectors.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
                {s.isCustom ? " ✦" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 mb-1.5">
            Personen *
          </label>
          <div className="flex items-center justify-between rounded-xl border-2 border-[#1a3826]/15 bg-white px-2 py-2">
            <button
              type="button"
              onClick={() => onChange({ ...pos, neededSpots: Math.max(1, (pos.neededSpots || 1) - 1) })}
              disabled={(pos.neededSpots || 1) <= 1}
              className="h-9 w-9 rounded-lg border border-[#1a3826]/15 bg-white text-[#1a3826] font-black hover:bg-[#1a3826]/5 disabled:opacity-40"
              title="Weniger"
            >
              –
            </button>
            <div className="flex flex-col items-center justify-center px-2">
              <span className="text-sm font-black text-[#1a3826] tabular-nums">{pos.neededSpots || 1}</span>
              <span className="text-[10px] font-bold text-slate-400">max. 5</span>
            </div>
            <button
              type="button"
              onClick={() => onChange({ ...pos, neededSpots: Math.min(5, (pos.neededSpots || 1) + 1) })}
              disabled={(pos.neededSpots || 1) >= 5}
              className="h-9 w-9 rounded-lg border border-[#1a3826]/15 bg-white text-[#1a3826] font-black hover:bg-[#1a3826]/5 disabled:opacity-40"
              title="Mehr"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Shift time text */}
      <div>
        <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 mb-1.5">
          Schicht / Uhrzeit * <span className="font-normal normal-case tracking-normal">(Format: 13:30–20:00)</span>
        </label>
        <input type="text" value={pos.shiftTimeText}
          inputMode="numeric"
          onChange={e => onChange({ ...pos, shiftTimeText: normalizeShiftTimeText(e.target.value) })}
          placeholder="13:30–20:00"
          maxLength={13}
          className="w-full rounded-xl border-2 border-[#1a3826]/15 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#1a3826]" />
        {!pos.shiftTimeText.trim() ? null : !isValidShiftTimeText(pos.shiftTimeText) ? (
          <p className="mt-1 text-[11px] font-semibold text-red-600">Bitte nur Uhrzeit eingeben: 13:30–20:00</p>
        ) : null}
      </div>

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

  const defaultPosition = (): PositionInput => ({
    sectorKey: sectorOptions[0]?.key ?? "kueche",
    sectorLabel: sectorOptions[0]?.label ?? "Küche",
    shiftTimeText: "",
    neededSpots: 1,
  });

  const [restaurantId, setRestaurantId] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [positions, setPositions] = useState<PositionInput[]>([defaultPosition()]);

  useEffect(() => {
    if (!open) return;
    const valid = defaultRestaurantId && accessibleRestaurants.some(r => r.id === defaultRestaurantId)
      ? defaultRestaurantId
      : accessibleRestaurants[0]?.id ?? "";
    setRestaurantId(valid);
    setDate("");
    setReason("");
    setNotes("");
    setPositions([{ sectorKey: "", sectorLabel: "", shiftTimeText: "", neededSpots: 1 }]);
  }, [open, defaultRestaurantId, accessibleRestaurants]);

  useEffect(() => {
    if (!restaurantId) return;
    setSectorsLoading(true);
    getAushilfeSectorOptions(restaurantId).then(opts => {
      setSectorOptions(opts);
      setPositions(prev => prev.map(p => p.sectorKey
        ? p
        : { ...p, sectorKey: opts[0]?.key ?? "", sectorLabel: opts[0]?.label ?? "" }
      ));
      setSectorsLoading(false);
    });
  }, [restaurantId]);

  function addPosition() {
    setPositions(prev => [...prev, {
      sectorKey: sectorOptions[0]?.key ?? "",
      sectorLabel: sectorOptions[0]?.label ?? "",
      shiftTimeText: "",
      neededSpots: 1,
    }]);
  }

  function updatePosition(i: number, updated: PositionInput) {
    setPositions(prev => prev.map((p, idx) => idx === i ? updated : p));
  }

  function removePosition(i: number) {
    setPositions(prev => prev.filter((_, idx) => idx !== i));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) { toast.error("Datum angeben."); return; }
    if (!reason.trim()) { toast.error("Grund angeben."); return; }
    if (positions.length === 0) { toast.error("Mindestens eine Position."); return; }
    for (const p of positions) {
      if (!p.sectorKey) { toast.error("Sektor wählen."); return; }
      if (!p.shiftTimeText.trim()) { toast.error("Schichtzeit eintragen."); return; }
      if (!isValidShiftTimeText(p.shiftTimeText)) { toast.error("Schicht/Uhrzeit: bitte nur Uhrzeit im Format 13:30–20:00."); return; }
    }

    startTransition(async () => {
      const res = await createHelpRequest({
        requestingRestaurantId: restaurantId,
        date,
        positions,
        notes: [reason.trim(), notes.trim()].filter(Boolean).join("\n") || undefined,
      });
      if (res.success) {
        toast.success("Aushilfe-Anfrage erstellt!");
        onCreated();
        onClose();
      } else {
        toast.error(res.error ?? "Fehler.");
      }
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl rounded-2xl md:rounded-3xl bg-white shadow-2xl overflow-hidden border border-[#1a3826]/15 animate-in zoom-in-95 duration-200 flex flex-col max-h-[min(92vh,850px)]">
        {/* Header */}
        <div className="h-1 w-full bg-gradient-to-r from-[#FFC72C] via-[#ffe08a] to-[#FFC72C]" aria-hidden />
        <div className="flex items-center justify-between bg-gradient-to-br from-[#1a3826] to-[#0b1a12] px-6 py-4 border-b border-[#FFC72C]/15 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#FFC72C] ring-1 ring-white/15">
              <ClipboardList size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-white uppercase tracking-tight truncate">Aushilfe anfordern</h2>
              <p className="text-[11px] font-semibold text-white/55">Erstellt von: {requesterName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="overflow-y-auto flex-1 p-6 space-y-5 bg-gradient-to-b from-slate-50/60 to-white">

            {/* Restaurant */}
            {accessibleRestaurants.length === 0 ? (
              <p className="rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Sie haben kein Restaurant zugewiesen.
              </p>
            ) : accessibleRestaurants.length === 1 ? (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 mb-1.5">Restaurant</label>
                <div className="w-full rounded-xl border-2 border-[#1a3826]/15 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800">
                  {formatRestaurantLine(accessibleRestaurants[0])}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 mb-1.5">Restaurant *</label>
                <select value={restaurantId} onChange={e => setRestaurantId(e.target.value)} required
                  className="w-full rounded-xl border-2 border-[#1a3826]/15 px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#1a3826] bg-white">
                  {accessibleRestaurants.map(r => (
                    <option key={r.id} value={r.id}>{formatRestaurantLine(r)}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Date */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 mb-1.5">Datum *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                className="w-full rounded-xl border-2 border-[#1a3826]/15 px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#1a3826] bg-white" />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 mb-1.5">
                Grund *
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                maxLength={200}
                placeholder="z.B. Krankheitsausfall, kurzfristiger Engpass…"
                className="w-full rounded-xl border-2 border-[#1a3826]/15 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#1a3826] bg-white"
              />
            </div>

            {/* Positions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Positionen * ({positions.length})
                </span>
              </div>
              {sectorsLoading ? (
                <div className="flex items-center gap-2 rounded-xl border-2 border-[#1a3826]/12 px-4 py-3 text-sm text-slate-400">
                  <Loader2 size={14} className="animate-spin" /> Sektoren werden geladen…
                </div>
              ) : (
                positions.map((pos, i) => (
                  <PositionRow key={i} pos={pos} index={i} sectors={sectorOptions}
                    onChange={updated => updatePosition(i, updated)}
                    onRemove={() => removePosition(i)}
                    canRemove={positions.length > 1} />
                ))
              )}
              {/* Bottom add-button — visible when there are already positions */}
              {!sectorsLoading && positions.length > 0 && (
                <button type="button" onClick={addPosition}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#1a3826]/25 py-3 text-sm font-bold text-[#1a3826]/70 hover:border-[#1a3826]/60 hover:bg-[#1a3826]/5 hover:text-[#1a3826] transition">
                  <Plus size={14} /> Position hinzufügen
                </button>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 mb-1.5">
                Anmerkungen (optional)
              </label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={500}
                placeholder="z.B. Erfahrung an der Kasse erwünscht…"
                className="w-full rounded-xl border-2 border-[#1a3826]/15 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#1a3826] resize-none bg-white" />
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-[#1a3826]/10 px-6 py-4 bg-white shrink-0">
            <button type="button" onClick={onClose} disabled={pending}
              className="flex-1 rounded-xl border-2 border-[#1a3826]/15 py-2.5 text-sm font-bold text-[#1a3826]/80 hover:bg-[#1a3826]/5 transition disabled:opacity-50">
              Abbrechen
            </button>
            <button type="submit"
              disabled={pending || !date || positions.length === 0 || accessibleRestaurants.length === 0}
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

/* ─── Main Component ─────────────────────────────────────────────────────────── */

export default function AushilfeClient({
  initialActiveRequests,
  accessibleRestaurants,
  providingRestaurants,
  defaultActiveRestaurantId,
  requesterName,
  userRole,
  userId,
}: Props) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"aktiv" | "archiv">("aktiv");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeRequests, setActiveRequests] = useState<HelpRequestRow[]>(initialActiveRequests);
  const [selectedRequest, setSelectedRequest] = useState<HelpRequestRow | null>(null);

  // Deep-link: ?open=<requestId>
  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId && activeRequests.length > 0) {
      const found = activeRequests.find(r => r.id === openId);
      if (found) setSelectedRequest(found);
    }
  }, [searchParams, activeRequests]);

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
      // Refresh active list and update the currently open modal request
      const [fresh, archiveRows] = await Promise.all([
        getHelpRequests(false),
        getArchivedByMonth(archiveMonth, archiveYear),
      ]);
      setActiveRequests(fresh);
      setArchiveRows(archiveRows);
      // Keep the detail modal in sync without closing it
      setSelectedRequest(prev => {
        if (!prev) return prev;
        return fresh.find(r => r.id === prev.id) ?? prev;
      });
    });
  }, [archiveMonth, archiveYear]);

  const stats = useMemo(() => {
    const list = activeRequests;
    const totalNeeded = list.reduce((s, r) => s + requestTotals(r).needed, 0);
    const totalFilled = list.reduce((s, r) => s + requestTotals(r).filled, 0);
    const openSlots = Math.max(0, totalNeeded - totalFilled);
    const fullCount = list.filter(r => { const t = requestTotals(r); return t.needed > 0 && t.filled >= t.needed; }).length;
    return { activeCount: list.length, openSlots, filledSlots: totalFilled, fullCount };
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
              Koordiniere kurzfristige Unterstützung zwischen Restaurants – mehrere Positionen, Sektoren und Schichten pro Anfrage.
            </p>
          </div>
          <button type="button" onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1a3826] hover:bg-[#1a3826]/90 text-[#FFC72C] text-sm font-black transition shadow-md self-start md:self-auto">
            <Plus size={16} strokeWidth={2.5} /> Neue Anfrage
          </button>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Aktive Anfragen", value: stats.activeCount, icon: <ClipboardList size={16} /> },
            { label: "Offene Plätze", value: stats.openSlots, icon: <Users size={16} /> },
            { label: "Besetzte Plätze", value: stats.filledSlots, icon: <CheckCircle2 size={16} /> },
          ].map((stat) => (
            <div key={stat.label}
              className="flex items-center gap-3 rounded-2xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-gradient-to-br from-emerald-50/60 via-card to-[#1a3826]/5 dark:from-[#1a3826]/10 dark:via-card dark:to-[#1a3826]/5 px-4 py-3 shadow-sm">
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

        {/* Tabs */}
        <div className="mt-8 flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex rounded-2xl bg-[#1a3826]/8 dark:bg-white/5 p-1 border border-[#1a3826]/12 dark:border-white/10 w-fit max-w-full">
              {(["aktiv", "archiv"] as const).map(t => (
                <button key={t} type="button" onClick={() => handleTabChange(t)}
                  className={`px-4 sm:px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition ${
                    tab === t
                      ? "bg-[#1a3826] text-[#FFC72C] shadow-md"
                      : "text-[#1a3826]/70 dark:text-white/70 hover:text-foreground"
                  }`}>
                  {t === "aktiv" ? "Aktiv" : "Archiv"}
                </button>
              ))}
            </div>
            {tab === "archiv" && (
              <div className="flex flex-wrap items-center gap-2">
                <select value={archiveMonth}
                  onChange={e => { const m = Number(e.target.value); setArchiveMonth(m); loadArchive(m, archiveYear); }}
                  className={filterSelectClass}>
                  {DE_MONTHS.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
                </select>
                <select value={archiveYear}
                  onChange={e => { const y = Number(e.target.value); setArchiveYear(y); loadArchive(archiveMonth, y); }}
                  className={filterSelectClass}>
                  {Array.from({ length: archiveYearMax - archiveYearMin + 1 }, (_, i) => archiveYearMin + i).map(y =>
                    <option key={y} value={y}>{y}</option>)}
                </select>
                {archivePending && <Loader2 size={18} className="animate-spin text-[#1a3826]/40" />}
              </div>
            )}
          </div>

          {tab === "aktiv" ? (
            activeRequests.length === 0 ? (
              <div className="rounded-2xl md:rounded-3xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-gradient-to-br from-emerald-50/40 via-card to-[#1a3826]/5 shadow-lg p-10 md:p-16 text-center">
                <div className="h-16 w-16 rounded-2xl bg-[#1a3826]/8 flex items-center justify-center mx-auto mb-5">
                  <ClipboardList size={30} className="text-[#1a3826] dark:text-[#FFC72C]" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Keine aktiven Anfragen</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                  Erstelle eine neue Anfrage für eine oder mehrere Positionen/Schichten in deinem Restaurant.
                </p>
                <button type="button" onClick={() => setCreateModalOpen(true)}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1a3826] px-5 py-2.5 text-sm font-black text-[#FFC72C] shadow-md hover:opacity-90 transition">
                  <Plus size={16} /> Jetzt anfragen
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {activeRequests.map(r => (
                  <ActiveCard key={r.id} request={r} onClick={() => setSelectedRequest(r)} />
                ))}
              </div>
            )
          ) : !archiveLoaded ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Archiv wird geladen…
            </p>
          ) : archiveRows.length === 0 ? (
            <div className="rounded-2xl md:rounded-3xl border border-[#1a3826]/10 bg-gradient-to-br from-emerald-50/40 via-card to-[#1a3826]/5 shadow-lg p-10 md:p-14 text-center">
              <div className="h-14 w-14 rounded-2xl bg-[#1a3826]/8 flex items-center justify-center mx-auto mb-4">
                <Archive size={26} className="text-[#1a3826] dark:text-[#FFC72C]" />
              </div>
              <p className="text-sm text-muted-foreground">
                Keine archivierten Anfragen für{" "}
                <span className="font-bold text-foreground">{DE_MONTHS[archiveMonth - 1]} {archiveYear}</span>.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {archiveRows.map(r => (
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
        onCreated={() => { window.location.reload(); }}
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
