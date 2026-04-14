"use client";

import Link from "next/link";
import { useState, useTransition, useMemo, useCallback, useEffect } from "react";
import {
  ArrowLeft,
  TrendingDown,
  TrendingUp,
  BarChart3,
  Table2,
  LayoutGrid,
  Download,
  RefreshCw,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  FileText,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { getClAnalyseData, type CLMonthRow, type RestaurantOption } from "@/app/actions/clAnalyseActions";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, Filler
);

/* ─────────────────────────────────────────────── Constants */

const GREEN = "#1a3826";
const GOLD = "#FFC72C";

const DE_MONTHS = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
const DE_MONTHS_FULL = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

const CHART_COLORS = ["#1a3826","#FFC72C","#2d6a4f","#f4a261","#264653","#e9c46a","#457b9d","#e76f51","#06b6d4","#a78bfa"];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

/* ─────────────────────────────────────────────── Formatters */

function fmtEuro(n: number, dec = 0) {
  return n.toLocaleString("de-AT", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtPct(n: number) {
  return n.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function sign(n: number) { return n >= 0 ? "+" : ""; }

/* ─────────────────────────────────────────────── PDF Export */

/**
 * Generates the PDF and returns a blob URL for in-page preview.
 * Caller is responsible for revoking the URL via URL.revokeObjectURL().
 */
async function exportPDF(
  rows: CLMonthRow[],
  kpis: { totalBudgetCL: number; totalActualCL: number; totalDiff: number; totalBudgetUmsatz: number; totalActualUmsatz: number },
  year: number,
  months: number[],
  restaurantNames: string[]
): Promise<string> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // ── Header
  doc.setFillColor(26, 56, 38);
  doc.rect(0, 0, W, 22, "F");
  doc.setFillColor(255, 199, 44);
  doc.rect(0, 22, W, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 199, 44);
  doc.text("CL ANALYSE", 10, 14);
  doc.setFontSize(9);
  doc.setTextColor(200, 230, 210);
  doc.text("Budget vs. Ist · Controlling · Finanzauswertung", 10, 20);
  doc.setTextColor(255, 255, 255);
  doc.text(`Jahr: ${year}`, W - 60, 10);
  doc.text(`Erstellt: ${new Date().toLocaleDateString("de-AT")}`, W - 60, 16);

  // ── Filter summary
  let y = 30;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`Restaurants: ${restaurantNames.join(", ")}`, 10, y);
  doc.text(`Monate: ${months.map((m) => DE_MONTHS[m - 1]).join(", ")}`, 10, y + 5);

  // ── KPI summary boxes — McDonald's colors (yellow bg + dark green text)
  y = 42;
  type RgbTriple = [number, number, number];
  const boxes: { label: string; value: string; bg: RgbTriple; fg: RgbTriple }[] = [
    { label: "Budget CL gesamt",    value: `${fmtEuro(kpis.totalBudgetCL)} €`,     bg: [255,199,44],  fg: [26,56,38] },
    { label: "Ist CL gesamt",       value: `${fmtEuro(kpis.totalActualCL)} €`,     bg: [255,199,44],  fg: [26,56,38] },
    { label: "Differenz (Bdg−Ist)", value: `${sign(kpis.totalDiff)}${fmtEuro(kpis.totalDiff)} €`,
      bg: kpis.totalDiff >= 0 ? [220,252,231] : [254,226,226],
      fg: kpis.totalDiff >= 0 ? [22,163,74]  : [220,38,38] },
    { label: "Budget Umsatz",       value: `${fmtEuro(kpis.totalBudgetUmsatz)} €`, bg: [26,56,38],    fg: [255,199,44] },
    { label: "Ist Umsatz",          value: `${fmtEuro(kpis.totalActualUmsatz)} €`, bg: [26,56,38],    fg: [255,199,44] },
  ];
  const bw = (W - 20) / boxes.length - 2;
  boxes.forEach((b, i) => {
    const bx = 10 + i * (bw + 2);
    doc.setFillColor(...b.bg);
    doc.roundedRect(bx, y, bw, 16, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...b.fg);
    doc.text(b.value, bx + bw / 2, y + 9, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...b.fg);
    doc.text(b.label, bx + bw / 2, y + 14, { align: "center" });
  });

  // ── Data table (no Δ PP column, all numbers centered)
  const head = [["Restaurant","Monat","Budget CL €","Ist CL €","Differenz €","Bdg CL %","Ist CL %","Bdg Ums. €","Ist Ums. €","Std."]];
  const body = rows.map((r) => [
    r.restaurantName,
    `${DE_MONTHS_FULL[r.month - 1]} ${r.year}`,
    fmtEuro(r.budgetCL),
    fmtEuro(r.actualCL),
    `${sign(r.diffCL)}${fmtEuro(r.diffCL)}`,
    `${fmtPct(r.budgetCLPct)} %`,
    `${fmtPct(r.actualCLPct)} %`,
    fmtEuro(r.budgetUmsatz),
    fmtEuro(r.actualUmsatz),
    `${r.actualGesamtStd.toFixed(1)} h`,
  ]);

  autoTable(doc, {
    head,
    body,
    startY: y + 22,
    styles: { fontSize: 8, cellPadding: 2.5, font: "helvetica", halign: "center", fontStyle: "bold" },
    headStyles: { fillColor: [26, 56, 38], textColor: [255, 199, 44], fontStyle: "bold", fontSize: 8, halign: "center" },
    alternateRowStyles: { fillColor: [248, 250, 248] },
    columnStyles: {
      0: { fontStyle: "bold", halign: "left" },   // Restaurant name — left aligned
      1: { halign: "left" },                       // Monat — left aligned
      2: { halign: "center" }, 3: { halign: "center" },
      4: { halign: "center", fontStyle: "bold" },  // Differenz
      5: { halign: "center" }, 6: { halign: "center" },
      7: { halign: "center" }, 8: { halign: "center" },
      // Last column (Std.) — bold black
      9: { halign: "center", fontStyle: "bold", textColor: [0, 0, 0] },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        const val = rows[data.row.index];
        if (!val) return;
        // Differenz column (index 4) — green/red
        if (data.column.index === 4) {
          data.cell.styles.textColor = val.diffCL >= 0 ? [22, 163, 74] : [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
        // Last column (Std., index 9) — bold black
        if (data.column.index === 9) {
          data.cell.styles.textColor = [0, 0, 0];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    foot: [[
      { content: "GESAMT", colSpan: 2, styles: { fontStyle: "bold", halign: "left", textColor: [0,0,0] as [number,number,number] } },
      { content: `${fmtEuro(kpis.totalBudgetCL)}`, styles: { fontStyle: "bold", halign: "center", textColor: [0,0,0] as [number,number,number] } },
      { content: `${fmtEuro(kpis.totalActualCL)}`, styles: { fontStyle: "bold", halign: "center", textColor: [0,0,0] as [number,number,number] } },
      { content: `${sign(kpis.totalDiff)}${fmtEuro(kpis.totalDiff)}`, styles: { fontStyle: "bold", halign: "center", textColor: (kpis.totalDiff >= 0 ? [22,163,74] : [220,38,38]) as [number,number,number] } },
      "", "", "", "", "",
    ]],
    footStyles: { fillColor: [255, 199, 44], textColor: [26, 56, 38], fontSize: 8, fontStyle: "bold" },
    margin: { left: 10, right: 10 },
  });

  // ── Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Seite ${p} / ${pages}`, W / 2, doc.internal.pageSize.getHeight() - 5, { align: "center" });
    doc.text("aiw services · CL Analyse", 10, doc.internal.pageSize.getHeight() - 5);
  }

  // Return blob URL for in-page preview popup
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}

/* ─────────────────────────────────────────────── CSV Export */

function exportCSV(rows: CLMonthRow[]) {
  const headers = ["Restaurant","Code","Jahr","Monat","Budget CL €","Ist CL €","Diff CL €","Diff CL %","Budget CL %","Ist CL %","Budget Umsatz €","Ist Umsatz €","Ist Std."];
  const lines = [
    headers.join(";"),
    ...rows.map((r) => [
      r.restaurantName, r.restaurantCode, r.year,
      DE_MONTHS_FULL[r.month - 1] ?? r.month,
      r.budgetCL.toFixed(2).replace(".",","), r.actualCL.toFixed(2).replace(".",","),
      r.diffCL.toFixed(2).replace(".",","), r.diffPct.toFixed(2).replace(".",","),
      r.budgetCLPct.toFixed(2).replace(".",","), r.actualCLPct.toFixed(2).replace(".",","),
      r.budgetUmsatz.toFixed(2).replace(".",","), r.actualUmsatz.toFixed(2).replace(".",","),
      r.actualGesamtStd.toFixed(2).replace(".",","),
    ].join(";")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cl-analyse-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────────────── Password Gate */

function PasswordGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/cl-analyse-unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pwd }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) setErr(data.error ?? "Falsches Passwort.");
        else onUnlocked();
      } catch { setErr("Netzwerkfehler."); }
    });
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="w-full bg-[#1a3826] px-4 pb-8 pt-4 sm:px-6 md:px-10">
        <Link href="/admin" className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-emerald-300/70 hover:text-[#FFC72C]">
          <ArrowLeft size={14} /> Zurück zur Verwaltung
        </Link>
        <div className="flex items-center gap-4 mt-2">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-2 ring-[#FFC72C]/30">
            <BarChart3 size={30} className="text-[#FFC72C]" />
          </span>
          <div>
            <h1 className="font-black uppercase tracking-tighter text-3xl sm:text-4xl">
              <span className="text-white">CL </span><span className="text-[#FFC72C]">ANALYSE</span>
            </h1>
            <p className="mt-1 text-sm font-medium text-emerald-100/80">Budget vs. Ist · Controlling · Finanzauswertung</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1a3826] text-[#FFC72C]">
              <Lock size={22} />
            </span>
            <div>
              <h2 className="text-base font-black text-foreground">Zugang gesichert</h2>
              <p className="text-sm text-muted-foreground">Bitte Passwort eingeben.</p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                autoComplete="off"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                className="w-full rounded-xl border-2 border-border bg-background px-4 py-3.5 pr-12 text-base font-medium outline-none transition focus:border-[#1a3826] focus:ring-2 focus:ring-[#FFC72C]/30"
                placeholder="Passwort"
              />
              <button type="button" onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {err && (
              <p className="flex items-center gap-2 text-sm font-semibold text-red-600">
                <AlertTriangle size={15} />{err}
              </p>
            )}
            <button type="submit" disabled={pending || !pwd.trim()}
              className="inline-flex w-full items-center justify-center rounded-xl px-5 py-3.5 text-sm font-black uppercase tracking-widest text-[#FFC72C] shadow-md transition hover:opacity-95 disabled:opacity-40"
              style={{ backgroundColor: GREEN }}>
              {pending ? "…" : "Zugang öffnen"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────── Hero Result Bar */

function HeroBar({
  budgetCL, actualCL, diffCL, budgetCLPct, actualCLPct, diffPct,
}: {
  budgetCL: number; actualCL: number; diffCL: number;
  budgetCLPct: number; actualCLPct: number; diffPct: number;
}) {
  const isGood = diffCL >= 0;
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      {/* thin brand accent on top */}
      <div className="h-[3px] w-full bg-[#1a3826]" />
      <div className="grid grid-cols-3 divide-x divide-slate-100">
        {/* Budget CL */}
        <div className="flex flex-col gap-1 px-6 py-5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Budget CL</span>
          <span className="text-2xl sm:text-3xl font-black tabular-nums text-slate-800 leading-none">{fmtEuro(budgetCL)} €</span>
          <span className="text-xs font-semibold text-slate-400">{fmtPct(budgetCLPct)} %</span>
        </div>
        {/* Ist CL */}
        <div className="flex flex-col gap-1 px-6 py-5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ist CL</span>
          <span className="text-2xl sm:text-3xl font-black tabular-nums text-slate-800 leading-none">{fmtEuro(actualCL)} €</span>
          <span className="text-xs font-semibold text-slate-400">{fmtPct(actualCLPct)} %</span>
        </div>
        {/* Differenz — the star */}
        <div className={`flex flex-col gap-1 px-6 py-5 ${isGood ? "bg-emerald-50" : "bg-red-50"}`}>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Differenz</span>
          <div className="flex items-center gap-2">
            {isGood
              ? <TrendingDown size={20} className="text-emerald-600 shrink-0" />
              : <TrendingUp size={20} className="text-red-600 shrink-0" />}
            <span className={`text-2xl sm:text-3xl font-black tabular-nums leading-none ${isGood ? "text-emerald-700" : "text-red-700"}`}>
              {sign(diffCL)}{fmtEuro(diffCL)} €
            </span>
          </div>
          <span className={`text-xs font-semibold ${isGood ? "text-emerald-600" : "text-red-600"}`}>
            {sign(diffPct)}{fmtPct(diffPct)} PP · {isGood ? "Einsparung" : "Über Budget"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────── KPI Card */

function KpiCard({
  label, value, sub, accent = "neutral",
}: {
  label: string; value: string; sub?: string;
  accent?: "good" | "bad" | "neutral";
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  trend?: "good" | "bad" | "neutral";
}) {
  const borderColor = accent === "good" ? "border-l-emerald-500"
    : accent === "bad" ? "border-l-red-500"
    : "border-l-[#1a3826]";
  const valueColor = accent === "good" ? "text-emerald-700"
    : accent === "bad" ? "text-red-700"
    : "text-slate-800";
  return (
    <div className={`flex flex-col gap-1.5 rounded-xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200 border-l-4 ${borderColor}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-xl font-black tabular-nums leading-tight ${valueColor}`}>{value}</p>
      {sub && <p className="text-[11px] font-semibold text-slate-400">{sub}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────── Sort header */

type SortKey = keyof CLMonthRow;
type SortDir = "asc" | "desc";

function ThSort({ col, label, sort, onSort, className = "" }: {
  col: SortKey; label: string; sort: { key: SortKey; dir: SortDir };
  onSort: (k: SortKey) => void; className?: string;
}) {
  const active = sort.key === col;
  return (
    <th className={`cursor-pointer select-none whitespace-nowrap px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground transition hover:text-foreground ${className}`}
      onClick={() => onSort(col)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (sort.dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronsUpDown size={11} className="opacity-30" />}
      </span>
    </th>
  );
}

/* ─────────────────────────────────────────────── Main export */

type Tab = "grafiken" | "tabelle" | "vergleich";

export default function CLAnalyseClient({ restaurants, locked }: { restaurants: RestaurantOption[]; locked: boolean }) {
  const [isLocked, setIsLocked] = useState(locked);
  if (isLocked) {
    return <PasswordGate onUnlocked={() => setIsLocked(false)} />;
  }
  return <CLAnalyseDashboard restaurants={restaurants} />;
}

function CLAnalyseDashboard({ restaurants }: { restaurants: RestaurantOption[] }) {
  /* ── Filters */
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>(restaurants.map((r) => r.id));
  const [selectedMonths, setSelectedMonths] = useState<number[]>(Array.from({ length: 12 }, (_, i) => i + 1));
  const [tab, setTab] = useState<Tab>("grafiken");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "month", dir: "asc" });
  const [pdfPending, setPdfPending] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  /* ── Data */
  const [rows, setRows] = useState<CLMonthRow[]>([]);
  const [loading, startTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (selectedRestaurants.length === 0) { setRows([]); return; }
    startTransition(async () => {
      const data = await getClAnalyseData(selectedRestaurants, [selectedYear]);
      setRows(data);
    });
  }, [selectedRestaurants, selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Filtered */
  const filteredRows = useMemo(() => rows.filter((r) => selectedMonths.includes(r.month)), [rows, selectedMonths]);

  /* ── KPIs */
  const kpis = useMemo(() => {
    const totalBudgetCL = filteredRows.reduce((s, r) => s + r.budgetCL, 0);
    const totalActualCL = filteredRows.reduce((s, r) => s + r.actualCL, 0);
    const totalDiff = totalBudgetCL - totalActualCL;
    const rowsWithData = filteredRows.filter((r) => r.hasData);
    const avgBudgetPct = rowsWithData.length > 0 ? rowsWithData.reduce((s, r) => s + r.budgetCLPct, 0) / rowsWithData.length : 0;
    const avgActualPct = rowsWithData.length > 0 ? rowsWithData.reduce((s, r) => s + r.actualCLPct, 0) / rowsWithData.length : 0;
    const diffPct = avgBudgetPct - avgActualPct;
    const totalBudgetUmsatz = filteredRows.reduce((s, r) => s + r.budgetUmsatz, 0);
    const totalActualUmsatz = filteredRows.reduce((s, r) => s + r.actualUmsatz, 0);
    return { totalBudgetCL, totalActualCL, totalDiff, avgBudgetPct, avgActualPct, diffPct, totalBudgetUmsatz, totalActualUmsatz };
  }, [filteredRows]);

  /* ── Restaurant selection: toggle on/off */
  function toggleRestaurantMulti(id: string) {
    setSelectedRestaurants((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  /* ── Month presets */
  function setMonthPreset(preset: "all" | "q1" | "q2" | "q3" | "q4") {
    const map = { all: [1,2,3,4,5,6,7,8,9,10,11,12], q1: [1,2,3], q2: [4,5,6], q3: [7,8,9], q4: [10,11,12] };
    setSelectedMonths(map[preset]);
  }
  function toggleMonth(m: number) {
    setSelectedMonths((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b));
  }

  /* ── Sort */
  function handleSort(key: SortKey) {
    setSort((prev) => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }
  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    arr.sort((a, b) => {
      const av = a[sort.key] as number | string;
      const bv = b[sort.key] as number | string;
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredRows, sort]);

  /* ── Chart labels */
  const chartLabels = selectedMonths.map((m) => DE_MONTHS[m - 1] ?? String(m));
  const activeRestaurants = restaurants.filter((r) => selectedRestaurants.includes(r.id));

  /* ── Chart A: Budget vs Ist grouped bar */
  const barChartData = useMemo(() => {
    const datasets: object[] = [];
    activeRestaurants.forEach((rest, ri) => {
      const color = CHART_COLORS[ri % CHART_COLORS.length] ?? GREEN;
      datasets.push({
        label: `${rest.name ?? rest.code} · Budget`,
        data: selectedMonths.map((m) => filteredRows.find((r) => r.restaurantId === rest.id && r.month === m)?.budgetCL ?? 0),
        backgroundColor: color + "44",
        borderColor: color + "88",
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      });
      datasets.push({
        label: `${rest.name ?? rest.code} · Ist`,
        data: selectedMonths.map((m) => filteredRows.find((r) => r.restaurantId === rest.id && r.month === m)?.actualCL ?? 0),
        backgroundColor: color + "cc",
        borderColor: color,
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      });
    });
    return { labels: chartLabels, datasets };
  }, [filteredRows, selectedMonths, activeRestaurants, chartLabels]);

  /* ── Chart B: CL % line */
  const lineChartData = useMemo(() => {
    const datasets: object[] = activeRestaurants.map((rest, ri) => {
      const color = CHART_COLORS[ri % CHART_COLORS.length] ?? GREEN;
      return {
        label: rest.name ?? rest.code,
        data: selectedMonths.map((m) => {
          const row = filteredRows.find((r) => r.restaurantId === rest.id && r.month === m);
          return row?.hasData ? parseFloat(row.actualCLPct.toFixed(2)) : null;
        }),
        borderColor: color,
        backgroundColor: color + "18",
        fill: false,
        tension: 0.35,
        pointRadius: 5,
        pointHoverRadius: 7,
        borderWidth: 2.5,
      };
    });
    // Budget reference line
    const rowsWithBudget = filteredRows.filter((r) => r.budgetCLPct > 0);
    if (rowsWithBudget.length > 0) {
      const avg = rowsWithBudget.reduce((s, r) => s + r.budgetCLPct, 0) / rowsWithBudget.length;
      datasets.push({
        label: "Ø Budget CL %",
        data: selectedMonths.map(() => parseFloat(avg.toFixed(2))),
        borderColor: GOLD,
        backgroundColor: "transparent",
        fill: false,
        tension: 0,
        pointRadius: 0,
        borderWidth: 2,
        borderDash: [6, 4],
      });
    }
    return { labels: chartLabels, datasets };
  }, [filteredRows, selectedMonths, activeRestaurants, chartLabels]);

  /* ── Chart C: Monthly savings/loss per restaurant (deviation) */
  const diffChartData = useMemo(() => {
    const labels: string[] = [];
    const data: number[] = [];
    const colors: string[] = [];
    activeRestaurants.forEach((rest) => {
      selectedMonths.forEach((m) => {
        const row = filteredRows.find((r) => r.restaurantId === rest.id && r.month === m);
        if (row?.hasData) {
          labels.push(activeRestaurants.length > 1 ? `${rest.name ?? rest.code} · ${DE_MONTHS[m - 1]}` : (DE_MONTHS_FULL[m - 1] ?? ""));
          data.push(parseFloat(row.diffCL.toFixed(2)));
          colors.push(row.diffCL >= 0 ? "#16a34a" : "#dc2626");
        }
      });
    });
    return {
      labels,
      datasets: [{
        label: "Budget − Ist CL (€)",
        data,
        backgroundColor: colors,
        borderRadius: 5,
        borderSkipped: false as const,
      }],
    };
  }, [filteredRows, selectedMonths, activeRestaurants]);

  /* ── Chart D: Cumulative savings per month */
  const cumulativeChartData = useMemo(() => {
    const datasets = activeRestaurants.map((rest, ri) => {
      const color = CHART_COLORS[ri % CHART_COLORS.length] ?? GREEN;
      let cum = 0;
      const data = selectedMonths.map((m) => {
        const row = filteredRows.find((r) => r.restaurantId === rest.id && r.month === m);
        if (row?.hasData) cum += row.diffCL;
        return row?.hasData ? parseFloat(cum.toFixed(2)) : null;
      });
      return {
        label: rest.name ?? rest.code,
        data,
        borderColor: color,
        backgroundColor: color + "15",
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        borderWidth: 2.5,
      };
    });
    return { labels: chartLabels, datasets };
  }, [filteredRows, selectedMonths, activeRestaurants, chartLabels]);

  /* ── Chart options */
  const barOpts: ChartOptions<"bar"> = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmtEuro(c.parsed.y)} €` } },
    },
    scales: {
      y: { ticks: { callback: (v) => `${fmtEuro(Number(v))} €`, font: { size: 10 } }, grid: { color: "#e2e8f050" } },
      x: { ticks: { font: { size: 11 } } },
    },
  };
  const lineOpts: ChartOptions<"line"> = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y !== null ? fmtPct(c.parsed.y) + " %" : "–"}` } },
    },
    scales: {
      y: { ticks: { callback: (v) => `${Number(v).toFixed(1)} %`, font: { size: 10 } }, grid: { color: "#e2e8f050" } },
      x: { ticks: { font: { size: 11 } } },
    },
  };
  const horizOpts: ChartOptions<"bar"> = {
    indexAxis: "y", responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => { const v = c.parsed.x; return ` ${v >= 0 ? "Einsparung" : "Überschreitung"}: ${fmtEuro(Math.abs(v))} €`; } } },
    },
    scales: {
      x: { ticks: { callback: (v) => `${fmtEuro(Number(v))} €`, font: { size: 10 } }, grid: { color: "#e2e8f050" } },
      y: { ticks: { font: { size: 10 } } },
    },
  };
  const cumulativeOpts: ChartOptions<"line"> = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y !== null ? sign(c.parsed.y) + fmtEuro(c.parsed.y) + " €" : "–"}` } },
    },
    scales: {
      y: {
        ticks: { callback: (v) => `${sign(Number(v))}${fmtEuro(Number(v))} €`, font: { size: 10 } },
        grid: { color: "#e2e8f050" },
      },
      x: { ticks: { font: { size: 11 } } },
    },
  };

  /* ── Vergleich per restaurant */
  const restaurantSummaries = useMemo(() => {
    return activeRestaurants.map((rest) => {
      const rRows = filteredRows.filter((r) => r.restaurantId === rest.id);
      const rWithData = rRows.filter((r) => r.hasData);
      const totalBudget = rRows.reduce((s, r) => s + r.budgetCL, 0);
      const totalActual = rRows.reduce((s, r) => s + r.actualCL, 0);
      const totalDiff = totalBudget - totalActual;
      const avgActualPct = rWithData.length > 0 ? rWithData.reduce((s, r) => s + r.actualCLPct, 0) / rWithData.length : 0;
      const avgBudgetPct = rWithData.length > 0 ? rWithData.reduce((s, r) => s + r.budgetCLPct, 0) / rWithData.length : 0;
      return { rest, rRows, totalBudget, totalActual, totalDiff, avgActualPct, avgBudgetPct };
    });
  }, [filteredRows, activeRestaurants]);

  /* ─── PDF handler — opens popup preview */
  async function handlePDF() {
    setPdfPending(true);
    try {
      const url = await exportPDF(
        sortedRows,
        kpis,
        selectedYear,
        selectedMonths,
        activeRestaurants.map((r) => r.name ?? r.code)
      );
      setPdfBlobUrl(url);
    } finally {
      setPdfPending(false);
    }
  }

  function closePdfModal() {
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    setPdfBlobUrl(null);
  }

  /* ─────────────────────────────────────────────── RENDER */

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">

      <div className="mx-auto max-w-[1400px] space-y-5 p-4 md:p-6 lg:p-8">

        {/* ── Page header — same pattern as admin panel */}
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
          <div>
            <Link href="/admin" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-[#1a3826] transition">
              <ArrowLeft size={13} /> Zurück zur Verwaltung
            </Link>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-[#1a3826] dark:text-[#FFC72C]">
              CL <span className="text-[#FFC72C] dark:text-white">ANALYSE</span>
            </h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Budget vs. Ist · Controlling · Finanzauswertung
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={fetchData} disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground transition hover:bg-accent disabled:opacity-50">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Aktualisieren
            </button>
            <button type="button" onClick={() => exportCSV(sortedRows)} disabled={filteredRows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground transition hover:bg-accent disabled:opacity-40">
              <Download size={13} /> CSV
            </button>
            <button type="button" onClick={handlePDF} disabled={filteredRows.length === 0 || pdfPending}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FFC72C] px-4 py-2 text-xs font-bold text-[#1a3826] transition hover:opacity-90 disabled:opacity-40">
              <FileText size={13} />
              {pdfPending ? "Erstelle…" : "PDF Export"}
            </button>
          </div>
        </div>

        {/* ── Filter bar */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 space-y-4">
          {/* Row 1: Jahr + Monate */}
          <div className="flex flex-wrap gap-6">
            {/* Jahr */}
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Jahr</p>
              <div className="flex gap-1.5">
                {YEAR_OPTIONS.map((y) => (
                  <button key={y} type="button" onClick={() => setSelectedYear(y)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      selectedYear === y ? "bg-[#1a3826] text-[#FFC72C]" : "border border-slate-200 bg-slate-50 text-slate-500 hover:border-[#1a3826]/40 hover:text-slate-800"
                    }`}>
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {/* Monate */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monate</p>
                <button type="button"
                  onClick={() => setMonthPreset("all")}
                  className="rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                  Alle
                </button>
                <button type="button"
                  onClick={() => setSelectedMonths([])}
                  className="rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                  Keine
                </button>
                <div className="flex gap-1">
                  {(["Q1","Q2","Q3","Q4"] as const).map((q) => (
                    <button key={q} type="button"
                      onClick={() => setMonthPreset(q.toLowerCase() as "q1"|"q2"|"q3"|"q4")}
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <button key={m} type="button" onClick={() => toggleMonth(m)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                      selectedMonths.includes(m)
                        ? "bg-[#FFC72C] text-[#1a3826] font-black"
                        : "border border-slate-200 bg-slate-50 text-slate-500 hover:border-[#FFC72C]/60 hover:text-slate-800"
                    }`}>
                    {DE_MONTHS[m - 1]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Restaurants */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Restaurants</p>
              <button type="button"
                onClick={() => setSelectedRestaurants(restaurants.map((r) => r.id))}
                className="rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                Alle
              </button>
              <button type="button"
                onClick={() => setSelectedRestaurants([])}
                className="rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                Keine
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...restaurants].sort((a, b) => {
                const na = parseInt(a.code ?? a.name ?? "0", 10);
                const nb = parseInt(b.code ?? b.name ?? "0", 10);
                return (isNaN(na) ? 999 : na) - (isNaN(nb) ? 999 : nb);
              }).map((r) => {
                const selected = selectedRestaurants.includes(r.id);
                const label = r.name && r.name !== r.code ? r.name : r.code;
                return (
                  <button key={r.id} type="button"
                    onClick={() => toggleRestaurantMulti(r.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      selected
                        ? "bg-[#1a3826] text-[#FFC72C]"
                        : "border border-slate-200 bg-slate-50 text-slate-500 hover:border-[#1a3826]/40 hover:text-slate-800"
                    }`}>
                    {selected && <CheckCircle2 size={11} />}
                    {label}
                  </button>
                );
              })}
            </div>
            {selectedRestaurants.length > 0 && (
              <p className="mt-1.5 text-[10px] text-slate-400">
                {selectedRestaurants.length === restaurants.length
                  ? "Alle Restaurants ausgewählt"
                  : `${selectedRestaurants.length} von ${restaurants.length} ausgewählt`}
              </p>
            )}
          </div>
        </div>

        {/* ── Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[1,2,3,4].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-200" />)}
            </div>
          </div>
        )}

        {/* ── Empty */}
        {!loading && filteredRows.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
            <BarChart3 className="mb-4 h-12 w-12 text-slate-300" />
            <p className="text-sm font-semibold text-slate-500">Keine Daten für die gewählten Filter.</p>
            <p className="mt-1 text-xs text-slate-400">Bitte mindestens ein Restaurant und einen Monat auswählen.</p>
          </div>
        )}

        {!loading && filteredRows.length > 0 && (
          <>
            {/* ── Hero bar */}
            <HeroBar
              budgetCL={kpis.totalBudgetCL}
              actualCL={kpis.totalActualCL}
              diffCL={kpis.totalDiff}
              budgetCLPct={kpis.avgBudgetPct}
              actualCLPct={kpis.avgActualPct}
              diffPct={kpis.diffPct}
            />

            {/* ── KPI cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard label="Budget Umsatz" value={`${fmtEuro(kpis.totalBudgetUmsatz)} €`} accent="neutral" />
              <KpiCard label="Ist Umsatz" value={`${fmtEuro(kpis.totalActualUmsatz)} €`}
                sub={kpis.totalActualUmsatz >= kpis.totalBudgetUmsatz ? "Über Budget" : "Unter Budget"}
                accent={kpis.totalActualUmsatz >= kpis.totalBudgetUmsatz ? "good" : "neutral"}
              />
              <KpiCard label="Ø Budget CL %" value={`${fmtPct(kpis.avgBudgetPct)} %`} accent="neutral" />
              <KpiCard label="Ø Ist CL %"
                value={`${fmtPct(kpis.avgActualPct)} %`}
                sub={kpis.avgActualPct <= kpis.avgBudgetPct
                  ? `${sign(kpis.diffPct)}${fmtPct(kpis.diffPct)} PP vs. Budget`
                  : `${sign(kpis.diffPct)}${fmtPct(kpis.diffPct)} PP über Budget`}
                accent={kpis.avgActualPct <= kpis.avgBudgetPct ? "good" : "bad"}
              />
            </div>

            {/* ── Tabs */}
            <div className="flex items-center gap-1 rounded-xl bg-white p-1 w-fit shadow-sm ring-1 ring-slate-200">
              {([
                { id: "grafiken", label: "Grafiken", icon: BarChart3 },
                { id: "tabelle", label: "Tabelle", icon: Table2 },
                { id: "vergleich", label: "Vergleich", icon: LayoutGrid },
              ] as { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[]).map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setTab(id)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
                    tab === id ? "bg-[#1a3826] text-[#FFC72C] shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}>
                  <Icon size={13} />{label}
                </button>
              ))}
            </div>

            {/* ══════ GRAFIKEN ══════ */}
            {tab === "grafiken" && (
              <div className="space-y-4">
                {/* Graf 1 */}
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-slate-800">Budget vs. Ist CL</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Monatlicher Vergleich in €</p>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#1a3826]/30" />Budget</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#1a3826]" />Ist</span>
                    </div>
                  </div>
                  <div className="h-[300px]"><Bar data={barChartData} options={barOpts} /></div>
                </div>

                {/* Graf 2 */}
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="mb-4">
                    <h2 className="text-sm font-bold text-slate-800">CL % Entwicklung</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Ist CL % pro Monat — gestrichelt: Ø Budget</p>
                  </div>
                  <div className="h-[260px]"><Line data={lineChartData} options={lineOpts} /></div>
                </div>
              </div>
            )}

            {/* ══════ TABELLE ══════ */}
            {tab === "tabelle" && (
              <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
                  <h2 className="text-sm font-bold text-slate-800">
                    Detailtabelle
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      {sortedRows.length} Zeilen
                    </span>
                  </h2>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => exportCSV(sortedRows)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-black text-foreground transition hover:bg-accent">
                      <Download size={13} /> CSV
                    </button>
                    <button type="button" onClick={handlePDF} disabled={pdfPending}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#1a3826] px-3 py-1.5 text-xs font-black text-[#FFC72C] transition hover:opacity-90 disabled:opacity-40">
                      <FileText size={13} /> {pdfPending ? "…" : "PDF"}
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <ThSort col="restaurantName" label="Restaurant" sort={sort} onSort={handleSort} />
                        <ThSort col="month" label="Monat" sort={sort} onSort={handleSort} />
                        <ThSort col="budgetCL" label="Budget CL €" sort={sort} onSort={handleSort} className="text-right" />
                        <ThSort col="actualCL" label="Ist CL €" sort={sort} onSort={handleSort} className="text-right" />
                        <ThSort col="diffCL" label="Differenz €" sort={sort} onSort={handleSort} className="text-right" />
                        <ThSort col="budgetCLPct" label="Bdg CL %" sort={sort} onSort={handleSort} className="text-right" />
                        <ThSort col="actualCLPct" label="Ist CL %" sort={sort} onSort={handleSort} className="text-right" />
                        <ThSort col="diffPct" label="Δ PP" sort={sort} onSort={handleSort} className="text-right" />
                        <ThSort col="budgetUmsatz" label="Bdg Ums." sort={sort} onSort={handleSort} className="text-right" />
                        <ThSort col="actualUmsatz" label="Ist Ums." sort={sort} onSort={handleSort} className="text-right" />
                        <ThSort col="actualGesamtStd" label="Std." sort={sort} onSort={handleSort} className="text-right" />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.map((r, i) => {
                        const good = r.diffCL >= 0;
                        return (
                          <tr key={`${r.restaurantId}-${r.year}-${r.month}`}
                            className={`border-b border-border transition-colors hover:bg-muted/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                            <td className="px-3 py-2.5 font-semibold text-foreground">{r.restaurantName}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{DE_MONTHS_FULL[r.month - 1]} {r.year}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{fmtEuro(r.budgetCL)} €</td>
                            <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${good ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                              {fmtEuro(r.actualCL)} €
                            </td>
                            <td className={`px-3 py-2.5 text-right tabular-nums font-black ${good ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                              <span className="inline-flex items-center gap-1">
                                {good ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                                {sign(r.diffCL)}{fmtEuro(r.diffCL)} €
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmtPct(r.budgetCLPct)} %</td>
                            <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${r.actualCLPct <= r.budgetCLPct ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                              {fmtPct(r.actualCLPct)} %
                            </td>
                            <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${r.diffPct >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                              {sign(r.diffPct)}{fmtPct(r.diffPct)} PP
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmtEuro(r.budgetUmsatz)} €</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{fmtEuro(r.actualUmsatz)} €</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{r.actualGesamtStd.toFixed(1)} h</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {sortedRows.length > 1 && (
                      <tfoot>
                        <tr className="border-t-2 border-border bg-[#1a3826]/5 dark:bg-[#FFC72C]/5">
                          <td className="px-3 py-2.5 text-xs font-black uppercase text-foreground" colSpan={2}>GESAMT</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-black">{fmtEuro(kpis.totalBudgetCL)} €</td>
                          <td className={`px-3 py-2.5 text-right tabular-nums font-black ${kpis.totalActualCL <= kpis.totalBudgetCL ? "text-emerald-700" : "text-red-600"}`}>
                            {fmtEuro(kpis.totalActualCL)} €
                          </td>
                          <td className={`px-3 py-2.5 text-right tabular-nums font-black ${kpis.totalDiff >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {sign(kpis.totalDiff)}{fmtEuro(kpis.totalDiff)} €
                          </td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground font-black">{fmtPct(kpis.avgBudgetPct)} %</td>
                          <td className={`px-3 py-2.5 text-right tabular-nums font-black ${kpis.avgActualPct <= kpis.avgBudgetPct ? "text-emerald-700" : "text-red-600"}`}>
                            {fmtPct(kpis.avgActualPct)} %
                          </td>
                          <td className={`px-3 py-2.5 text-right tabular-nums font-black ${kpis.diffPct >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {sign(kpis.diffPct)}{fmtPct(kpis.diffPct)} PP
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-black">{fmtEuro(kpis.totalBudgetUmsatz)} €</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-black">{fmtEuro(kpis.totalActualUmsatz)} €</td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">–</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* ══════ VERGLEICH ══════ */}
            {tab === "vergleich" && (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {restaurantSummaries.map(({ rest, rRows, totalBudget, totalActual, totalDiff, avgActualPct, avgBudgetPct }) => {
                  const isGood = totalDiff >= 0;
                  const miniData = {
                    labels: selectedMonths.map((m) => DE_MONTHS[m - 1] ?? String(m)),
                    datasets: [
                      { label: "Budget", data: selectedMonths.map((m) => rRows.find((r) => r.month === m)?.budgetCL ?? 0), backgroundColor: "#1a382655", borderRadius: 3, borderSkipped: false as const },
                      { label: "Ist", data: selectedMonths.map((m) => rRows.find((r) => r.month === m)?.actualCL ?? 0), backgroundColor: "#1a3826cc", borderRadius: 3, borderSkipped: false as const },
                    ],
                  };
                  const miniOpts: ChartOptions<"bar"> = {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { enabled: true } },
                    scales: {
                      y: { ticks: { font: { size: 9 }, callback: (v) => `${fmtEuro(Number(v))}` }, grid: { color: "#e2e8f050" } },
                      x: { ticks: { font: { size: 9 } } },
                    },
                  };
                  return (
                    <div key={rest.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                      {/* Header: 4px accent left + restaurant name */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-8 w-1 shrink-0 rounded-full ${isGood ? "bg-emerald-500" : "bg-red-500"}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 leading-tight truncate">
                              {rest.name && rest.name !== rest.code ? rest.name : rest.code}
                            </p>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{rest.code}</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold shrink-0 ${
                          isGood ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        }`}>
                          {isGood ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                          {isGood ? "Einsparung" : "Überschreitung"}
                        </span>
                      </div>

                      <div className="p-4 space-y-3">
                        {/* 3 key metrics inline */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-lg bg-slate-50 px-2 py-2.5 text-center">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Budget CL</p>
                            <p className="text-sm font-bold tabular-nums text-slate-700">{fmtEuro(totalBudget)} €</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-2 py-2.5 text-center">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Ist CL</p>
                            <p className="text-sm font-bold tabular-nums text-slate-700">{fmtEuro(totalActual)} €</p>
                          </div>
                          <div className={`rounded-lg px-2 py-2.5 text-center ${isGood ? "bg-emerald-50" : "bg-red-50"}`}>
                            <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${isGood ? "text-emerald-600" : "text-red-600"}`}>Differenz</p>
                            <p className={`text-sm font-bold tabular-nums ${isGood ? "text-emerald-700" : "text-red-700"}`}>
                              {sign(totalDiff)}{fmtEuro(totalDiff)} €
                            </p>
                          </div>
                        </div>

                        {/* CL % row */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-slate-50 px-3 py-2.5 flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Budget CL %</p>
                            <p className="text-sm font-bold tabular-nums text-slate-700">{fmtPct(avgBudgetPct)} %</p>
                          </div>
                          <div className={`rounded-lg px-3 py-2.5 flex items-center justify-between ${avgActualPct <= avgBudgetPct ? "bg-emerald-50" : "bg-red-50"}`}>
                            <p className={`text-[10px] font-bold uppercase tracking-widest ${avgActualPct <= avgBudgetPct ? "text-emerald-600" : "text-red-600"}`}>Ist CL %</p>
                            <p className={`text-sm font-bold tabular-nums ${avgActualPct <= avgBudgetPct ? "text-emerald-700" : "text-red-700"}`}>
                              {fmtPct(avgActualPct)} %
                            </p>
                          </div>
                        </div>

                        {/* Mini chart */}
                        <div className="h-24"><Bar data={miniData} options={miniOpts} /></div>

                        {/* Month breakdown */}
                        <div className="space-y-px max-h-44 overflow-y-auto rounded-lg overflow-hidden">
                          {rRows.filter((r) => selectedMonths.includes(r.month)).sort((a, b) => a.month - b.month).map((r, i) => (
                            <div key={r.month} className={`flex items-center justify-between px-3 py-2 text-[11px] ${i % 2 === 0 ? "bg-slate-50" : "bg-white"}`}>
                              <span className="font-semibold text-slate-600 w-20">{DE_MONTHS_FULL[r.month - 1]}</span>
                              <span className="font-semibold text-slate-500 tabular-nums">{fmtEuro(r.actualCL)} €</span>
                              <span className={`font-bold tabular-nums w-20 text-right ${r.diffCL >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                                {sign(r.diffCL)}{fmtEuro(r.diffCL)} €
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── PDF Preview Modal */}
      {pdfBlobUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closePdfModal(); }}
        >
          <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
            style={{ height: "90vh" }}>
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-[#1a3826] px-5 py-3">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-[#FFC72C]" />
                <span className="text-sm font-black text-white">CL Analyse · PDF Vorschau</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={pdfBlobUrl}
                  download={`cl-analyse-${selectedYear}-${new Date().toISOString().slice(0, 10)}.pdf`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#FFC72C] px-4 py-2 text-xs font-black text-[#1a3826] transition hover:opacity-90"
                >
                  <Download size={13} /> Herunterladen
                </a>
                <button type="button" onClick={closePdfModal}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 text-white transition hover:bg-white/20">
                  ✕
                </button>
              </div>
            </div>
            <iframe src={pdfBlobUrl} title="CL Analyse PDF" className="h-full w-full flex-1 border-0" />
          </div>
        </div>
      )}
    </div>
  );
}
