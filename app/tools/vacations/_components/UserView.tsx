/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createVacationRequest,
  updateVacationRequest,
  cancelVacationRequest,
  deleteVacationRequest,
} from "@/app/actions/vacationActions";
import { toast } from "sonner";
import {
  Calendar,
  Trash2,
  Info,
  Briefcase,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit,
  Undo2,
  Download,
  Loader2,
} from "lucide-react";
import { Role } from "@prisma/client";
import { formatDateDDMMGGGG } from "@/lib/dateUtils";
import { IS_VACATION_ROLLOUT_PHASE, getEarliestAllowedVacationStart } from "@/lib/vacationConfig";
import {
  exportIndividualReportWithData,
  type UserStat,
  type RequestWithUser,
} from "@/app/tools/vacations/_components/AdminView";

interface VacationRequest {
  id: string;
  start: string;
  end: string;
  days: number;
  status: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  vacationEntitlement: number;
  vacationCarryover: number;
  role: Role;
  usedThisYear: number;
  selectedYearTotal?: number;
  selectedYearRemaining?: number;
}

interface BlockedDay {
  id: string;
  date: string;
  reason: string | null;
}

interface UserViewProps {
  userData: UserData;
  myRequests: VacationRequest[];
  blockedDays: BlockedDay[];
  selectedYear: number;
  /** Globalni praznici za godinu (iz Admin panela) */
  globalHolidays?: { d: number; m: number; label?: string | null }[];
}

const formatDate = (dateStr: string) => formatDateDDMMGGGG(dateStr);

