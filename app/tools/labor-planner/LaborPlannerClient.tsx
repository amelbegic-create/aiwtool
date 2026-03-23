"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { createPortal } from "react-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, FileDown, CalendarDays, Trash2, Lock, Unlock, StickyNote, MessageSquare } from "lucide-react";
import type { LaborClClientState, LaborPlanPayload } from "@/lib/laborPlannerCl";
import { defaultClState } from "@/lib/laborPlannerCl";
import {
  finishClMonth,
  requestClUnlock,
  approveClUnlock,
  listLaborClGrantCandidates,
  grantClTemporaryEdit,
  revokeClEditGrant,
} from "@/app/actions/laborActions";

// --- TIPOVI (Excel Crewlabor Bedarf) ---

interface DayData {
  day: number;
  dayName: string;
  isWeekend: boolean;
  isHoliday: boolean;
  exists: boolean;
  bruttoUmsatz: string;
  nettoUmsatz: string; // computed: brutto / koeff, or stored
  geplanteProduktivitaetPct: string;
  produktiveStd: string;
  sfStd: string;
  hmStd: string;
  nzEuro: string;
  extraStd: string;
}

interface SavedRow {
  bruttoUmsatz?: string;
  nettoUmsatz?: string;
  geplanteProduktivitaetPct?: string;
  produktiveStd?: string;
  sfStd?: string;
  hmStd?: string;
  nzEuro?: string;
  extraStd?: string;
  // backward compat: old format
  umsatz?: string;
  prod?: string;
  nz?: string;
  extra?: string;
}

interface SavedInputs {
  avgWage?: string;
  vacationStd?: string;
  sickStd?: string;
  extraUnprodStd?: string;
  koefficientBruttoNetto?: string;
  foerderung?: string;
  taxAustria?: string;
  budgetUmsatz?: string;
  budgetCL?: string;
  budgetCLPct?: string;
}

interface LaborPlanData {
  inputs: SavedInputs;
  rows: SavedRow[];
  dayComments?: Record<string, string>;
}

function normalizeDayCommentsFromApi(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const day = parseInt(String(k), 10);
    if (day < 1 || day > 31 || Number.isNaN(day)) continue;
    if (typeof v === "string" && v.trim()) out[String(day)] = v.trim();
  }
  return out;
}

function stripEmptyDayComments(c: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(c).filter(([, v]) => typeof v === "string" && v.trim().length > 0)
  );
}

interface Restaurant {
  id: string;
  code: string;
  name: string | null;
}

