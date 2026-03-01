"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, FileDown, CalendarDays, Trash2 } from "lucide-react";

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
}

interface Restaurant {
  id: string;
  code: string;
  name: string | null;
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
  const [koefficientBruttoNetto, setKoefficientBruttoNetto] = useState("1,118");
  const [foerderung, setFoerderung] = useState("");
  const [budgetUmsatz, setBudgetUmsatz] = useState("");
  const [budgetCL, setBudgetCL] = useState("");
  const [budgetCLPct, setBudgetCLPct] = useState("");

  const [daysData, setDaysData] = useState<DayData[]>([]);
  const [holidaysForYear, setHolidaysForYear] = useState<{ d: number; m: number }[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const currentRestaurantIdRef = React.useRef<string | null>(null);
  const tableWrapperRef = React.useRef<HTMLDivElement>(null);

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
    setKoefficientBruttoNetto("1,118"); setFoerderung("");
    setBudgetUmsatz(""); setBudgetCL(""); setBudgetCLPct("");
  };

  useEffect(() => {
    currentRestaurantIdRef.current = selectedRestaurantId;
  }, [selectedRestaurantId]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
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

  useEffect(() => {
    try {
      sessionStorage.setItem("labor-planner-year", String(year));
      sessionStorage.setItem("labor-planner-month", String(month));
    } catch {
      // ignore
    }
  }, [year, month]);

  const loadDataFromDB = useCallback(
    async (m: number, y: number, rId: string) => {
      if (!rId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/labor-planner?year=${y}&month=${m}&restaurant=${rId}`);
        const json = await res.json();

        if (currentRestaurantIdRef.current !== rId) return;

        if (json.success && json.data) {
          const parsed: LaborPlanData = json.data;
          if (parsed.inputs) {
            setAvgWage(parsed.inputs.avgWage || "");
            setVacationStd(parsed.inputs.vacationStd || "");
            setSickStd(parsed.inputs.sickStd || "");
            setExtraUnprodStd(parsed.inputs.extraUnprodStd || "");
            setKoefficientBruttoNetto(parsed.inputs.koefficientBruttoNetto || "1,118");
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
          setHasUnsavedChanges(false);
        } else {
          clearInputs();
          generateEmptyDays(m, y, [], 1.118);
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

  const saveDataToDB = useCallback(async (silent = false) => {
    if (!selectedRestaurantId || selectedRestaurantId === "all") {
      if (!silent) toast.error("Bitte Restaurant auswählen.");
      return;
    }
    if (!silent) setLoading(true);

    const dataToSave: LaborPlanData = {
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
          // Spremamo već izračunatu vrijednost po Excel formuli (J/K-M)
          produktiveStd: produktiveVal ? fmtHours(produktiveVal) : "",
          sfStd: d.sfStd,
          hmStd: d.hmStd,
          nzEuro: d.nzEuro,
          extraStd: d.extraStd,
        };
      }),
    };

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
      } else {
        toast.error(json?.error || "Fehler beim Speichern.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Fehler beim Speichern.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedRestaurantId, year, month, avgWage, vacationStd, sickStd, extraUnprodStd, koefficientBruttoNetto, foerderung, budgetUmsatz, budgetCL, budgetCLPct, daysData, koeffNum]);

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

    // —— Kartica (bijela površina s borderom)
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.3);
    doc.rect(margin, 26, 210 - 2 * margin, 297 - 26 - margin, "S");

    let y = 32;
    doc.setTextColor(27, 58, 38);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Einstellungen", margin + 2, y);
    y += 2;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin + 2, y, margin + leftColW - 2, y);
    y += 6;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Jahr", margin + 2, y);
    doc.text(String(year), margin + leftColW - 2, y, { align: "right" });
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(27, 58, 38);
    doc.text(MONTH_NAMES_DE[month - 1], margin + 2, y);
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("Parameter", margin + 2, y);
    y += 2;
    doc.line(margin + 2, y, margin + leftColW - 2, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const param = (l: string, v: string) => {
      doc.text(l, margin + 2, y);
      doc.text(v || "—", margin + leftColW - 2, y, { align: "right" });
      y += 4;
    };
    param("Stundensatz (€)", avgWage);
    param("Urlaub (h)", vacationStd);
    param("Krankheit (h)", sickStd);
    param("Koeffizient Brutto/Netto", koefficientBruttoNetto);
    param("Förderung (€)", foerderung);
    y += 2;
    doc.line(margin + 2, y, margin + leftColW - 2, y);
    y += 5;
    param("Produktive Std", fmtHours(totals.sumProduktiveStd));
    param("SF Std", fmtHours(totals.sumSF));
    param("HM Std", fmtHours(totals.sumHM));
    param("Nacht (€)", fmtNum(totals.sumNZ));
    param("Extra Std. (Summe)", fmtHours(totals.sumExtra));
    y += 2;
    doc.line(margin + 2, y, margin + leftColW - 2, y);
    y += 5;
    param("Budget Umsatz", budgetUmsatz);
    param("Budget CL €", budgetCL);
    param("Budget CL %", budgetCLPct);
    y += 6;

    // —— Žuti rezime blok (kao na stranici)
    doc.setFillColor(255, 199, 44);
    doc.roundedRect(margin + 2, y - 2, leftColW - 4, 38, 2, 2, "F");
    doc.setTextColor(27, 58, 38);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("Umsatz Gesamt (Netto)", margin + 5, y + 4);
    doc.text(`${fmtNum(totals.umsatzGesamt)} €`, margin + leftColW - 7, y + 4, { align: "right" });
    doc.text("Gesamt Std.", margin + 5, y + 9);
    doc.text(`${fmtHours(totals.gesamtStd)} h`, margin + leftColW - 7, y + 9, { align: "right" });
    doc.setFontSize(8);
    doc.text("CL (€)", margin + 5, y + 16);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    const clOverBudget = totals.budgetCLVal > 0 && totals.clEuro > totals.budgetCLVal;
    if (clOverBudget) doc.setTextColor(220, 38, 38);
    else doc.setTextColor(21, 128, 61);
    doc.text(`${fmtNum(totals.clEuro)} €`, margin + leftColW - 7, y + 16, { align: "right" });
    doc.setTextColor(27, 58, 38);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("CL %", margin + 5, y + 21);
    doc.text(`${fmtNum(totals.clPct)} %`, margin + leftColW - 7, y + 21, { align: "right" });
    doc.text("Prod. (IST)", margin + 5, y + 26);
    doc.text(totals.istProd > 0 ? `${fmtNum(totals.istProd)} €` : "—", margin + leftColW - 7, y + 26, { align: "right" });
    doc.text("Prod. (REAL)", margin + 5, y + 31);
    doc.text(totals.realProd > 0 ? `${fmtNum(totals.realProd)} €` : "—", margin + leftColW - 7, y + 31, { align: "right" });

    // —— Tablica (desna strana): jednake kolone, sve centrirano
    const tableWidth = 210 - tableStartX - margin;
    const colW = [19, 17, 17, 13, 15, 11, 10, 14, 14] as const;
    autoTable(doc, {
      startY: 28,
      margin: { left: tableStartX },
      head: [["Tag", "Brutto Umsatz", "Netto Umsatz", "Gepl. Prod. %", "Produktive Std.", "SF", "HM", "NZ Euro", "Extra Std. Unprod."]],
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

    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
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

        doc.setDrawColor(209, 213, 219);
        doc.setLineWidth(0.3);
        doc.rect(margin, 26, 210 - 2 * margin, 297 - 26 - margin, "S");

        let y = 32;
        doc.setTextColor(27, 58, 38);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Einstellungen", margin + 2, y);
        y += 2;
        doc.setDrawColor(220, 220, 220);
        doc.line(margin + 2, y, margin + leftColW - 2, y);
        y += 6;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("Jahr", margin + 2, y);
        doc.text(String(year), margin + leftColW - 2, y, { align: "right" });
        y += 5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(27, 58, 38);
        doc.text(MONTH_NAMES_DE[m - 1], margin + 2, y);
        y += 10;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text("Parameter", margin + 2, y);
        y += 2;
        doc.line(margin + 2, y, margin + leftColW - 2, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        const param = (l: string, v: string) => {
          doc.text(l, margin + 2, y);
          doc.text(v || "—", margin + leftColW - 2, y, { align: "right" });
          y += 4;
        };
        param("Stundensatz (€)", currentInputs.avgWage ?? "");
        param("Urlaub (h)", currentInputs.vacationStd ?? "");
        param("Krankheit (h)", currentInputs.sickStd ?? "");
        param("Koeffizient Brutto/Netto", currentInputs.koefficientBruttoNetto ?? "");
        param("Förderung (€)", currentInputs.foerderung ?? "");
        y += 2;
        doc.line(margin + 2, y, margin + leftColW - 2, y);
        y += 5;
        param("Produktive Std", fmtHours(mSumProduktiveStd));
        param("SF Std", fmtHours(mSumSF));
        param("HM Std", fmtHours(mSumHM));
        param("Nacht (€)", fmtNum(mSumNZ));
        param("Extra Std. (Summe)", fmtHours(mSumExtra));
        y += 2;
        doc.line(margin + 2, y, margin + leftColW - 2, y);
        y += 5;
        param("Budget Umsatz", currentInputs.budgetUmsatz ?? "");
        param("Budget CL €", currentInputs.budgetCL ?? "");
        param("Budget CL %", currentInputs.budgetCLPct ?? "");
        y += 6;
        doc.setFillColor(255, 199, 44);
        doc.roundedRect(margin + 2, y - 2, leftColW - 4, 38, 2, 2, "F");
        doc.setTextColor(27, 58, 38);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text("Umsatz Gesamt (Netto)", margin + 5, y + 4);
        doc.text(`${fmtNum(mSumNetto)} €`, margin + leftColW - 7, y + 4, { align: "right" });
        doc.text("Gesamt Std.", margin + 5, y + 9);
        doc.text(`${fmtHours(gesamtStd)} h`, margin + leftColW - 7, y + 9, { align: "right" });
        doc.setFontSize(8);
        doc.text("CL (€)", margin + 5, y + 16);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        const clOver = budgetCLVal > 0 && clEuro > budgetCLVal;
        if (clOver) doc.setTextColor(220, 38, 38);
        else doc.setTextColor(21, 128, 61);
        doc.text(`${fmtNum(clEuro)} €`, margin + leftColW - 7, y + 16, { align: "right" });
        doc.setTextColor(27, 58, 38);
        doc.setFontSize(7);
        doc.text("CL %", margin + 5, y + 21);
        doc.text(`${fmtNum(clPct)} %`, margin + leftColW - 7, y + 21, { align: "right" });
        doc.text("Prod. (IST)", margin + 5, y + 26);
        doc.text(istProd > 0 ? `${fmtNum(istProd)} €` : "—", margin + leftColW - 7, y + 26, { align: "right" });
        doc.text("Prod. (REAL)", margin + 5, y + 31);
        doc.text(realProd > 0 ? `${fmtNum(realProd)} €` : "—", margin + leftColW - 7, y + 31, { align: "right" });

        autoTable(doc, {
          startY: 28,
          margin: { left: tableStartX },
          head: [["Tag", "Brutto Umsatz", "Netto Umsatz", "Gepl. Prod. %", "Produktive Std.", "SF", "HM", "NZ Euro", "Extra Std. Unprod."]],
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
      }
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      console.error(e);
      toast.error("Fehler beim Erstellen des Jahresberichts.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (idx: number, field: keyof DayData, val: string) => {
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
            <p className="text-muted-foreground text-sm font-medium">
              Dienstplanung pro Stunde und Station für das ausgewählte Restaurant.
            </p>
          </div>
        </div>
      </div>

      {hasValidRestaurant && (
        <div className="mx-auto flex flex-col md:flex-row justify-end items-center mb-8 gap-3 print:hidden" style={{ maxWidth: "1600px" }}>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => saveDataToDB(false)}
              className="h-10 px-4 rounded-sm bg-[#FFBC0D] hover:bg-[#e6b225] text-black font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition"
              title="Speichern"
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
              className="h-10 px-4 rounded-lg bg-[#FFC72C] text-red-600 hover:bg-[#e6b225] transition flex items-center justify-center gap-2 shadow-sm font-bold text-sm"
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
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="w-full p-2 bg-muted border border-border rounded-lg text-sm font-medium text-foreground focus:ring-2 focus:ring-ring outline-none"
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
                        onClick={() => setMonth(i + 1)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
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
                  <InputRow label="Stundensatz (€)" value={avgWage} onChange={(v) => { setAvgWage(v); setHasUnsavedChanges(true); }} decimals={2} />
                  <InputRow label="Urlaub (h)" value={vacationStd} onChange={(v) => { setVacationStd(v); setHasUnsavedChanges(true); }} />
                  <InputRow label="Krankheit (h)" value={sickStd} onChange={(v) => { setSickStd(v); setHasUnsavedChanges(true); }} />
                  <InputRow label="Koeffizient Brutto/Netto" value={koefficientBruttoNetto} onChange={(v) => { setKoefficientBruttoNetto(v); setHasUnsavedChanges(true); }} decimals={2} />
                  <InputRow label="Förderung (€)" value={foerderung} onChange={(v) => { setFoerderung(v); setHasUnsavedChanges(true); }} />
                  <div className="h-px bg-muted my-2" />
                  <ReadOnlyRow label="Produktive Std" value={fmtHours(totals.sumProduktiveStd)} />
                  <ReadOnlyRow label="SF Std" value={fmtHours(totals.sumSF)} />
                  <ReadOnlyRow label="HM Std" value={fmtHours(totals.sumHM)} />
                  <ReadOnlyRow label="Nacht (€)" value={fmtNum(totals.sumNZ)} />
                  <ReadOnlyRow label="Extra Std. (Summe)" value={fmtHours(totals.sumExtra)} />
                  <div className="h-px bg-muted my-2" />
                  <InputRow label="Budget Umsatz" value={budgetUmsatz} onChange={(v) => { setBudgetUmsatz(v); setHasUnsavedChanges(true); }} />
                  <InputRow label="Budget CL €" value={budgetCL} onChange={(v) => { setBudgetCL(v); setHasUnsavedChanges(true); }} />
                  <InputRow label="Budget CL %" value={budgetCLPct} onChange={(v) => { setBudgetCLPct(v); setHasUnsavedChanges(true); }} decimals={2} />
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
                <SummaryRow label="CL %" value={`${fmtNum(totals.clPct)} %`} bold color="text-[#1b3a26]" />
                <div className="h-px bg-[#1b3a26]/20 my-1" />
                <SummaryRow label="Prod. (IST)" value={totals.istProd > 0 ? `${fmtNum(totals.istProd)} €` : "—"} color="text-[#1b3a26]" />
                <SummaryRow label="Prod. (REAL)" value={totals.realProd > 0 ? `${fmtNum(totals.realProd)} €` : "—"} color="text-[#1b3a26]" />
              </div>
            </div>

            <div className="xl:col-span-9">
              <div ref={tableWrapperRef} className="border border-border rounded-lg overflow-hidden shadow-sm" onKeyDown={handleTableKeyDown}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse" style={{ borderColor: COLORS.border }}>
                    <thead>
                      <tr className="text-white uppercase text-xs tracking-wider" style={{ backgroundColor: COLORS.green }}>
                        <th className="p-3 border border-border text-center font-bold w-24 rounded-tl-lg">Tag</th>
                        <th className="p-3 border border-border text-center w-28 cursor-pointer hover:bg-muted/50" onClick={() => handleCopyDown("bruttoUmsatz")}>Brutto Umsatz</th>
                        <th className="p-3 border border-border text-center w-28 bg-[#142e1e]">Netto Umsatz</th>
                        <th className="p-3 border border-border text-center w-24 cursor-pointer hover:bg-muted/50" onClick={() => handleCopyDown("geplanteProduktivitaetPct")}>Gepl. Prod. %</th>
                        <th className="p-3 border border-border text-center w-24 cursor-pointer hover:bg-muted/50 bg-[#142e1e]" onClick={() => handleCopyDown("produktiveStd")}>Produktive Std.</th>
                        <th className="p-3 border border-border text-center w-24 cursor-pointer hover:bg-muted/50" onClick={() => handleCopyDown("sfStd")}>SF</th>
                        <th className="p-3 border border-border text-center w-24 cursor-pointer hover:bg-muted/50" onClick={() => handleCopyDown("hmStd")}>HM</th>
                        <th className="p-3 border border-border text-center w-24 cursor-pointer hover:bg-muted/50" onClick={() => handleCopyDown("nzEuro")}>NZ Euro</th>
                        <th className="p-3 border border-border text-center w-24 cursor-pointer hover:bg-muted/50 rounded-tr-lg" onClick={() => handleCopyDown("extraStd")}>Extra Std. Unproduktiv</th>
                      </tr>
                    </thead>
                    <tbody>
                      {daysData.map((day, idx) => {
                        if (!day.exists) return null;
                        const produktiveVal = calcProduktiveStdForDay(day, koeffNum);
                        return (
                          <tr key={idx} style={{ backgroundColor: day.isHoliday ? "#fef2f2" : day.isWeekend ? "#f3f4f6" : "#ffffff" }}>
                            <td className={`p-1 px-3 border border-border text-xs font-bold whitespace-nowrap text-center ${day.isHoliday ? "text-red-600" : "text-gray-700"}`}>
                              {day.day}. {day.dayName} {day.isHoliday ? "*" : ""}
                            </td>
                            <td className="p-0.5 border border-border text-center align-middle">
                              <TableInput
                                val={day.bruttoUmsatz}
                                setVal={(v) => handleInputChange(idx, "bruttoUmsatz", v)}
                                type="euro"
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
                              />
                            </td>
                            <td className="p-1 border border-border text-center text-foreground font-mono text-xs font-bold bg-muted/50">
                              {produktiveVal ? fmtHours(produktiveVal) : "—"}
                            </td>
                            <td className="p-0.5 border border-border text-center align-middle"><TableInput val={day.sfStd} setVal={(v) => handleInputChange(idx, "sfStd", v)} type="hours" /></td>
                            <td className="p-0.5 border border-border text-center align-middle"><TableInput val={day.hmStd} setVal={(v) => handleInputChange(idx, "hmStd", v)} type="hours" /></td>
                            <td className="p-0.5 border border-border text-center align-middle"><TableInput val={day.nzEuro} setVal={(v) => handleInputChange(idx, "nzEuro", v)} type="euro" /></td>
                            <td className="p-0.5 border border-border text-center align-middle"><TableInput val={day.extraStd} setVal={(v) => handleInputChange(idx, "extraStd", v)} type="hours" /></td>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  decimals?: number;
}) => (
  <div className="flex justify-between items-center gap-3">
    <label className="text-xs font-bold text-gray-500 uppercase">{label}</label>
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v && !Number.isNaN(parseDEFlex(v))) onChange(fmtNum(parseDEFlex(v), decimals));
      }}
      className="w-24 p-1.5 border-2 border-border rounded text-right text-sm font-semibold text-gray-800 focus:outline-none focus:border-[#1b3a26] focus:ring-2 focus:ring-[#1b3a26] focus:ring-opacity-50 caret-[#1b3a26] selection:bg-[#ffc72c]/30"
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

const TableInput = ({ val, setVal, type }: { val: string; setVal: (v: string) => void; type?: "euro" | "hours" | "pct" }) => {
  const isHours = type === "hours" || type === "pct";
  const formatVal = (raw: string) => (isHours ? (parseDEFlex(raw) ? fmtHours(parseDEFlex(raw)) : "") : fmtNum(parseDEFlex(raw)));
  return (
    <input
      type="text"
      inputMode="decimal"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v !== "" && !Number.isNaN(parseDEFlex(v))) setVal(formatVal(v));
      }}
      className="w-full min-w-0 h-9 px-1.5 text-center text-sm font-medium text-gray-900 placeholder:text-gray-400 bg-white border border-border rounded focus:outline-none focus:border-[#1b3a26] focus:ring-2 focus:ring-[#1b3a26] focus:ring-inset focus:bg-[#fffbeb] caret-[#1b3a26] selection:bg-[#ffc72c]/40"
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