export default function UserView({
  userData,
  myRequests,
  blockedDays,
  selectedYear,
  globalHolidays = [],
}: UserViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [startISO, setStartISO] = useState("");
  const [endISO, setEndISO] = useState("");
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCalModal, setShowCalModal] = useState(false);

  const years = [2025, 2026, 2027, 2028, 2029, 2030];

  const handleYearChange = (y: number) => {
    if (y === selectedYear) return;
    startTransition(() => {
      router.push(`/tools/vacations?year=${y}`);
    });
  };

  // Frontend ograničenje: dozvoljeni datumi prema rollout / standard režimu.
  const earliestStartDateISO = (() => {
    const earliest = getEarliestAllowedVacationStart(new Date());
    return earliest.toISOString().split("T")[0];
  })();

  const formatDeFromISO = (iso: string): string => {
    if (!iso) return "";
    return formatDateDDMMGGGG(iso);
  };

  const parseDeToISO = (value: string): string | null => {
    const raw = value.trim();
    if (!raw) return null;
    const m = raw.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
    if (!m) return null;
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
    const date = new Date(y, mo - 1, d);
    if (Number.isNaN(date.getTime())) return null;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const startLabelHint = IS_VACATION_ROLLOUT_PHASE
    ? `Von (ab 01.01.${new Date().getFullYear()} – Rollout)`
    : "Von (max. 1 Monat zurück)";

  // Koristimo vrijednosti iz page.tsx koje pravilno računaju vacationAllowances po godini
  const used = userData.usedThisYear;
  const total = userData.selectedYearTotal ?? (userData.vacationEntitlement || 0) + (userData.vacationCarryover || 0);
  const remaining = userData.selectedYearRemaining ?? total - used;

  const generateUserPDF = async () => {
    setIsExporting(true);
    try {
      const userStat: UserStat = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        restaurantNames: [],
        department: null,
        departmentColor: null,
        allowance: undefined,
        carriedOver: undefined,
        total,
        used,
        remaining,
      };

      const requestsForPdf: RequestWithUser[] = myRequests.map((req) => ({
        id: req.id,
        start: req.start,
        end: req.end,
        days: req.days,
        status: req.status,
        restaurantName: undefined,
        user: {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          mainRestaurant: "",
        },
      }));

      exportIndividualReportWithData(userStat, requestsForPdf, selectedYear);
    } catch (error) {
      console.error(error);
      alert("Fehler beim Erstellen der PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSubmit = async () => {
    const isoStart = startISO || parseDeToISO(startInput);
    const isoEnd = endISO || parseDeToISO(endInput);

    if (!isoStart || !isoEnd) return alert("Bitte geben Sie Start- und Enddatum im Format TT.MM.JJJJ ein.");

    const startDate = new Date(isoStart);
    startDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const earliestAllowed = getEarliestAllowedVacationStart(today);

    if (startDate < earliestAllowed) {
      const formatted = earliestAllowed.toLocaleDateString("de-AT");
      const message = IS_VACATION_ROLLOUT_PHASE
        ? `Im Rollout-Modus können Anträge nur ab ${formatted} (01.01.${today.getFullYear()}) gestellt werden.`
        : `Urlaubsanträge können höchstens 1 Monat rückwirkend gestellt werden (ab ${formatted}).`;
      return alert(message);
    }
    
    if (new Date(isoStart).getFullYear() !== selectedYear) {
        if(!confirm(`Hinweis: Die gewählten Daten liegen nicht im angezeigten Jahr (${selectedYear}). Trotzdem fortfahren?`)) return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await updateVacationRequest(editingId, { start: isoStart, end: isoEnd });
        toast.success("Gespeichert.");
        setEditingId(null);
      } else {
        await createVacationRequest({ start: isoStart, end: isoEnd });
        toast.success("Gespeichert.");
      }
      setStartISO("");
      setEndISO("");
      setStartInput("");
      setEndInput("");
      router.refresh();
    } catch (e: any) {
      alert(e.message || "Ein Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (req: VacationRequest) => {
      setStartISO(req.start);
      setEndISO(req.end);
      setStartInput(formatDeFromISO(req.start));
      setEndInput(formatDeFromISO(req.end));
      setEditingId(req.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = async (id: string) => {
      if (confirm("Möchten Sie diesen genehmigten Urlaub wirklich stornieren? Ein Administrator muss die Stornierung genehmigen.")) {
          try {
              await cancelVacationRequest(id);
              toast.success("Urlaubsantrag storniert.");
              router.refresh();
          } catch (e: any) {
              alert(e.message);
          }
      }
  };

  const blockedThisYear = blockedDays.filter((d) => new Date(d.date).getFullYear() === selectedYear);

  // Combine holidays + blocked days in one sorted list for the unified table
  type CalEntry =
    | { kind: "holiday"; d: number; m: number; label?: string | null; sortKey: string }
    | { kind: "blocked"; id: string; date: string; reason: string | null; sortKey: string };

  const calEntries: CalEntry[] = [
    ...([...globalHolidays]
      .map((h) => ({
        kind: "holiday" as const,
        d: h.d,
        m: h.m,
        label: h.label,
        sortKey: `${selectedYear}-${String(h.m).padStart(2, "0")}-${String(h.d).padStart(2, "0")}`,
      }))),
    ...blockedThisYear.map((b) => ({
      kind: "blocked" as const,
      id: b.id,
      date: b.date,
      reason: b.reason,
      sortKey: b.date,
    })),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return (
    <div className="min-h-screen bg-background px-4 py-5 sm:p-6 md:p-10 font-sans text-foreground">
      <div
        className={`max-w-7xl mx-auto space-y-6 transition-opacity duration-150 ${
          isPending ? "opacity-60 pointer-events-none" : ""
        }`}
      >
        {/* HEADER */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter">
              MEIN <span className="text-[#FFC72C] dark:text-white">URLAUB</span>
            </h1>
            <p className="text-muted-foreground text-sm font-medium mt-1">
              {userData.name} · Urlaubsübersicht{" "}
              <span className="font-bold text-foreground">{selectedYear}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isPending && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Loader2 size={14} className="animate-spin shrink-0" /> Laden…
              </span>
            )}
            <div className="flex bg-card p-1 rounded-xl shadow-sm border border-border gap-0.5 overflow-x-auto">
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => handleYearChange(y)}
                  disabled={isPending}
                  className={`min-h-[40px] min-w-[44px] px-3 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap touch-manipulation ${
                    selectedYear === y
                      ? "bg-[#1a3826] text-white shadow-md"
                      : "text-muted-foreground hover:bg-accent"
                  } disabled:opacity-70`}
                >
                  {y}
                </button>
              ))}
            </div>
            <button
              onClick={generateUserPDF}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-[#FFC72C] hover:bg-[#e6b225] text-[#1a3826] rounded-xl text-xs font-black uppercase shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              PDF
            </button>
          </div>
        </div>

        {/* STAT CHIPS */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card p-5 rounded-2xl shadow-sm border border-border flex flex-col items-center justify-center">
            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
              GESAMT ({selectedYear})
            </div>
            <div className="text-3xl font-black text-foreground">{total}</div>
          </div>
          <div className="bg-card p-5 rounded-2xl shadow-sm border border-border flex flex-col items-center justify-center">
            <div className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">
              VERBRAUCHT
            </div>
            <div className="text-3xl font-black text-green-700">{used}</div>
          </div>
          <div className="bg-[#1a3826] p-5 rounded-2xl shadow-md flex flex-col items-center justify-center">
            <div className="text-[10px] font-black text-[#FFC72C] uppercase tracking-widest mb-1">
              RESTURLAUB
            </div>
            <div className="text-3xl font-black text-[#FFC72C]">{remaining}</div>
          </div>
        </div>

        {/* MAIN 2-COLUMN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: NEUER ANTRAG */}
          <div className="lg:col-span-2">
            <div className={`bg-card p-6 rounded-2xl shadow-sm border transition-all ${
              editingId
                ? "border-orange-300 dark:border-orange-600 ring-4 ring-orange-50 dark:ring-orange-950/30"
                : "border-border"
            }`}>
              <h3 className="font-bold text-card-foreground mb-5 flex items-center gap-2 text-base">
                {editingId ? (
                  <span className="text-orange-600 flex items-center gap-2">
                    <Edit size={18} /> Antrag bearbeiten
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Calendar className="text-[#1a3826] dark:text-[#FFC72C]" size={18} />
                    Neuer Urlaubsantrag
                  </span>
                )}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                {/* VON */}
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase mb-2 block">
                    {startLabelHint}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={startInput}
                      onChange={(e) => setStartInput(e.target.value)}
                      onBlur={() => {
                        const iso = parseDeToISO(startInput);
                        if (iso) { setStartISO(iso); setStartInput(formatDeFromISO(iso)); }
                      }}
                      placeholder="TT.MM.JJJJ"
                      className="w-full border border-border px-4 py-3.5 min-h-[48px] rounded-xl focus:border-[#1a3826] outline-none font-bold text-foreground bg-muted/50 focus:bg-card transition-colors text-base touch-manipulation pr-11"
                    />
                    <Calendar size={17} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="date"
                      value={startISO}
                      min={earliestStartDateISO}
                      onChange={(e) => { setStartISO(e.target.value); setStartInput(formatDeFromISO(e.target.value)); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 w-8 h-8 cursor-pointer"
                    />
                  </div>
                </div>
                {/* BIS */}
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase mb-2 block">Bis</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={endInput}
                      onChange={(e) => setEndInput(e.target.value)}
                      onBlur={() => {
                        const iso = parseDeToISO(endInput);
                        if (iso) { setEndISO(iso); setEndInput(formatDeFromISO(iso)); }
                      }}
                      placeholder="TT.MM.JJJJ"
                      className="w-full border border-border px-4 py-3.5 min-h-[48px] rounded-xl focus:border-[#1a3826] outline-none font-bold text-foreground bg-muted/50 focus:bg-card transition-colors text-base touch-manipulation pr-11"
                    />
                    <Calendar size={17} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="date"
                      value={endISO}
                      min={startISO || earliestStartDateISO}
                      onChange={(e) => { setEndISO(e.target.value); setEndInput(formatDeFromISO(e.target.value)); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 w-8 h-8 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                {editingId && (
                  <button
                    onClick={() => { setEditingId(null); setStartISO(""); setEndISO(""); setStartInput(""); setEndInput(""); }}
                    className="min-h-[44px] px-6 py-2.5 rounded-lg font-bold uppercase text-sm bg-muted text-muted-foreground hover:bg-accent transition-colors"
                  >
                    Abbrechen
                  </button>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="min-h-[44px] px-8 py-2.5 rounded-lg bg-[#FFBC0D] hover:bg-[#e6b225] text-black font-bold uppercase text-sm shadow-sm active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? "Wird gesendet…" : editingId ? "AKTUALISIEREN" : "ANTRAG STELLEN"}
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/50 p-3 rounded-lg border border-border flex-1">
                  <Info size={13} className="shrink-0 mt-0.5" />
                  <p>Wochenenden und Feiertage werden automatisch abgezogen.</p>
                </div>
                {calEntries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowCalModal(true)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-[11px] font-bold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    <Calendar size={13} />
                    Feiertage &amp; Sperrtage
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: ANTRÄGE-VERLAUF */}
          <div className="bg-card rounded-2xl shadow-sm border border-border flex flex-col">
            <div className="px-5 pt-5 pb-3 border-b border-border flex items-center gap-2">
              <Clock size={16} className="text-[#1a3826] dark:text-[#FFC72C]" />
              <h3 className="font-bold text-card-foreground text-sm uppercase tracking-wide">
                Meine Anträge
              </h3>
              <span className="ml-auto text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {myRequests.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[420px] divide-y divide-border">
              {myRequests.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground italic px-4">
                  Keine Anträge für {selectedYear}.
                </div>
              ) : (
                myRequests.map((req) => {
                  const statusLabel =
                    req.status === "APPROVED" ? "Genehmigt" :
                    req.status === "REJECTED" ? "Abgelehnt" :
                    req.status === "PENDING" ? "Ausstehend" :
                    req.status === "RETURNED" ? "Zurückgesendet" :
                    req.status === "CANCEL_PENDING" ? "Stornierung beantragt" :
                    req.status === "CANCELLED" ? "Storniert" : req.status;

                  const statusColors =
                    req.status === "APPROVED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" :
                    req.status === "REJECTED" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" :
                    req.status === "RETURNED" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" :
                    req.status === "CANCEL_PENDING" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                    req.status === "CANCELLED" ? "bg-muted text-muted-foreground" :
                    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";

                  return (
                    <div key={req.id} className="px-4 py-3 flex items-start justify-between gap-2 hover:bg-muted/30 transition-colors group">
                      <div className="min-w-0">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide mb-1.5 ${statusColors}`}>
                          {statusLabel}
                        </span>
                        <div className="text-xs font-mono text-foreground flex items-center gap-1">
                          <Calendar size={11} className="text-muted-foreground shrink-0" />
                          {formatDate(req.start)} – {formatDate(req.end)}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          <Briefcase size={11} className="inline mr-1" />
                          {req.days} {req.days === 1 ? "Tag" : "Tage"}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {req.status === "PENDING" && (
                          <button
                            onClick={() => { if (confirm("Antrag löschen?")) deleteVacationRequest(req.id); }}
                            className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            title="Löschen"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        {req.status === "RETURNED" && (
                          <button
                            onClick={() => handleEdit(req)}
                            className="p-1.5 rounded text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
                            title="Bearbeiten"
                          >
                            <Edit size={13} />
                          </button>
                        )}
                        {req.status === "APPROVED" && (
                          <button
                            onClick={() => handleCancel(req.id)}
                            className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            title="Stornieren"
                          >
                            <Undo2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* MODAL: Feiertage & Gesperrte Tage */}
      {showCalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCalModal(false); }}
        >
          <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex items-center gap-3">
              <Calendar size={16} className="text-[#1a3826] dark:text-[#FFC72C]" />
              <h2 className="font-bold text-foreground text-sm uppercase tracking-wide">
                Feiertage &amp; Sperrtage {selectedYear}
              </h2>
              <div className="ml-auto flex items-center gap-3 text-[10px] font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Feiertag
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Gesperrt
                </span>
              </div>
              <button
                onClick={() => setShowCalModal(false)}
                className="ml-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <XCircle size={18} />
              </button>
            </div>

            {/* Liste */}
            <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
              {calEntries.length === 0 ? (
                <p className="px-5 py-8 text-sm text-muted-foreground italic text-center">
                  Keine Einträge für {selectedYear}.
                </p>
              ) : (
                calEntries.map((entry, i) =>
                  entry.kind === "holiday" ? (
                    <div key={`h-${i}`} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                      <span className="flex items-center gap-2.5 text-sm text-foreground">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        {entry.label ?? "Feiertag"}
                      </span>
                      <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400 shrink-0 ml-4">
                        {String(entry.d).padStart(2, "0")}.{String(entry.m).padStart(2, "0")}.{selectedYear}
                      </span>
                    </div>
                  ) : (
                    <div key={`b-${entry.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                      <span className="flex items-center gap-2.5 text-sm text-foreground">
                        <span className="inline-block w-2 h-2 rounded-full bg-red-500 shrink-0" />
                        {entry.reason ?? "Gesperrter Tag"}
                      </span>
                      <span className="text-xs font-mono font-semibold text-red-600 dark:text-red-400 shrink-0 ml-4">
                        {formatDate(entry.date)}
                      </span>
                    </div>
                  )
                )
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border bg-muted/30">
              <button
                onClick={() => setShowCalModal(false)}
                className="w-full py-2 rounded-lg bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] text-sm font-bold hover:opacity-90 transition-opacity"
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