/** Tag-Zelle + fixierter Notiz-Popup (nicht von overflow-x-auto abgeschnitten), rechts neben der Spalte. */
function LaborDayTagCell({
  day,
  comment,
  canEditCl,
  onOpenNote,
}: {
  day: Pick<DayData, "day" | "dayName" | "isHoliday">;
  comment: string | undefined;
  canEditCl: boolean;
  onOpenNote: () => void;
}) {
  const tdRef = useRef<HTMLTableCellElement>(null);
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);

  const updateTip = () => {
    if (!comment?.trim()) return;
    const el = tdRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 28;
    const maxW = 300;
    const left = Math.min(r.right + margin, Math.max(8, window.innerWidth - maxW - 8));
    setTipPos({ top: r.top + r.height / 2, left });
  };

  return (
    <>
      <td
        ref={tdRef}
        className={`group relative border border-border p-1 px-2 text-center align-middle text-xs font-bold ${day.isHoliday ? "text-red-600" : "text-gray-700"}`}
        onMouseEnter={updateTip}
        onMouseMove={comment?.trim() ? updateTip : undefined}
        onMouseLeave={() => setTipPos(null)}
      >
        {/* Datum zentriert; Notiz-Icons absolut rechts, damit der Text mit den anderen Zeilen fluchtet */}
        <div className="relative flex min-h-[36px] items-center justify-center px-1">
          <span
            className={`whitespace-nowrap select-none ${canEditCl || comment ? "cursor-pointer" : "cursor-default"}`}
            title={
              canEditCl
                ? "Doppelklick: Tagesnotiz bearbeiten"
                : comment
                  ? "Notiz anzeigen (Doppelklick)"
                  : undefined
            }
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenNote();
            }}
          >
            {day.day}. {day.dayName}
            {day.isHoliday ? " *" : ""}
          </span>
          <div
            className="pointer-events-none absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-0.5"
            aria-hidden
          >
            {comment?.trim() ? (
              <span className="pointer-events-auto inline-flex items-center justify-center drop-shadow-sm" aria-label="Tagesnotiz">
                <MessageSquare
                  size={16}
                  className="text-[#1a3826]"
                  fill="#FFBC0D"
                  stroke="#1a3826"
                  strokeWidth={2}
                  aria-hidden
                />
              </span>
            ) : null}
            {canEditCl ? (
              <StickyNote
                size={12}
                className="pointer-events-auto shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            ) : null}
          </div>
        </div>
      </td>
      {comment?.trim() && tipPos != null && typeof document !== "undefined"
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[99990] w-[min(300px,calc(100vw-4rem))] max-w-[90vw] -translate-y-1/2 rounded-xl border-2 border-[#1a3826]/25 bg-[#FFBC0D] px-3 py-2.5 text-left text-[11px] font-bold leading-snug text-[#1a3826] shadow-[0_8px_24px_rgba(0,0,0,0.22)] whitespace-pre-wrap break-words ring-2 ring-amber-200/90 dark:ring-amber-800/50"
              style={{ top: tipPos.top, left: tipPos.left }}
            >
              <span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-[#1a3826]/80">
                Notiz
              </span>
              {comment}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

interface AutoTableHookData {
  section: "head" | "body" | "foot";
  row: { index: number; raw: string[] };
  cell: { styles: { fillColor?: number[]; textColor?: number[]; fontStyle?: string } };
}

// --- BOJE ---
const COLORS = {
  green: "#1b3a26",
  yellow: "#ffc72c",
  lightGray: "#f3f4f6",
  white: "#ffffff",
  border: "#d1d5db",
  redText: "#dc2626",
};

// --- AUSTRIJSKI NJEMAČKI: mjeseci i dani ---
const MONTH_NAMES_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

const parseDE = (s: string | number | undefined | null): number => {
  if (!s) return 0;
  const clean = String(s).replace(/\./g, "").replace(",", ".");
  const v = parseFloat(clean);
  return isNaN(v) ? 0 : v;
};

/** Unos: i tacka i zarez prihvaćeni (decimal ili tisuće); prikaz uvijek 1.000,00. */
function parseDEFlex(s: string | number | undefined | null): number {
  if (s == null || s === "") return 0;
  const str = String(s).trim().replace(/\s/g, "");
  if (!str) return 0;
  const hasComma = str.includes(",");
  const lastDot = str.lastIndexOf(".");
  if (hasComma) {
    const clean = str.replace(/\./g, "").replace(",", ".");
    const v = parseFloat(clean);
    return isNaN(v) ? 0 : v;
  }
  if (lastDot === -1) {
    const clean = str.replace(/[^\d]/g, "");
    return clean ? parseInt(clean, 10) : 0;
  }
  const afterDot = str.slice(lastDot + 1);
  const beforeDot = str.slice(0, lastDot).replace(/\./g, "");
  if (/^\d{3}$/.test(afterDot) && /^\d{1,3}$/.test(beforeDot)) {
    return parseInt(str.replace(/\./g, ""), 10) || 0;
  }
  const v = parseFloat(beforeDot + "." + afterDot.replace(/[^\d]/g, ""));
  return isNaN(v) ? 0 : v;
}

/** Jedan red CSV-a s podrškom za navodnike (polja mogu sadržavati zarez). */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === "," || c === ";") && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

/** Uklanja € i razmake za brojčani unos. */
function cleanCSVNumber(s: string): string {
  return String(s || "").replace(/€/g, "").replace(/\s/g, "").trim();
}

/** Parsira CSV u formatu CL Analyse (Crewlabor Bedarf): parametri iz B/C, tabela od kolone G. */
function parseLaborCSV(csvText: string): { params: Partial<SavedInputs>; rows: SavedRow[]; monthFromCsv?: number } | null {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 6) return null;

  const params: Partial<SavedInputs> = {};
  const rowsByDay: Record<number, SavedRow> = {};
  let monthFromCsv: number | undefined;

  for (let i = 0; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const col1 = (cells[1] || "").trim();
    const col2 = cleanCSVNumber(cells[2] || "");
    const col3 = (cells[3] || "").trim();

    if (col1.includes("Stundenlohn") && col1.includes("Ø")) params.avgWage = col2 || undefined;
    else if (col1 === "Urlaub Std. geplant") params.vacationStd = col2 || undefined;
    else if (col1.startsWith("Krank Std")) params.sickStd = col2 || undefined;
    else if (col1.includes("Koeffizient Brutto")) params.koefficientBruttoNetto = (cells[2] || cells[4] || "").replace(/"/g, "").trim() || undefined;
    else if (/^[\d,.]+\s*$/.test((cells[4] || "").replace(/"/g, "").trim())) params.koefficientBruttoNetto = (cells[4] || "").replace(/"/g, "").trim() || undefined;
    else if (col1 === "Förderung") params.foerderung = col2 || undefined;
    else if (col1 === "Budget Umsatz") params.budgetUmsatz = col2 || undefined;
    else if (col1.includes("Budget CL (Euro)")) params.budgetCL = col2 || undefined;
    else if (col1.includes("Budget CL(%)")) params.budgetCLPct = col2.replace(/%/g, "").trim() || undefined;

    if (col3 && MONTH_NAMES_DE.includes(col3)) {
      const mi = MONTH_NAMES_DE.indexOf(col3);
      if (mi >= 0) monthFromCsv = mi + 1;
    }

    const dayCell = (cells[6] || "").trim();
    const dayMatch = dayCell.match(/^(\d{1,2})\.$/);
    if (dayMatch) {
      const dayNum = parseInt(dayMatch[1], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        rowsByDay[dayNum] = {
          bruttoUmsatz: cleanCSVNumber(cells[8] || ""),
          nettoUmsatz: cleanCSVNumber(cells[9] || ""),
          geplanteProduktivitaetPct: (cells[10] || "").trim(),
          produktiveStd: (cells[11] || "").trim(),
          sfStd: (cells[12] || "").trim(),
          hmStd: (cells[13] || "").trim(),
          nzEuro: cleanCSVNumber(cells[14] || ""),
          extraStd: (cells[15] || "").trim(),
        };
      }
    }
  }

  const rows: SavedRow[] = [];
  for (let d = 1; d <= 31; d++) rows.push(rowsByDay[d] || {});
  return { params, rows, monthFromCsv };
}

const fmtNum = (n: number, dec: number = 0): string => {
  const value = Number.isFinite(n) ? n : 0;
  const digits = dec ?? 0;
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value || 0);
};

/** Sati: bez vodećih nula (8 umjesto 8,00) */
const fmtHours = (n: number): string => {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n || 0);
};

/**
 * Izračun Produktive Std. za jedan dan po Excel formuli.
 *
 * U originalnom CL Excelu kolona „Produktive Std.“ (L)
 * računa se formulom: =J6/K6-M6
 *  - J → Netto Umsatz
 *  - K → Geplante / gewünschte Produktivität
 *  - M → SF Produktive Std.
 *
 * U našem modelu to su polja:
 *  - nettoUmsatz (ili bruttoUmsatz / koeff)
 *  - geplanteProduktivitaetPct
 *  - sfStd
 */
function calcProduktiveStdForDay(day: DayData, koeff: number): number {
  const brutto = parseDEFlex(day.bruttoUmsatz);
  const fallbackNetto = parseDEFlex(day.nettoUmsatz);
  const netto = koeff > 0 && brutto > 0 ? brutto / koeff : fallbackNetto;
  const geplanteProd = parseDEFlex(day.geplanteProduktivitaetPct);
  const sf = parseDEFlex(day.sfStd);

  if (netto <= 0 || geplanteProd <= 0) return 0;

  const produktive = netto / geplanteProd - sf;
  return Number.isFinite(produktive) ? produktive : 0;
}

// Ista logika, ali za podatke koji dolaze iz baze / CSV-a (SavedRow)
function calcProduktiveStdFromSavedRow(saved: SavedRow, koeff: number): number {
  const brutto = parseDEFlex(saved.bruttoUmsatz ?? saved.umsatz);
  const fallbackNetto = parseDEFlex(saved.nettoUmsatz);
  const netto = koeff > 0 && brutto > 0 ? brutto / koeff : fallbackNetto;
  const geplanteProd = parseDEFlex(saved.geplanteProduktivitaetPct);
  const sf = parseDEFlex(saved.sfStd);

  if (netto <= 0 || geplanteProd <= 0) return 0;

  const produktive = netto / geplanteProd - sf;
  return Number.isFinite(produktive) ? produktive : 0;
}

// --- GLAVNA KOMPONENTA ---
function LaborPlannerContent({ defaultRestaurantId }: { defaultRestaurantId?: string | null }) {
  const [loading, setLoading] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

  const searchParams = useSearchParams();
  const router = useRouter();
  const urlRestaurantId = searchParams.get("restaurantId");

  const initialRestaurantId =
    urlRestaurantId && urlRestaurantId !== "all"
      ? urlRestaurantId
      : defaultRestaurantId && defaultRestaurantId !== "all"
        ? defaultRestaurantId
        : "";

  const [year, setYear] = useState(() => {
    if (typeof window === "undefined") return new Date().getFullYear();
    const s = sessionStorage.getItem("labor-planner-year");
    if (s) { const n = Number(s); if (!Number.isNaN(n)) return n; }
    return new Date().getFullYear();
  });
  const [month, setMonth] = useState(() => {
    if (typeof window === "undefined") return new Date().getMonth() + 1;
    const s = sessionStorage.getItem("labor-planner-month");
    if (s) { const n = Number(s); if (!Number.isNaN(n) && n >= 1 && n <= 12) return n; }
    return new Date().getMonth() + 1;
  });
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(initialRestaurantId);

  const [avgWage, setAvgWage] = useState("");
  const [vacationStd, setVacationStd] = useState("");
  const [sickStd, setSickStd] = useState("");
  const [extraUnprodStd, setExtraUnprodStd] = useState("");
  const [koefficientBruttoNetto, setKoefficientBruttoNetto] = useState(() => fmtNum(1.118, 4));
  const [foerderung, setFoerderung] = useState("");
  const [budgetUmsatz, setBudgetUmsatz] = useState("");
  const [budgetCL, setBudgetCL] = useState("");
  const [budgetCLPct, setBudgetCLPct] = useState("");

  const [daysData, setDaysData] = useState<DayData[]>([]);
  const [holidaysForYear, setHolidaysForYear] = useState<{ d: number; m: number }[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [pdfPopupUrl, setPdfPopupUrl] = useState<string | null>(null);
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  /** Tagesnotizen (Tag 1–31 als String-Key), je Restaurant + Monat in DB (dayComments im Payload). */
  const [dayComments, setDayComments] = useState<Record<string, string>>({});
  const [dayNoteModalDay, setDayNoteModalDay] = useState<number | null>(null);
  const [dayNoteDraft, setDayNoteDraft] = useState("");
  const [dayNoteSaving, setDayNoteSaving] = useState(false);
  const [clMeta, setClMeta] = useState<LaborClClientState>(() => defaultClState());
  const [showFinishMonthModal, setShowFinishMonthModal] = useState(false);
  const [showUnlockRequestModal, setShowUnlockRequestModal] = useState(false);
  const [unlockRequestNote, setUnlockRequestNote] = useState("");
  const [showGrantEditModal, setShowGrantEditModal] = useState(false);
  const [grantCandidates, setGrantCandidates] = useState<
    { id: string; name: string | null; email: string | null }[]
  >([]);
  const [selectedGranteeId, setSelectedGranteeId] = useState("");
  const [loadingGrantList, setLoadingGrantList] = useState(false);
  const canEditCl = clMeta.canEdit;
  const canEditRef = useRef(canEditCl);
  useEffect(() => {
    canEditRef.current = canEditCl;
  }, [canEditCl]);
  const currentRestaurantIdRef = React.useRef<string | null>(null);
  const tableWrapperRef = React.useRef<HTMLDivElement>(null);
  const hasUnsavedChangesRef = React.useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saveDataToDBRef = React.useRef<any>(null);

  const handleTableKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    if (target.tagName !== "INPUT") return;
    e.preventDefault();
    const inputs = tableWrapperRef.current?.querySelectorAll<HTMLInputElement>('input');
    if (!inputs?.length) return;
    const list = Array.from(inputs);
    const idx = list.indexOf(target as HTMLInputElement);
    const nextIdx = idx < 0 ? 0 : (idx + 1) % list.length;
    list[nextIdx]?.focus();
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/holidays?year=${year}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { d: number; m: number }[]) => {
        if (!cancelled && Array.isArray(data)) setHolidaysForYear(data);
      })
      .catch(() => {
        if (!cancelled) setHolidaysForYear([]);
      });
    return () => { cancelled = true; };
  }, [year]);

  // Dohvat restorana + početni restoran iz URL / cookie / prvi
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const res = await fetch("/api/restaurants");
        const data = await res.json();
        setRestaurants(data);

        if (data.length > 0 && !urlRestaurantId && !selectedRestaurantId) {
          const preferred = defaultRestaurantId && data.some((r: Restaurant) => r.id === defaultRestaurantId)
            ? defaultRestaurantId
            : data[0].id;
          const newParams = new URLSearchParams(searchParams.toString());
          newParams.set("restaurantId", preferred);
          router.replace(`?${newParams.toString()}`);
          setSelectedRestaurantId(preferred);
        }
      } catch (err) {
        console.error("Restaurants fetch", err);
      }
    };
    fetchRestaurants();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kad korisnik promijeni restoran u TopNav: cookie se ažurira, router.refresh() pošalje novi defaultRestaurantId – odmah prebaci na njega, ažuriraj URL i učitaj podatke iz baze
  useEffect(() => {
    if (!defaultRestaurantId || defaultRestaurantId === "all") return;
    if (defaultRestaurantId !== selectedRestaurantId) {
      setSelectedRestaurantId(defaultRestaurantId);
      const next = new URLSearchParams(searchParams.toString());
      next.set("restaurantId", defaultRestaurantId);
      router.replace(`?${next.toString()}`, { scroll: false });
    }
  }, [defaultRestaurantId]); // Namjerno bez selectedRestaurantId – reagiraj samo na promjenu iz headera (cookie)

  // Sinkronizacija s URL-om samo kad URL i cookie (header) se podudaraju – npr. direktan link ili prvi load
  useEffect(() => {
    if (
      urlRestaurantId &&
      urlRestaurantId !== "all" &&
      urlRestaurantId === defaultRestaurantId &&
      urlRestaurantId !== selectedRestaurantId
    ) {
      setSelectedRestaurantId(urlRestaurantId);
    }
  }, [urlRestaurantId, selectedRestaurantId, defaultRestaurantId]);

  const koeffNum = (() => {
    const k = parseDE(koefficientBruttoNetto);
    return k > 0 ? k : 1.118;
  })();

  // Dani u mjesecu – Excel struktura; backward compat: map old umsatz/prod/nz/extra na brutto/netto/produktiveStd/nzEuro/extraStd
  const generateEmptyDays = useCallback((m: number, y: number, savedRows: SavedRow[] = [], koeff: number = 1.118) => {
    const daysInMonth = new Date(y, m, 0).getDate();
    const currentHolidays = y === year ? holidaysForYear : [];
    const newDays: DayData[] = [];

    for (let i = 1; i <= 31; i++) {
      const date = new Date(y, m - 1, i);
      const dayName = date.toLocaleDateString("de-AT", { weekday: "short" });

      const isWeekend = dayName === "Sa" || dayName === "So";
      const isHoliday = currentHolidays.some((h) => h.d === i && h.m === m);
      const exists = i <= daysInMonth;
      const saved = savedRows[i - 1] || {};

      const brutto = saved.bruttoUmsatz ?? saved.umsatz ?? "";
      const netto = saved.nettoUmsatz ?? (brutto ? fmtNum(parseDE(brutto) / koeff) : "");
      const prodPct = saved.geplanteProduktivitaetPct ?? "";
      const prodStd = saved.produktiveStd ?? "";
      const sf = saved.sfStd ?? "";
      const hm = saved.hmStd ?? "";
      const nz = saved.nzEuro ?? saved.nz ?? "";
      const extra = saved.extraStd ?? saved.extra ?? "";

      newDays.push({
        day: i,
        dayName,
        isWeekend,
        isHoliday,
        exists,
        bruttoUmsatz: brutto,
        nettoUmsatz: netto,
        geplanteProduktivitaetPct: prodPct,
        produktiveStd: prodStd,
        sfStd: sf,
        hmStd: hm,
        nzEuro: nz,
        extraStd: extra,
      });
    }
    setDaysData(newDays);
  }, [year, holidaysForYear]);

  const clearInputs = () => {
    setAvgWage(""); setVacationStd(""); setSickStd(""); setExtraUnprodStd("");
    setKoefficientBruttoNetto(fmtNum(1.118, 4)); setFoerderung("");
    setBudgetUmsatz(""); setBudgetCL(""); setBudgetCLPct("");
    setDayComments({});
  };

  useEffect(() => {
    currentRestaurantIdRef.current = selectedRestaurantId;
  }, [selectedRestaurantId]);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (!canEditRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  // Restore month/year from sessionStorage after mount so we never show February from SSR
  useEffect(() => {
    try {
      const sy = sessionStorage.getItem("labor-planner-year");
      const sm = sessionStorage.getItem("labor-planner-month");
      if (sy) { const n = Number(sy); if (!Number.isNaN(n)) setYear(n); }
      if (sm) { const n = Number(sm); if (!Number.isNaN(n) && n >= 1 && n <= 12) setMonth(n); }
      setHasRestoredSession(true);
    } catch {
      setHasRestoredSession(true);
    }
  }, []);

  // Deep-Link aus Benachrichtigung: Jahr / Monat / Restaurant aus URL
  useEffect(() => {
    if (!hasRestoredSession) return;
    try {
      const y = searchParams.get("year");
      const m = searchParams.get("month");
      const rid = searchParams.get("restaurantId");
      if (y) {
        const ny = Number(y);
        if (!Number.isNaN(ny) && ny >= 2020 && ny <= 2100) setYear(ny);
      }
      if (m) {
        const nm = Number(m);
        if (!Number.isNaN(nm) && nm >= 1 && nm <= 12) setMonth(nm);
      }
      if (rid && rid !== "all") {
        if (restaurants.length === 0 || restaurants.some((r) => r.id === rid)) {
          setSelectedRestaurantId(rid);
        }
      }
    } catch {
      /* ignore */
    }
  }, [hasRestoredSession, searchParams, restaurants]);

  useEffect(() => {
    try {
      sessionStorage.setItem("labor-planner-year", String(year));
      sessionStorage.setItem("labor-planner-month", String(month));
    } catch {
      // ignore
    }
  }, [year, month]);

  // Jahr / Monat / Restaurant in URL (Deep Links, Teilen)
  useEffect(() => {
    if (!hasRestoredSession) return;
    if (!selectedRestaurantId || selectedRestaurantId === "all") return;
    const y = searchParams.get("year");
    const m = searchParams.get("month");
    const rid = searchParams.get("restaurantId");
    if (String(year) === y && String(month) === m && rid === selectedRestaurantId) return;
    const p = new URLSearchParams(searchParams.toString());
    p.set("year", String(year));
    p.set("month", String(month));
    p.set("restaurantId", selectedRestaurantId);
    router.replace(`?${p.toString()}`, { scroll: false });
  }, [year, month, selectedRestaurantId, hasRestoredSession, searchParams, router]);

  const loadDataFromDB = useCallback(
    async (m: number, y: number, rId: string) => {
      if (!rId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/labor-planner?year=${y}&month=${m}&restaurant=${rId}`);
        const json = await res.json();

        if (currentRestaurantIdRef.current !== rId) return;

        if (json.success) {
          setClMeta(
            json.cl && typeof json.cl === "object"
              ? { ...defaultClState(), ...(json.cl as Partial<LaborClClientState>) }
              : defaultClState()
          );
          const parsed: LaborPlanData = json.data ?? { inputs: {}, rows: [] };
          if (parsed.inputs) {
            setAvgWage(parsed.inputs.avgWage || "");
            setVacationStd(parsed.inputs.vacationStd || "");
            setSickStd(parsed.inputs.sickStd || "");
            setExtraUnprodStd(parsed.inputs.extraUnprodStd || "");
            setKoefficientBruttoNetto(
              parsed.inputs.koefficientBruttoNetto != null && parseDE(parsed.inputs.koefficientBruttoNetto) > 0
                ? fmtNum(parseDE(parsed.inputs.koefficientBruttoNetto), 4)
                : fmtNum(1.118, 4)
            );
            setFoerderung(parsed.inputs.foerderung || "");
            setBudgetUmsatz(parsed.inputs.budgetUmsatz || "");
            setBudgetCL(parsed.inputs.budgetCL || "");
            setBudgetCLPct(parsed.inputs.budgetCLPct || "");
          }
          const koeff = (parsed.inputs?.koefficientBruttoNetto != null && parseDE(parsed.inputs.koefficientBruttoNetto) > 0)
            ? parseDE(parsed.inputs.koefficientBruttoNetto)
            : 1.118;
          if (parsed.rows && Array.isArray(parsed.rows)) {
            generateEmptyDays(m, y, parsed.rows, koeff);
          } else {
            generateEmptyDays(m, y, [], koeff);
          }
          setDayComments(normalizeDayCommentsFromApi((parsed as LaborPlanData).dayComments));
          setHasUnsavedChanges(false);
        } else {
          setClMeta(defaultClState());
          clearInputs();
          generateEmptyDays(m, y, [], 1.118);
          setDayComments({});
          setHasUnsavedChanges(false);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (currentRestaurantIdRef.current === rId) setLoading(false);
      }
    },
    [generateEmptyDays, year, holidaysForYear]
  );

  useEffect(() => {
    if (!hasRestoredSession) return;
    if (!selectedRestaurantId || selectedRestaurantId === "all") {
      clearInputs();
      generateEmptyDays(month, year, [], 1.118);
      setHasUnsavedChanges(false);
    }
  }, [hasRestoredSession, selectedRestaurantId, month, year, generateEmptyDays]);

  useEffect(() => {
    if (!hasRestoredSession || !selectedRestaurantId || selectedRestaurantId === "all") return;
    loadDataFromDB(month, year, selectedRestaurantId);
  }, [hasRestoredSession, month, year, selectedRestaurantId, loadDataFromDB]);

  // --- FORMULE KAO U EXCELU (C20, C24) ---
  // Netto = Brutto / Koeffizient (po danu)
  // Umsatz Gesamt = suma(Netto)
  // Gesamt Std. = Produktive + HM + Urlaub + Krank + Extra (ohne SF — Excel C20: =C9+C8+C7+C11+C14)
  // CL (Euro) = Gesamt Std. × Stundenlohn + NZ − Förderung
  // CL (%) = (CL Euro / Umsatz Gesamt) × 100
  // Produktivität (Ist) = Umsatz Gesamt / (Produktive Std. + Extra (suma))
  // Produktivität (Real) = Umsatz Gesamt / (Produktive + SF) — Excel C24: =C19/(C9+C10)
  const totals = (() => {
    let sumBrutto = 0, sumNetto = 0, sumProduktiveStd = 0, sumSF = 0, sumHM = 0, sumNZ = 0, sumExtra = 0;

    daysData.forEach((d) => {
      if (!d.exists) return;
      const brutto = parseDEFlex(d.bruttoUmsatz);
      const netto = koeffNum > 0 ? brutto / koeffNum : 0;
      sumBrutto += brutto;
      sumNetto += netto;
      sumProduktiveStd += calcProduktiveStdForDay(d, koeffNum);
      sumSF += parseDEFlex(d.sfStd);
      sumHM += parseDEFlex(d.hmStd);
      sumNZ += parseDEFlex(d.nzEuro);
      sumExtra += parseDEFlex(d.extraStd);
    });

    const valUrlaub = parseDEFlex(vacationStd);
    const valKrank = parseDEFlex(sickStd);
    const valWage = parseDEFlex(avgWage);
    const valFoerderung = parseDEFlex(foerderung);

    const gesamtStd = sumProduktiveStd + sumHM + valUrlaub + valKrank + sumExtra;
    const clEuro = (valWage > 0 && (gesamtStd > 0 || sumNZ > 0))
      ? Math.max(0, gesamtStd * valWage + sumNZ - valFoerderung)
      : 0;
    const umsatzGesamt = sumNetto;
    const clPct = umsatzGesamt > 0 ? (clEuro / umsatzGesamt) * 100 : 0;
    const denomIst = sumProduktiveStd + sumExtra;
    const istProd = denomIst > 0 ? umsatzGesamt / denomIst : 0;
    const denomReal = sumProduktiveStd + sumSF;
    const realProd = denomReal > 0 ? umsatzGesamt / denomReal : 0;
    const budgetCLVal = parseDE(budgetCL);

    return {
      sumBrutto, sumNetto, sumProduktiveStd, sumSF, sumHM, sumNZ, sumExtra,
      gesamtStd, umsatzGesamt, clEuro, clPct, istProd, realProd, budgetCLVal,
    };
  })();

  const buildLaborPlanData = useCallback(
    (commentsOverride?: Record<string, string>): LaborPlanData => {
      const comments = commentsOverride !== undefined ? commentsOverride : dayComments;
      return {
        inputs: {
          avgWage,
          vacationStd,
          sickStd,
          extraUnprodStd,
          koefficientBruttoNetto,
          foerderung,
          budgetUmsatz,
          budgetCL,
          budgetCLPct,
        },
        rows: daysData.map((d) => {
          const brutto = parseDE(d.bruttoUmsatz);
          const nettoCalc = brutto && koeffNum > 0 ? brutto / koeffNum : 0;
          const netto =
            nettoCalc > 0
              ? fmtNum(nettoCalc)
              : d.nettoUmsatz;

          const produktiveVal = calcProduktiveStdForDay(d, koeffNum);

          return {
            bruttoUmsatz: d.bruttoUmsatz,
            nettoUmsatz: netto,
            geplanteProduktivitaetPct: d.geplanteProduktivitaetPct,
            produktiveStd: produktiveVal ? fmtHours(produktiveVal) : "",
            sfStd: d.sfStd,
            hmStd: d.hmStd,
            nzEuro: d.nzEuro,
            extraStd: d.extraStd,
          };
        }),
        dayComments: stripEmptyDayComments(comments),
      };
    },
    [
      avgWage,
      vacationStd,
      sickStd,
      extraUnprodStd,
      koefficientBruttoNetto,
      foerderung,
      budgetUmsatz,
      budgetCL,
      budgetCLPct,
      daysData,
      koeffNum,
      dayComments,
    ]
  );

  const saveDataToDB = useCallback(async (silent = false) => {
    if (!selectedRestaurantId || selectedRestaurantId === "all") {
      if (!silent) toast.error("Bitte Restaurant auswählen.");
      return;
    }
    if (!clMeta.canEdit) {
      if (!silent) toast.error("Monat ist gesperrt. Speichern nicht möglich.");
      return;
    }
    if (!silent) setLoading(true);

    const dataToSave = buildLaborPlanData();

    try {
      const res = await fetch("/api/labor-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, restaurant: selectedRestaurantId, data: dataToSave }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setHasUnsavedChanges(false);
        if (!silent) toast.success("Gespeichert.");
        if (json.cl && typeof json.cl === "object") {
          setClMeta({ ...defaultClState(), ...(json.cl as Partial<LaborClClientState>) });
        }
      } else {
        if (!silent) toast.error(json?.error || "Fehler beim Speichern.");
      }
    } catch (error) {
      console.error(error);
      if (!silent) toast.error("Fehler beim Speichern.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedRestaurantId, year, month, clMeta.canEdit, buildLaborPlanData]);

  const handleSaveDayNote = useCallback(async () => {
    if (dayNoteModalDay == null || !selectedRestaurantId || selectedRestaurantId === "all") return;
    if (!canEditCl) {
      setDayNoteModalDay(null);
      return;
    }
    const key = String(dayNoteModalDay);
    const trimmed = dayNoteDraft.trim();
    const next = { ...dayComments };
    if (!trimmed) delete next[key];
    else next[key] = trimmed;

    setDayNoteSaving(true);
    try {
      const dataToSave = buildLaborPlanData(next);
      const res = await fetch("/api/labor-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          month,
          restaurant: selectedRestaurantId,
          data: dataToSave as LaborPlanPayload,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setDayComments(next);
        setDayNoteModalDay(null);
        setHasUnsavedChanges(false);
        toast.success(trimmed ? "Tagesnotiz gespeichert." : "Tagesnotiz entfernt.");
        if (json.cl && typeof json.cl === "object") {
          setClMeta({ ...defaultClState(), ...(json.cl as Partial<LaborClClientState>) });
        }
      } else {
        toast.error(json?.error || "Speichern fehlgeschlagen.");
      }
    } catch {
      toast.error("Speichern fehlgeschlagen.");
    } finally {
      setDayNoteSaving(false);
    }
  }, [
    dayNoteModalDay,
    dayNoteDraft,
    dayComments,
    selectedRestaurantId,
    canEditCl,
    year,
    month,
    buildLaborPlanData,
  ]);

  useEffect(() => {
    saveDataToDBRef.current = saveDataToDB;
  }, [saveDataToDB]);

  // Automatsko snimanje svako 3 minute (bez popupa)
  useEffect(() => {
    const interval = setInterval(() => {
      if (
        hasUnsavedChangesRef.current &&
        canEditRef.current &&
        currentRestaurantIdRef.current &&
        currentRestaurantIdRef.current !== "all"
      ) {
        saveDataToDBRef.current?.(true);
      }
    }, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Snimanje pri izlasku iz modula (prebacivanje na drugi modul)
  useEffect(() => {
    return () => {
      if (
        hasUnsavedChangesRef.current &&
        canEditRef.current &&
        currentRestaurantIdRef.current &&
        currentRestaurantIdRef.current !== "all"
      ) {
        try { sessionStorage.setItem("mcd-autosave-toast", "1"); } catch { /* ignore */ }
        saveDataToDBRef.current?.(true);
      }
    };
  }, []);

  const handlePrintSingle = () => {
    if (!selectedRestaurantId || selectedRestaurantId === "all") {
      toast.error("Bitte Restaurant auswählen.");
      return;
    }
    setIsExporting(true);

    const doc = new jsPDF("p", "mm", "a4");
    const selectedRest = restaurants.find((r) => r.id === selectedRestaurantId);
    const margin = 10;
    const leftColW = 56;
    const tableStartX = margin + leftColW + 4;

    const tableBody = daysData.filter((d) => d.exists).map((d) => {
      let dayLabel = `${d.day}. ${d.dayName}`;
      if (d.isHoliday) dayLabel += " *";
      const nettoVal =
        parseDEFlex(d.bruttoUmsatz) && koeffNum > 0
          ? fmtNum(parseDEFlex(d.bruttoUmsatz) / koeffNum)
          : d.nettoUmsatz || "";
      const produktiveVal = calcProduktiveStdForDay(d, koeffNum);
      return [
        dayLabel,
        d.bruttoUmsatz || "",
        nettoVal,
        d.geplanteProduktivitaetPct || "",
        fmtHours(produktiveVal),
        fmtHours(parseDEFlex(d.sfStd)),
        fmtHours(parseDEFlex(d.hmStd)),
        d.nzEuro || "",
        d.extraStd || "",
      ];
    });

    const totalRow = [
      "Summe",
      fmtNum(totals.sumBrutto),
      fmtNum(totals.sumNetto),
      "—",
      fmtHours(totals.sumProduktiveStd),
      fmtHours(totals.sumSF),
      fmtHours(totals.sumHM),
      fmtNum(totals.sumNZ),
      fmtHours(totals.sumExtra),
    ];

    // —— Header (zelena traka: Personaleinsatz + STORE + broj restorana većim fontom)
    doc.setFillColor(27, 58, 38);
    doc.rect(0, 0, 210, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Personaleinsatz", margin, 10);
    doc.setFontSize(18);
    doc.text(`STORE ${selectedRest?.code ?? ""}`, margin, 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`${MONTH_NAMES_DE[month - 1]} ${year}`, 210 - margin, 16, { align: "right" });

    // —— Lijeva kolona: bijele kartice
    const drawCard = (sy: number, title: string, items: Array<[string, string]>): number => {
      const rowH = 4.5;
      const h = 8 + items.length * rowH + 2;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.roundedRect(margin, sy, leftColW, h, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(27, 58, 38);
      doc.text(title, margin + 3, sy + 5.5);
      let iy = sy + 9.5;
      for (const [label, value] of items) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(100, 100, 100);
        doc.text(label, margin + 3, iy);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(0, 0, 0);
        doc.text(value || "—", margin + leftColW - 3, iy, { align: "right" });
        iy += rowH;
      }
      return sy + h + 2;
    };

    // Kartica 1: Einstellungen (s velikim nazivom mjeseca)
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, 28, leftColW, 20, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(27, 58, 38);
    doc.text("Einstellungen", margin + 3, 33.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);
    doc.text("Jahr", margin + 3, 39.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(0, 0, 0);
    doc.text(String(year), margin + leftColW - 3, 39.5, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(27, 58, 38);
    doc.text(MONTH_NAMES_DE[month - 1], margin + 3, 45.5);

    let y = 50;
    y = drawCard(y, "Parameter", [
      ["Stundensatz (€)", avgWage],
      ["Urlaub (h)", vacationStd],
      ["Krankheit (h)", sickStd],
      ["Koeffizient Brutto/Netto", koefficientBruttoNetto],
      ["Förderung (€)", foerderung],
    ]);
    y = drawCard(y, "Stunden", [
      ["Produktive Std", fmtHours(totals.sumProduktiveStd)],
      ["SF (productive) Std", fmtHours(totals.sumSF)],
      ["HM Std", fmtHours(totals.sumHM)],
      ["Nacht (€)", fmtNum(totals.sumNZ)],
      ["Extra Std. (Summe)", fmtHours(totals.sumExtra)],
    ]);
    y = drawCard(y, "Budget", [
      ["Budget Umsatz", budgetUmsatz],
      ["Budget CL €", budgetCL],
      ["Budget CL %", budgetCLPct],
    ]);

    // —— Žuti rezime blok
    doc.setFillColor(255, 199, 44);
    doc.roundedRect(margin, y, leftColW, 40, 2, 2, "F");
    doc.setTextColor(27, 58, 38);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("Umsatz Gesamt (Netto)", margin + 3, y + 5);
    doc.text(`${fmtNum(totals.umsatzGesamt)} €`, margin + leftColW - 3, y + 5, { align: "right" });
    doc.text("Gesamt Std.", margin + 3, y + 11);
    doc.text(`${fmtHours(totals.gesamtStd)} h`, margin + leftColW - 3, y + 11, { align: "right" });
    doc.setFontSize(8);
    doc.text("CL (€)", margin + 3, y + 18);
    doc.setFontSize(11);
    const clOverBudget = totals.budgetCLVal > 0 && totals.clEuro > totals.budgetCLVal;
    if (clOverBudget) doc.setTextColor(220, 38, 38);
    else doc.setTextColor(21, 128, 61);
    doc.text(`${fmtNum(totals.clEuro)} €`, margin + leftColW - 3, y + 18, { align: "right" });
    doc.setTextColor(27, 58, 38);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("CL %", margin + 3, y + 24);
    doc.text(`${fmtNum(totals.clPct, 2)} %`, margin + leftColW - 3, y + 24, { align: "right" });
    doc.text("Prod. (Bericht)", margin + 3, y + 30);
    doc.text(totals.istProd > 0 ? `${fmtNum(totals.istProd)} €` : "—", margin + leftColW - 3, y + 30, { align: "right" });
    doc.text("Prod. (REAL)", margin + 3, y + 36);
    doc.text(totals.realProd > 0 ? `${fmtNum(totals.realProd)} €` : "—", margin + leftColW - 3, y + 36, { align: "right" });

    // —— Tablica (desna strana)
    const tableWidth = 210 - tableStartX - margin;
    const colW = [19, 17, 17, 13, 15, 11, 10, 14, 14] as const;
    autoTable(doc, {
      startY: 28,
      margin: { left: tableStartX },
      head: [["Tag", "Brutto Umsatz", "Netto Umsatz", "Gepl. Prod. %", "Produktive Std.", "SF (prod.)", "HM", "NZ Euro", "Extra Std. Unprod."]],
      body: [...tableBody, totalRow],
      theme: "grid",
      tableWidth,
      headStyles: { fillColor: [27, 58, 38], textColor: 255, fontSize: 7, halign: "center", fontStyle: "bold", cellPadding: 2 },
      footStyles: { fillColor: [243, 244, 246], textColor: 0, fontStyle: "bold", fontSize: 7, cellPadding: 2 },
      styles: { fontSize: 7, cellPadding: 2, lineColor: [209, 213, 219], lineWidth: 0.2, valign: "middle", halign: "center", font: "helvetica" },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: colW[0], halign: "center" },
        1: { cellWidth: colW[1], halign: "center" },
        2: { cellWidth: colW[2], halign: "center" },
        3: { cellWidth: colW[3], halign: "center" },
        4: { cellWidth: colW[4], halign: "center" },
        5: { cellWidth: colW[5], halign: "center" },
        6: { cellWidth: colW[6], halign: "center" },
        7: { cellWidth: colW[7], halign: "center" },
        8: { cellWidth: colW[8], halign: "center" },
      },
      didParseCell: function (data: unknown) {
        const hookData = data as AutoTableHookData;
        if (hookData.section === "body" && typeof hookData.row.index === "number" && hookData.row.index < tableBody.length) {
          const dayStr = hookData.row.raw[0];
          if (dayStr.includes("Sa") || dayStr.includes("So")) hookData.cell.styles.fillColor = [243, 244, 246];
          if (dayStr.includes("*")) {
            hookData.cell.styles.fillColor = [254, 226, 226];
            hookData.cell.styles.textColor = [220, 38, 38];
          }
        }
        if (typeof hookData.row.index === "number" && hookData.row.index === tableBody.length) {
          hookData.cell.styles.fillColor = [243, 244, 246];
          hookData.cell.styles.fontStyle = "bold";
        }
      },
    });

    // Zaobljeni uglovi tabele
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalTableY: number = (doc as any).lastAutoTable.finalY;
    const tr = 1.5; const cm = 0.4;
    doc.setFillColor(27, 58, 38);
    doc.rect(tableStartX, 28, tr + cm, tr + cm, "F");
    doc.rect(tableStartX + tableWidth - tr - cm, 28, tr + cm, tr + cm, "F");
    doc.setFillColor(243, 244, 246);
    doc.rect(tableStartX, finalTableY - tr - cm, tr + cm, tr + cm, "F");
    doc.rect(tableStartX + tableWidth - tr - cm, finalTableY - tr - cm, tr + cm, tr + cm, "F");
    doc.setDrawColor(27, 58, 38);
    doc.setLineWidth(0.3);
    doc.roundedRect(tableStartX, 28, tableWidth, finalTableY - 28, tr, tr, "S");

    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    setPdfPopupUrl(url);
    setIsExporting(false);
  };

  const handleExportYear = async () => {
    if (!selectedRestaurantId || selectedRestaurantId === "all") {
      toast.error("Bitte Restaurant auswählen.");
      return;
    }
    setLoading(true);
    const margin = 10;
    const leftColW = 56;
    const tableStartX = margin + leftColW + 4;
    const tableWidth = 210 - tableStartX - margin;
    const colW = [19, 17, 17, 13, 15, 11, 10, 14, 14] as const;

    try {
      const doc = new jsPDF("p", "mm", "a4");
      const selectedRest = restaurants.find((r) => r.id === selectedRestaurantId);
      const holidays = holidaysForYear;

      for (let m = 1; m <= 12; m++) {
        if (m > 1) doc.addPage();

        const res = await fetch(`/api/labor-planner?year=${year}&month=${m}&restaurant=${selectedRestaurantId}`);
        const json = await res.json();

        let currentMonthRows: SavedRow[] = [];
        let currentInputs: SavedInputs = {};
        if (json.success && json.data) {
          currentMonthRows = json.data.rows || [];
          currentInputs = json.data.inputs || {};
        }

        const daysInMonth = new Date(year, m, 0).getDate();
        const koeff = (currentInputs.koefficientBruttoNetto != null && parseDEFlex(currentInputs.koefficientBruttoNetto) > 0)
          ? parseDEFlex(currentInputs.koefficientBruttoNetto)
          : 1.118;
        const calculatedRows: (string | number)[][] = [];
        let mSumBrutto = 0, mSumNetto = 0, mSumProduktiveStd = 0, mSumSF = 0, mSumHM = 0, mSumNZ = 0, mSumExtra = 0;

        for (let i = 1; i <= daysInMonth; i++) {
          const date = new Date(year, m - 1, i);
          const dayNameShort = date.toLocaleDateString("de-AT", { weekday: "short" });
          const isHoliday = holidays.some((h) => h.d === i && h.m === m);
          const saved = currentMonthRows[i - 1] || {};
          const brutto = parseDEFlex(saved.bruttoUmsatz ?? saved.umsatz);
          const netto = koeff > 0 ? brutto / koeff : 0;
          const nettoStr = koeff > 0 && brutto ? fmtNum(netto) : saved.nettoUmsatz ?? "";
          const prodStd = calcProduktiveStdFromSavedRow(saved, koeff);
          const sf = parseDEFlex(saved.sfStd ?? "");
          const hm = parseDEFlex(saved.hmStd ?? "");
          const nz = parseDEFlex(saved.nzEuro ?? saved.nz ?? "");
          const ex = parseDEFlex(saved.extraStd ?? saved.extra ?? "");

          mSumBrutto += brutto;
          mSumNetto += netto;
          mSumProduktiveStd += prodStd;
          mSumSF += sf;
          mSumHM += hm;
          mSumNZ += nz;
          mSumExtra += ex;

          let label = `${i}. ${dayNameShort}`;
          if (isHoliday) label += " *";

          calculatedRows.push([
            label,
            saved.bruttoUmsatz ?? saved.umsatz ?? "",
            nettoStr || "",
            saved.geplanteProduktivitaetPct ?? "",
            fmtHours(prodStd),
            fmtHours(sf),
            fmtHours(hm),
            saved.nzEuro ?? saved.nz ?? "",
            saved.extraStd ?? saved.extra ?? "",
          ]);
        }

        const totalRow = [
          "Summe",
          fmtNum(mSumBrutto),
          fmtNum(mSumNetto),
          "—",
          fmtHours(mSumProduktiveStd),
          fmtHours(mSumSF),
          fmtHours(mSumHM),
          fmtNum(mSumNZ),
          fmtHours(mSumExtra),
        ];

        const valUrlaub = parseDEFlex(currentInputs.vacationStd);
        const valKrank = parseDEFlex(currentInputs.sickStd);
        const valWage = parseDEFlex(currentInputs.avgWage);
        const valFoerderung = parseDEFlex(currentInputs.foerderung ?? "");
        const gesamtStd = mSumProduktiveStd + mSumHM + valUrlaub + valKrank + mSumExtra;
        const clEuro = (valWage > 0 && (gesamtStd > 0 || mSumNZ > 0))
          ? Math.max(0, gesamtStd * valWage + mSumNZ - valFoerderung)
          : 0;
        const clPct = mSumNetto > 0 ? (clEuro / mSumNetto) * 100 : 0;
        const denomReal = mSumProduktiveStd + mSumSF;
        const realProd = denomReal > 0 ? mSumNetto / denomReal : 0;
        const denomIst = mSumProduktiveStd + mSumExtra;
        const istProd = denomIst > 0 ? mSumNetto / denomIst : 0;
        const budgetCLVal = parseDEFlex(currentInputs.budgetCL);

        // —— Header (STORE + broj većim fontom)
        doc.setFillColor(27, 58, 38);
        doc.rect(0, 0, 210, 24, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Personaleinsatz", margin, 10);
        doc.setFontSize(18);
        doc.text(`STORE ${selectedRest?.code ?? ""}`, margin, 18);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(`${MONTH_NAMES_DE[m - 1]} ${year}`, 210 - margin, 16, { align: "right" });

        // —— Lijeva kolona: bijele kartice
        const drawCard = (sy: number, title: string, items: Array<[string, string]>): number => {
          const rowH = 4.5;
          const h = 8 + items.length * rowH + 2;
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.2);
          doc.roundedRect(margin, sy, leftColW, h, 1.5, 1.5, "FD");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(27, 58, 38);
          doc.text(title, margin + 3, sy + 5.5);
          let iy = sy + 9.5;
          for (const [label, value] of items) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.5);
            doc.setTextColor(100, 100, 100);
            doc.text(label, margin + 3, iy);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            doc.setTextColor(0, 0, 0);
            doc.text(value || "—", margin + leftColW - 3, iy, { align: "right" });
            iy += rowH;
          }
          return sy + h + 2;
        };

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.roundedRect(margin, 28, leftColW, 20, 1.5, 1.5, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(27, 58, 38);
        doc.text("Einstellungen", margin + 3, 33.5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(100, 100, 100);
        doc.text("Jahr", margin + 3, 39.5);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(0, 0, 0);
        doc.text(String(year), margin + leftColW - 3, 39.5, { align: "right" });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(27, 58, 38);
        doc.text(MONTH_NAMES_DE[m - 1], margin + 3, 45.5);

        let y = 50;
        y = drawCard(y, "Parameter", [
          ["Stundensatz (€)", currentInputs.avgWage ?? ""],
          ["Urlaub (h)", currentInputs.vacationStd ?? ""],
          ["Krankheit (h)", currentInputs.sickStd ?? ""],
          ["Koeffizient Brutto/Netto", currentInputs.koefficientBruttoNetto ?? ""],
          ["Förderung (€)", currentInputs.foerderung ?? ""],
        ]);
        y = drawCard(y, "Stunden", [
          ["Produktive Std", fmtHours(mSumProduktiveStd)],
          ["SF (productive) Std", fmtHours(mSumSF)],
          ["HM Std", fmtHours(mSumHM)],
          ["Nacht (€)", fmtNum(mSumNZ)],
          ["Extra Std. (Summe)", fmtHours(mSumExtra)],
        ]);
        y = drawCard(y, "Budget", [
          ["Budget Umsatz", currentInputs.budgetUmsatz ?? ""],
          ["Budget CL €", currentInputs.budgetCL ?? ""],
          ["Budget CL %", currentInputs.budgetCLPct ?? ""],
        ]);

        // —— Žuti rezime blok
        doc.setFillColor(255, 199, 44);
        doc.roundedRect(margin, y, leftColW, 40, 2, 2, "F");
        doc.setTextColor(27, 58, 38);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text("Umsatz Gesamt (Netto)", margin + 3, y + 5);
        doc.text(`${fmtNum(mSumNetto)} €`, margin + leftColW - 3, y + 5, { align: "right" });
        doc.text("Gesamt Std.", margin + 3, y + 11);
        doc.text(`${fmtHours(gesamtStd)} h`, margin + leftColW - 3, y + 11, { align: "right" });
        doc.setFontSize(8);
        doc.text("CL (€)", margin + 3, y + 18);
        doc.setFontSize(11);
        const clOver = budgetCLVal > 0 && clEuro > budgetCLVal;
        if (clOver) doc.setTextColor(220, 38, 38);
        else doc.setTextColor(21, 128, 61);
        doc.text(`${fmtNum(clEuro)} €`, margin + leftColW - 3, y + 18, { align: "right" });
        doc.setTextColor(27, 58, 38);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text("CL %", margin + 3, y + 24);
        doc.text(`${fmtNum(clPct, 2)} %`, margin + leftColW - 3, y + 24, { align: "right" });
        doc.text("Prod. (Bericht)", margin + 3, y + 30);
        doc.text(istProd > 0 ? `${fmtNum(istProd)} €` : "—", margin + leftColW - 3, y + 30, { align: "right" });
        doc.text("Prod. (REAL)", margin + 3, y + 36);
        doc.text(realProd > 0 ? `${fmtNum(realProd)} €` : "—", margin + leftColW - 3, y + 36, { align: "right" });

        autoTable(doc, {
          startY: 28,
          margin: { left: tableStartX },
          head: [["Tag", "Brutto Umsatz", "Netto Umsatz", "Gepl. Prod. %", "Produktive Std.", "SF (prod.)", "HM", "NZ Euro", "Extra Std. Unprod."]],
          body: [...calculatedRows, totalRow],
          theme: "grid",
          tableWidth,
          headStyles: { fillColor: [27, 58, 38], textColor: 255, fontSize: 7, halign: "center", fontStyle: "bold", cellPadding: 2 },
          footStyles: { fillColor: [243, 244, 246], textColor: 0, fontStyle: "bold", fontSize: 7, cellPadding: 2 },
          styles: { fontSize: 7, cellPadding: 2, lineColor: [209, 213, 219], lineWidth: 0.2, valign: "middle", halign: "center", font: "helvetica" },
          columnStyles: {
            0: { fontStyle: "bold", cellWidth: colW[0], halign: "center" },
            1: { cellWidth: colW[1], halign: "center" },
            2: { cellWidth: colW[2], halign: "center" },
            3: { cellWidth: colW[3], halign: "center" },
            4: { cellWidth: colW[4], halign: "center" },
            5: { cellWidth: colW[5], halign: "center" },
            6: { cellWidth: colW[6], halign: "center" },
            7: { cellWidth: colW[7], halign: "center" },
            8: { cellWidth: colW[8], halign: "center" },
          },
          didParseCell: function (data: unknown) {
            const hookData = data as AutoTableHookData;
            if (hookData.section === "body" && typeof hookData.row.index === "number" && hookData.row.index < calculatedRows.length) {
              const dayStr = String(hookData.row.raw[0]);
              if (dayStr.includes("Sa") || dayStr.includes("So")) hookData.cell.styles.fillColor = [243, 244, 246];
              if (dayStr.includes("*")) {
                hookData.cell.styles.fillColor = [254, 226, 226];
                hookData.cell.styles.textColor = [220, 38, 38];
              }
            }
            if (typeof hookData.row.index === "number" && hookData.row.index === calculatedRows.length) {
              hookData.cell.styles.fillColor = [243, 244, 246];
              hookData.cell.styles.fontStyle = "bold";
            }
          },
        });

        // Zaobljeni uglovi tabele
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const finalTableY: number = (doc as any).lastAutoTable.finalY;
        const tr = 1.5; const cm = 0.4;
        doc.setFillColor(27, 58, 38);
        doc.rect(tableStartX, 28, tr + cm, tr + cm, "F");
        doc.rect(tableStartX + tableWidth - tr - cm, 28, tr + cm, tr + cm, "F");
        doc.setFillColor(243, 244, 246);
        doc.rect(tableStartX, finalTableY - tr - cm, tr + cm, tr + cm, "F");
        doc.rect(tableStartX + tableWidth - tr - cm, finalTableY - tr - cm, tr + cm, tr + cm, "F");
        doc.setDrawColor(27, 58, 38);
        doc.setLineWidth(0.3);
        doc.roundedRect(tableStartX, 28, tableWidth, finalTableY - 28, tr, tr, "S");
      }
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      setPdfPopupUrl(url);
    } catch (e) {
      console.error(e);
      toast.error("Fehler beim Erstellen des Jahresberichts.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (idx: number, field: keyof DayData, val: string) => {
    if (!clMeta.canEdit) return;
    const newData = [...daysData];
    const row = { ...newData[idx], [field]: val };
    if (field === "bruttoUmsatz" && koeffNum > 0) {
      const b = parseDEFlex(val);
      row.nettoUmsatz = b ? fmtNum(b / koeffNum) : "";
    }
    newData[idx] = row;
    setDaysData(newData);
    setHasUnsavedChanges(true);
  };

  const handleCopyDown = (field: keyof DayData) => {
    if (!clMeta.canEdit) return;
    if (daysData.length === 0) return;
    if (!confirm("Wert des ersten Tages in alle Tage kopieren?")) return;
    const valToCopy = daysData[0][field];
    const newData = daysData.map((d) => (d.exists ? { ...d, [field]: valToCopy } : d));
    setDaysData(newData);
    setHasUnsavedChanges(true);
  };

  const handleDeleteData = async () => {
    if (!selectedRestaurantId || selectedRestaurantId === "all") {
      toast.error("Bitte Restaurant auswählen.");
      return;
    }
    if (clMeta.clLocked && !clMeta.canBypassClLock) {
      toast.error("Gesperrter Monat kann nicht gelöscht werden.");
      return;
    }
    if (!confirm("Alle Daten für diesen Monat und dieses Restaurant unwiderruflich löschen?")) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/labor-planner?year=${year}&month=${month}&restaurant=${selectedRestaurantId}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (res.ok && json.success) {
        setHasUnsavedChanges(false);
        clearInputs();
        generateEmptyDays(month, year, [], koeffNum);
        await loadDataFromDB(month, year, selectedRestaurantId);
        toast.success("Daten gelöscht.");
      } else {
        toast.error(json?.error || "Fehler beim Löschen.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Fehler beim Löschen.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinishMonthConfirm = async () => {
    if (!selectedRestaurantId || selectedRestaurantId === "all") return;
    setLoading(true);
    try {
      const payload = buildLaborPlanData() as LaborPlanPayload;
      const res = await finishClMonth(selectedRestaurantId, month, year, payload);
      if (res.success) {
        toast.success("Monat abgeschlossen und gesperrt.");
        setShowFinishMonthModal(false);
        await loadDataFromDB(month, year, selectedRestaurantId);
      } else {
        toast.error(res.error || "Fehler beim Sperren.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockRequestSubmit = async () => {
    if (!selectedRestaurantId || selectedRestaurantId === "all") return;
    setLoading(true);
    try {
      const res = await requestClUnlock(selectedRestaurantId, month, year, unlockRequestNote.trim() || undefined);
      if (res.success) {
        toast.success("Entsperranfrage gesendet.");
        setShowUnlockRequestModal(false);
        setUnlockRequestNote("");
        await loadDataFromDB(month, year, selectedRestaurantId);
      } else {
        toast.error(res.error || "Fehler.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUnlock = async () => {
    if (!selectedRestaurantId || selectedRestaurantId === "all") return;
    setLoading(true);
    try {
      const res = await approveClUnlock(selectedRestaurantId, month, year);
      if (res.success) {
        toast.success("Bearbeitung temporär freigegeben.");
        const p = new URLSearchParams(searchParams.toString());
        p.delete("clApprove");
        router.replace(`?${p.toString()}`, { scroll: false });
        await loadDataFromDB(month, year, selectedRestaurantId);
      } else {
        toast.error(res.error || "Fehler.");
      }
    } finally {
      setLoading(false);
    }
  };

  const openGrantEditModal = async () => {
    if (!selectedRestaurantId || selectedRestaurantId === "all") return;
    setShowGrantEditModal(true);
    setSelectedGranteeId("");
    setLoadingGrantList(true);
    try {
      const list = await listLaborClGrantCandidates(selectedRestaurantId);
      setGrantCandidates(Array.isArray(list) ? list : []);
      if (!list?.length) {
        toast.info("Keine passenden Mitarbeiter (nur direkt unterstellte am Standort bzw. alle bei Admin).");
      }
    } catch (e) {
      console.error(e);
      setGrantCandidates([]);
      toast.error("Liste konnte nicht geladen werden.");
    } finally {
      setLoadingGrantList(false);
    }
  };

  const handleGrantEditConfirm = async () => {
    if (!selectedRestaurantId || selectedRestaurantId === "all") return;
    if (!selectedGranteeId) {
      toast.error("Bitte einen Mitarbeiter auswählen.");
      return;
    }
    setLoading(true);
    try {
      const res = await grantClTemporaryEdit(selectedRestaurantId, month, year, selectedGranteeId);
      if (res.success) {
        toast.success("Bearbeitung freigegeben.");
        setShowGrantEditModal(false);
        setSelectedGranteeId("");
        await loadDataFromDB(month, year, selectedRestaurantId);
      } else {
        toast.error(res.error || "Fehler.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeClGrant = async () => {
    if (!selectedRestaurantId || selectedRestaurantId === "all") return;
    if (!window.confirm("Bearbeitungsfreigabe wirklich widerrufen? Der Mitarbeiter kann danach nicht mehr speichern.")) {
      return;
    }
    setLoading(true);
    try {
      const res = await revokeClEditGrant(selectedRestaurantId, month, year);
      if (res.success) {
        toast.success("Freigabe widerrufen.");
        await loadDataFromDB(month, year, selectedRestaurantId);
      } else {
        toast.error(res.error || "Fehler.");
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedRest = restaurants.find((r) => r.id === selectedRestaurantId);
  const headerTitle = selectedRest ? `${selectedRest.code} – ${selectedRest.name || ""}` : "Personaleinsatzplanung";
  const hasValidRestaurant = !!selectedRestaurantId && selectedRestaurantId !== "all";

  return (
    <div className="min-h-screen bg-background p-6 text-foreground font-sans">
      {loading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#1b3a26]" />
        </div>
      )}

      {/* PDF Popup Modal */}
      {pdfPopupUrl && (
        <div className="fixed inset-0 top-14 md:top-16 z-[200] bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-[#1b3a26] text-white shrink-0">
            <span className="font-bold text-sm">PDF Vorschau</span>
            <button
              onClick={() => {
                URL.revokeObjectURL(pdfPopupUrl);
                setPdfPopupUrl(null);
              }}
              className="text-white hover:text-[#FFC72C] font-bold text-lg leading-none px-2"
              aria-label="Schließen"
            >
              ✕
            </button>
          </div>
          <iframe
            src={pdfPopupUrl}
            className="flex-1 w-full border-0 bg-white"
            title="PDF Vorschau"
          />
        </div>
      )}

      {dayNoteModalDay != null && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="day-note-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !dayNoteSaving) {
              setDayNoteModalDay(null);
              setDayNoteDraft("");
            }
          }}
        >
          <div
            className="bg-card rounded-xl shadow-xl border border-border max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="day-note-title" className="text-lg font-black mb-1 flex items-center gap-2">
              <StickyNote size={20} className="text-amber-600 shrink-0" />
              Tagesnotiz
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              Tag {dayNoteModalDay}. · {MONTH_NAMES_DE[month - 1]} {year} · nur dieser Store
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              {canEditCl
                ? "Besonderheiten für diesen Tag (z. B. ungewöhnliche Planung). Leer lassen und speichern = Notiz löschen."
                : "Monat gesperrt – nur Lesen."}
            </p>
            <textarea
              value={dayNoteDraft}
              onChange={(e) => setDayNoteDraft(e.target.value)}
              disabled={!canEditCl || dayNoteSaving}
              rows={5}
              className="w-full min-h-[120px] p-3 border border-border rounded-lg text-sm bg-background mb-4 resize-y disabled:opacity-70"
              placeholder="z. B. verkürzte Öffnungszeit, Event, Personalausfall …"
            />
            <div className="flex gap-2 justify-end flex-wrap">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted disabled:opacity-50"
                disabled={dayNoteSaving}
                onClick={() => {
                  setDayNoteModalDay(null);
                  setDayNoteDraft("");
                }}
              >
                {canEditCl ? "Abbrechen" : "Schließen"}
              </button>
              {canEditCl ? (
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-[#1b3a26] text-white font-bold hover:bg-[#142e1e] disabled:opacity-50 inline-flex items-center gap-2"
                  disabled={dayNoteSaving}
                  onClick={() => void handleSaveDayNote()}
                >
                  {dayNoteSaving ? "Speichern…" : "Speichern"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {showFinishMonthModal && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="cl-finish-title">
          <div className="bg-card rounded-xl shadow-xl border border-border max-w-md w-full p-6">
            <h2 id="cl-finish-title" className="text-lg font-black mb-2">Monat abschließen?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Daten werden gespeichert und der Monat für die Bearbeitung gesperrt. PDF-Export bleibt möglich. Ihr Vorgesetzter wird benachrichtigt.
            </p>
            <div className="flex gap-2 justify-end flex-wrap">
              <button type="button" className="px-4 py-2 rounded-lg border border-border hover:bg-muted" onClick={() => setShowFinishMonthModal(false)}>
                Abbrechen
              </button>
              <button type="button" className="px-4 py-2 rounded-lg bg-[#1b3a26] text-white font-bold hover:bg-[#142e1e]" onClick={handleFinishMonthConfirm}>
                Speichern &amp; sperren
              </button>
            </div>
          </div>
        </div>
      )}

      {showUnlockRequestModal && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-card rounded-xl shadow-xl border border-border max-w-md w-full p-6">
            <h2 className="text-lg font-black mb-2">Entsperrung anfragen</h2>
            <p className="text-sm text-muted-foreground mb-2">Optionaler Grund für den Vorgesetzten:</p>
            <textarea
              value={unlockRequestNote}
              onChange={(e) => setUnlockRequestNote(e.target.value)}
              className="w-full min-h-[88px] p-2 border border-border rounded-lg text-sm mb-4 bg-background"
            />
            <div className="flex gap-2 justify-end flex-wrap">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted"
                onClick={() => { setShowUnlockRequestModal(false); setUnlockRequestNote(""); }}
              >
                Abbrechen
              </button>
              <button type="button" className="px-4 py-2 rounded-lg bg-[#1b3a26] text-white font-bold hover:bg-[#142e1e]" onClick={handleUnlockRequestSubmit}>
                Anfrage senden
              </button>
            </div>
          </div>
        </div>
      )}

      {showGrantEditModal && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-card rounded-xl shadow-xl border border-border max-w-md w-full p-6">
            <h2 className="text-lg font-black mb-2">Bearbeitung freigeben</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Wählen Sie den Mitarbeiter, der diesen gesperrten Monat vorübergehend bearbeiten darf (bis zum nächsten Speichern).
            </p>
            {loadingGrantList ? (
              <p className="text-sm text-muted-foreground py-4">Lade Mitarbeiter…</p>
            ) : (
              <select
                value={selectedGranteeId}
                onChange={(e) => setSelectedGranteeId(e.target.value)}
                className="w-full p-2 border border-border rounded-lg text-sm bg-background mb-4"
              >
                <option value="">— Mitarbeiter wählen —</option>
                {grantCandidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.name || u.email || u.id).trim()}
                    {u.email && u.name ? ` (${u.email})` : ""}
                  </option>
                ))}
              </select>
            )}
            <div className="flex gap-2 justify-end flex-wrap">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted"
                onClick={() => {
                  setShowGrantEditModal(false);
                  setSelectedGranteeId("");
                }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={loading || loadingGrantList || !selectedGranteeId}
                className="px-4 py-2 rounded-lg bg-[#1b3a26] text-white font-bold hover:bg-[#142e1e] disabled:opacity-50"
                onClick={() => void handleGrantEditConfirm()}
              >
                Freigeben
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER – unificirani layout */}
      <div className="mx-auto mb-6 md:mb-8" style={{ maxWidth: "1600px" }}>
        <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter mb-2">
              PERSONALEINSATZ{" "}
              <span className="text-[#FFC72C]">
                {selectedRest ? (selectedRest.name || selectedRest.code) : "PLANUNG"}
              </span>
            </h1>
          </div>
        </div>
      </div>

      {hasValidRestaurant && clMeta.canApproveUnlock && (
        <div
          className="mx-auto mb-2 rounded-lg border border-[#FFC72C] bg-[#fffbeb] dark:bg-amber-950/30 py-1.5 px-3 flex flex-row flex-wrap items-center justify-between gap-2 print:hidden"
          style={{ maxWidth: "1600px" }}
        >
          <p className="text-xs font-semibold text-[#1b3a26] dark:text-amber-100 leading-tight min-w-0 flex-1">
            CL-Entsperranfrage: Bearbeitung bis zum nächsten Speichern freigeben.
          </p>
          <button
            type="button"
            onClick={handleApproveUnlock}
            disabled={loading}
            className="shrink-0 h-8 px-3 rounded-md bg-[#FFBC0D] hover:bg-[#e6b225] disabled:opacity-50 text-black font-bold text-xs"
          >
            Freigeben
          </button>
        </div>
      )}

      {hasValidRestaurant && clMeta.canRevokeClEdit && (
        <div
          className="mx-auto mb-2 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/25 py-1.5 px-3 flex flex-row flex-wrap items-center justify-between gap-2 print:hidden"
          style={{ maxWidth: "1600px" }}
        >
          <p className="text-xs font-semibold text-red-900 dark:text-red-100 leading-tight min-w-0 flex-1">
            Aktive Bearbeitungsfreigabe – jederzeit widerrufbar (danach nur Lesen/PDF).
          </p>
          <button
            type="button"
            onClick={() => void handleRevokeClGrant()}
            disabled={loading}
            className="shrink-0 h-8 px-3 rounded-md border border-red-600 text-red-700 dark:text-red-200 font-bold text-xs hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
          >
            Widerrufen
          </button>
        </div>
      )}

      {hasValidRestaurant && clMeta.canGrantClEdit && (
        <div
          className="mx-auto mb-2 rounded-lg border border-emerald-500/50 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-950/25 py-1.5 px-3 flex flex-row flex-wrap items-center justify-between gap-2 print:hidden"
          style={{ maxWidth: "1600px" }}
        >
          <p className="text-xs font-semibold text-[#14532d] dark:text-emerald-100 leading-tight min-w-0 flex-1">
            Monat gesperrt – Bearbeitung für einen Mitarbeiter freigeben (ohne Antrag).
          </p>
          <button
            type="button"
            onClick={() => void openGrantEditModal()}
            disabled={loading}
            className="shrink-0 h-8 px-3 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs disabled:opacity-50"
          >
            Mitarbeiter wählen
          </button>
        </div>
      )}

      {hasValidRestaurant && (
        <div className="mx-auto flex flex-col md:flex-row justify-end items-center mb-8 gap-3 print:hidden" style={{ maxWidth: "1600px" }}>
          <div className="flex flex-wrap gap-2 items-center justify-end">
            {clMeta.clLocked && (
              <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-100 px-3 py-2 rounded-lg bg-amber-100 dark:bg-amber-950/40 border border-amber-300/60 max-w-full">
                <Lock size={16} className="shrink-0" />
                <span>
                  {!canEditCl
                    ? "Monat gesperrt (nur Lesen / PDF)"
                    : clMeta.canBypassClLock
                      ? "Sperren"
                      : "Vorübergehend bearbeitbar – nach Speichern wieder gesperrt"}
                </span>
              </span>
            )}
            {clMeta.hasPendingUnlockRequest && !clMeta.canApproveUnlock && (
              <span className="text-xs font-semibold text-muted-foreground px-2">Entsperranfrage ausstehend</span>
            )}
            {!clMeta.clLocked && canEditCl && (
              <button
                type="button"
                onClick={() => setShowFinishMonthModal(true)}
                className="h-10 px-4 rounded-sm bg-[#1b3a26] hover:bg-[#142e1e] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition"
                title="Monat abschließen und sperren"
              >
                <Lock size={18} />
                <span className="whitespace-nowrap">Monat abschließen</span>
              </button>
            )}
            {clMeta.clLocked && !canEditCl && !clMeta.hasPendingUnlockRequest && (
              <button
                type="button"
                onClick={() => setShowUnlockRequestModal(true)}
                className="h-10 px-4 rounded-sm border-2 border-[#1b3a26] text-[#1b3a26] dark:text-[#FFC72C] dark:border-[#FFC72C] font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition hover:bg-muted"
                title="Entsperrung anfragen"
              >
                <Unlock size={18} />
                <span className="whitespace-nowrap">Entsperrung anfragen</span>
              </button>
            )}
            <button
              onClick={() => saveDataToDB(false)}
              disabled={!canEditCl || loading}
              className="h-10 px-4 rounded-sm bg-[#FFBC0D] hover:bg-[#e6b225] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition"
              title={!canEditCl ? "Monat gesperrt" : "Speichern"}
            >
              <Save size={18} strokeWidth={2.5} className="shrink-0" />
              <span className="whitespace-nowrap">Speichern</span>
            </button>
            <button
              onClick={handlePrintSingle}
              className="h-10 px-4 rounded-lg bg-[#FFC72C] text-[#1a3826] hover:bg-[#e6b225] transition flex items-center justify-center gap-2 shadow-sm font-bold text-sm"
              title="Monat PDF"
            >
              <FileDown size={18} strokeWidth={2.5} className="shrink-0" />
              <span className="whitespace-nowrap">PDF aktuell</span>
            </button>
            <button
              onClick={handleExportYear}
              className="h-10 px-4 rounded-lg bg-[#FFC72C] text-[#1a3826] hover:bg-[#e6b225] transition flex items-center justify-center gap-2 shadow-sm font-bold text-sm"
              title="Ganzes Jahr PDF"
            >
              <CalendarDays size={18} strokeWidth={2.5} className="shrink-0" />
              <span className="whitespace-nowrap">PDF jährlich</span>
            </button>
            <button
              type="button"
              onClick={handleDeleteData}
              disabled={loading || (clMeta.clLocked && !clMeta.canBypassClLock)}
              className="h-10 px-4 rounded-lg bg-[#FFC72C] text-red-600 hover:bg-[#e6b225] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-sm font-bold text-sm"
              title="Daten löschen"
            >
              <Trash2 size={18} strokeWidth={2.5} className="shrink-0" />
            </button>
          </div>
        </div>
      )}

      {isExporting && (
        <div className="w-full py-4 px-8 mb-4 flex justify-between items-center text-white" style={{ backgroundColor: COLORS.green }}>
          <div className="font-bold text-2xl">AIW Services</div>
          <div className="text-right">
            <div className="text-sm opacity-80">Personaleinsatzplanung</div>
            <div className="font-bold text-lg">
              {headerTitle} – {MONTH_NAMES_DE[month - 1]} {year}
            </div>
          </div>
        </div>
      )}

      {hasValidRestaurant ? (
        <div className="mx-auto bg-card p-8 rounded-2xl shadow-xl border border-border overflow-hidden" style={{ maxWidth: "1600px" }}>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            <div className="xl:col-span-3 flex flex-col gap-6">
              <div className="bg-card border border-border rounded-xl shadow-sm p-5 no-print">
                <h3 className="text-foreground font-semibold text-sm border-b border-border pb-3 mb-4 uppercase">Einstellungen</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
                    <div className="min-w-0">
                      <label className="text-xs font-medium text-muted-foreground uppercase block mb-1">Jahr</label>
                      <select
                        value={year}
                        disabled={!canEditCl}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="w-full p-2 bg-muted border border-border rounded-lg text-sm font-medium text-foreground focus:ring-2 focus:ring-ring outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {[2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-0 text-right">
                      <span className="text-base font-semibold text-foreground truncate block" title={MONTH_NAMES_DE[month - 1]}>
                        {MONTH_NAMES_DE[month - 1]}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {MONTH_NAMES_DE.map((mName, i) => (
                      <button
                        key={i}
                        type="button"
                        disabled={!canEditCl}
                        onClick={() => setMonth(i + 1)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          month === i + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {mName.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl shadow-sm p-5">
                <h3 className="text-gray-700 font-bold text-sm uppercase mb-3">Parameter</h3>
                <div className="space-y-2">
                  <InputRow label="Stundensatz (€)" value={avgWage} disabled={!canEditCl} onChange={(v) => { setAvgWage(v); setHasUnsavedChanges(true); }} decimals={2} />
                  <InputRow label="Urlaub (h)" value={vacationStd} disabled={!canEditCl} onChange={(v) => { setVacationStd(v); setHasUnsavedChanges(true); }} />
                  <InputRow label="Krankheit (h)" value={sickStd} disabled={!canEditCl} onChange={(v) => { setSickStd(v); setHasUnsavedChanges(true); }} />
                  <InputRow label="Koeffizient Brutto/Netto" value={koefficientBruttoNetto} disabled={!canEditCl} onChange={(v) => { setKoefficientBruttoNetto(v); setHasUnsavedChanges(true); }} decimals={4} />
                  <InputRow label="Förderung (€)" value={foerderung} disabled={!canEditCl} onChange={(v) => { setFoerderung(v); setHasUnsavedChanges(true); }} />
                  <div className="h-px bg-muted my-2" />
                  <ReadOnlyRow label="Produktive Std" value={fmtHours(totals.sumProduktiveStd)} />
                  <ReadOnlyRow label="SF Std" value={fmtHours(totals.sumSF)} />
                  <ReadOnlyRow label="HM Std" value={fmtHours(totals.sumHM)} />
                  <ReadOnlyRow label="Nacht (€)" value={fmtNum(totals.sumNZ)} />
                  <ReadOnlyRow label="Extra Std. (Summe)" value={fmtHours(totals.sumExtra)} />
                  <div className="h-px bg-muted my-2" />
                  <InputRow label="Budget Umsatz" value={budgetUmsatz} disabled={!canEditCl} onChange={(v) => { setBudgetUmsatz(v); setHasUnsavedChanges(true); }} />
                  <InputRow label="Budget CL €" value={budgetCL} disabled={!canEditCl} onChange={(v) => { setBudgetCL(v); setHasUnsavedChanges(true); }} />
                  <InputRow label="Budget CL %" value={budgetCLPct} disabled={!canEditCl} onChange={(v) => { setBudgetCLPct(v); setHasUnsavedChanges(true); }} decimals={2} />
                </div>
              </div>

              <div className="rounded-xl shadow-md p-5 space-y-3" style={{ backgroundColor: COLORS.yellow }}>
                <SummaryRow label="Umsatz Gesamt (Netto)" value={`${fmtNum(totals.umsatzGesamt)} €`} color="text-[#1b3a26]" />
                <SummaryRow label="Gesamt Std." value={`${fmtHours(totals.gesamtStd)} h`} color="text-[#1b3a26]" />
                <div className="bg-white/80 p-3 rounded-lg border border-[#1b3a26]/10 flex justify-between items-center gap-2 my-2">
                  <span className="text-sm font-bold text-[#1b3a26] shrink-0">CL (€)</span>
                  <span className={`text-xl font-black whitespace-nowrap tabular-nums text-right ${totals.budgetCLVal > totals.clEuro ? "text-green-700" : "text-red-600"}`}>
                    {fmtNum(totals.clEuro)} €
                  </span>
                </div>
                <SummaryRow label="CL %" value={`${fmtNum(totals.clPct, 2)} %`} bold color="text-[#1b3a26]" />
                <div className="h-px bg-[#1b3a26]/20 my-1" />
                <SummaryRow label="Prod. (Bericht)" value={totals.istProd > 0 ? `${fmtNum(totals.istProd)} €` : "—"} color="text-[#1b3a26]" />
                <SummaryRow label="Prod. (REAL)" value={totals.realProd > 0 ? `${fmtNum(totals.realProd)} €` : "—"} color="text-[#1b3a26]" />
              </div>
            </div>

            <div className="xl:col-span-9">
              <div ref={tableWrapperRef} className="border border-border rounded-lg shadow-sm" onKeyDown={handleTableKeyDown}>
                <div className="overflow-x-auto rounded-lg">
                  <table className="w-full text-sm border-collapse" style={{ borderColor: COLORS.border }}>
                    <thead>
                      <tr className="text-white uppercase text-xs tracking-wider" style={{ backgroundColor: COLORS.green }}>
                        <th className="p-3 border border-border text-center font-bold w-24 rounded-tl-lg">Tag</th>
                        <th
                          className={`p-3 border border-border text-center w-28 ${canEditCl ? "cursor-pointer hover:bg-muted/50" : "cursor-default"}`}
                          onClick={canEditCl ? () => handleCopyDown("bruttoUmsatz") : undefined}
                        >
                          Brutto Umsatz
                        </th>
                        <th className="p-3 border border-border text-center w-28 bg-[#142e1e]">Netto Umsatz</th>
                        <th
                          className={`p-3 border border-border text-center w-24 ${canEditCl ? "cursor-pointer hover:bg-muted/50" : "cursor-default"}`}
                          onClick={canEditCl ? () => handleCopyDown("geplanteProduktivitaetPct") : undefined}
                        >
                          Gepl. Prod. %
                        </th>
                        <th
                          className={`p-3 border border-border text-center w-24 bg-[#142e1e] ${canEditCl ? "cursor-pointer hover:bg-muted/50" : "cursor-default"}`}
                          onClick={canEditCl ? () => handleCopyDown("produktiveStd") : undefined}
                        >
                          Produktive Std.
                        </th>
                        <th
                          className={`p-3 border border-border text-center w-24 leading-tight ${canEditCl ? "cursor-pointer hover:bg-muted/50" : "cursor-default"}`}
                          onClick={canEditCl ? () => handleCopyDown("sfStd") : undefined}
                        >
                          SF<br /><span className="normal-case text-[10px]">(produktiv)</span>
                        </th>
                        <th
                          className={`p-3 border border-border text-center w-24 ${canEditCl ? "cursor-pointer hover:bg-muted/50" : "cursor-default"}`}
                          onClick={canEditCl ? () => handleCopyDown("hmStd") : undefined}
                        >
                          HM
                        </th>
                        <th
                          className={`p-3 border border-border text-center w-24 ${canEditCl ? "cursor-pointer hover:bg-muted/50" : "cursor-default"}`}
                          onClick={canEditCl ? () => handleCopyDown("nzEuro") : undefined}
                        >
                          NZ Euro
                        </th>
                        <th
                          className={`p-3 border border-border text-center w-24 rounded-tr-lg ${canEditCl ? "cursor-pointer hover:bg-muted/50" : "cursor-default"}`}
                          onClick={canEditCl ? () => handleCopyDown("extraStd") : undefined}
                        >
                          Extra Std. Unproduktiv
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {daysData.map((day, idx) => {
                        if (!day.exists) return null;
                        const produktiveVal = calcProduktiveStdForDay(day, koeffNum);
                        return (
                          <tr key={idx} style={{ backgroundColor: day.isHoliday ? "#fef2f2" : day.isWeekend ? "#f3f4f6" : "#ffffff" }}>
                            <LaborDayTagCell
                              day={day}
                              comment={dayComments[String(day.day)]}
                              canEditCl={canEditCl}
                              onOpenNote={() => {
                                const k = String(day.day);
                                const t = dayComments[k];
                                if (!canEditCl && !t) {
                                  toast.info("Keine Notiz für diesen Tag.");
                                  return;
                                }
                                setDayNoteModalDay(day.day);
                                setDayNoteDraft(t ?? "");
                              }}
                            />
                            <td className="p-0.5 border border-border text-center align-middle">
                              <TableInput
                                val={day.bruttoUmsatz}
                                setVal={(v) => handleInputChange(idx, "bruttoUmsatz", v)}
                                type="euro"
                                disabled={!canEditCl}
                              />
                            </td>
                            <td className="p-1 border border-border text-center text-foreground font-mono text-xs font-bold bg-muted/50">
                              {parseDEFlex(day.bruttoUmsatz) && koeffNum > 0 ? fmtNum(parseDEFlex(day.bruttoUmsatz) / koeffNum) : (day.nettoUmsatz || "—")}
                            </td>
                            <td className="p-0.5 border border-border text-center align-middle">
                              <TableInput
                                val={day.geplanteProduktivitaetPct}
                                setVal={(v) => handleInputChange(idx, "geplanteProduktivitaetPct", v)}
                                type="pct"
                                disabled={!canEditCl}
                              />
                            </td>
                            <td className="p-1 border border-border text-center text-foreground font-mono text-xs font-bold bg-muted/50">
                              {produktiveVal ? fmtHours(produktiveVal) : "—"}
                            </td>
                            <td className="p-0.5 border border-border text-center align-middle"><TableInput val={day.sfStd} setVal={(v) => handleInputChange(idx, "sfStd", v)} type="hours" disabled={!canEditCl} /></td>
                            <td className="p-0.5 border border-border text-center align-middle"><TableInput val={day.hmStd} setVal={(v) => handleInputChange(idx, "hmStd", v)} type="hours" disabled={!canEditCl} /></td>
                            <td className="p-0.5 border border-border text-center align-middle"><TableInput val={day.nzEuro} setVal={(v) => handleInputChange(idx, "nzEuro", v)} type="euro" disabled={!canEditCl} /></td>
                            <td className="p-0.5 border border-border text-center align-middle"><TableInput val={day.extraStd} setVal={(v) => handleInputChange(idx, "extraStd", v)} type="hours" disabled={!canEditCl} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="font-bold border-t-2 border-border text-sm">
                      <tr style={{ backgroundColor: COLORS.lightGray }}>
                        <td className="p-3 border border-border text-center uppercase text-muted-foreground rounded-bl-lg">Summe</td>
                        <td className="p-3 border border-border text-center">{fmtNum(totals.sumBrutto)}</td>
                        <td className="p-3 border border-border text-center">{fmtNum(totals.sumNetto)}</td>
                        <td className="p-3 border border-border text-center text-gray-400">—</td>
                        <td className="p-3 border border-border text-center">{fmtHours(totals.sumProduktiveStd)}</td>
                        <td className="p-3 border border-border text-center">{fmtHours(totals.sumSF)}</td>
                        <td className="p-3 border border-border text-center">{fmtHours(totals.sumHM)}</td>
                        <td className="p-3 border border-border text-center">{fmtNum(totals.sumNZ)}</td>
                        <td className="p-3 border border-border text-center rounded-br-lg">{fmtHours(totals.sumExtra)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-2xl mt-8">
          <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/80 dark:bg-amber-950/20 p-6 text-center shadow-sm">
            <h2 className="text-lg font-black text-[#1b3a26] dark:text-amber-100 mb-2">
              Bitte wählen Sie ein Restaurant
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Die Personaleinsatzplanung ist nur für einen konkreten Store verfügbar. Wählen Sie oben im Kopfbereich einen Store aus, um mit der Planung zu beginnen.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const InputRow = ({
  label,
  value,
  onChange,
  decimals = 0,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  decimals?: number;
  disabled?: boolean;
}) => (
  <div className="flex justify-between items-center gap-3">
    <label className="text-xs font-bold text-gray-500 uppercase">{label}</label>
    <input
      type="text"
      inputMode="decimal"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v && !Number.isNaN(parseDEFlex(v))) onChange(fmtNum(parseDEFlex(v), decimals));
      }}
      className={`${decimals >= 4 ? "w-[7.25rem]" : "w-24"} p-1.5 border-2 border-border rounded text-right text-sm font-semibold text-gray-800 tabular-nums focus:outline-none focus:border-[#1b3a26] focus:ring-2 focus:ring-[#1b3a26] focus:ring-opacity-50 caret-[#1b3a26] selection:bg-[#ffc72c]/30 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-muted/50`}
      style={{ caretColor: "#1b3a26" }}
    />
  </div>
);

const ReadOnlyRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center gap-3 bg-muted p-1.5 rounded border border-border">
    <label className="text-xs font-bold text-gray-400 uppercase">{label}</label>
    <div className="font-mono text-sm font-bold text-gray-700">{value}</div>
  </div>
);

const SummaryRow = ({ label, value, bold, color = "text-foreground" }: { label: string; value: string; bold?: boolean; color?: string }) => (
  <div className="flex justify-between items-center gap-2 min-h-[1.5rem]">
    <span className={`text-sm font-bold opacity-80 uppercase shrink-0 ${color}`}>{label}</span>
    <span className={`${bold ? "font-black text-lg" : "font-bold"} ${color} whitespace-nowrap tabular-nums text-right`}>{value}</span>
  </div>
);

const TableInput = ({
  val,
  setVal,
  type,
  disabled,
}: {
  val: string;
  setVal: (v: string) => void;
  type?: "euro" | "hours" | "pct";
  disabled?: boolean;
}) => {
  const isHours = type === "hours" || type === "pct";
  const formatVal = (raw: string) => (isHours ? (parseDEFlex(raw) ? fmtHours(parseDEFlex(raw)) : "") : fmtNum(parseDEFlex(raw)));
  return (
    <input
      type="text"
      inputMode="decimal"
      value={val}
      disabled={disabled}
      onChange={(e) => setVal(e.target.value)}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v !== "" && !Number.isNaN(parseDEFlex(v))) setVal(formatVal(v));
      }}
      className="w-full min-w-0 h-9 px-1.5 text-center text-sm font-medium text-gray-900 placeholder:text-gray-400 bg-white border border-border rounded focus:outline-none focus:border-[#1b3a26] focus:ring-2 focus:ring-[#1b3a26] focus:ring-inset focus:bg-[#fffbeb] caret-[#1b3a26] selection:bg-[#ffc72c]/40 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-muted/50"
      style={{ caretColor: "#1b3a26" }}
      placeholder="0"
    />
  );
};

export default function LaborPlannerClient(props: { defaultRestaurantId?: string | null }) {
  return (
    <Suspense fallback={<div className="p-10 text-center">Laden…</div>}>
      <LaborPlannerContent defaultRestaurantId={props.defaultRestaurantId} />
    </Suspense>
  );
}
