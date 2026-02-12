"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

// --- TIPOVI ---

interface DayData {
  day: number;
  dayName: string;
  isWeekend: boolean;
  isHoliday: boolean;
  exists: boolean;
  umsatz: string;
  prod: string;
  sfStd: string;
  hmStd: string;
  nz: string;
  extra: string;
}

interface SavedRow {
  umsatz?: string;
  prod?: string;
  sfStd?: string;
  hmStd?: string;
  nz?: string;
  extra?: string;
}

interface SavedInputs {
  avgWage?: string;
  vacationStd?: string;
  sickStd?: string;
  extraUnprodStd?: string;
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

interface Holiday {
  d: number;
  m: number;
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

const fmtNum = (n: number, dec: number = 2): string => {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(n || 0);
};

const getEasterDate = (year: number): Holiday => {
  const f = Math.floor, a = year % 19, b = f(year / 100), c = year % 100, d = f(b / 4), e = b % 4, g = f((8 * b + 13) / 25), h = (19 * a + b - d - g + 15) % 30, i = f(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = f((a + 11 * h + 22 * l) / 451), n = h + l - 7 * m + 114, month = f(n / 31), day = 1 + (n % 31);
  return { d: day, m: month };
};

const getHolidaysForYear = (year: number): Holiday[] => {
  const holidays: Holiday[] = [];
  holidays.push({ d: 1, m: 1 }); holidays.push({ d: 2, m: 1 }); holidays.push({ d: 1, m: 3 });
  holidays.push({ d: 1, m: 5 }); holidays.push({ d: 2, m: 5 }); holidays.push({ d: 25, m: 11 });
  const easter = getEasterDate(year);
  const addDays = (h: Holiday, days: number): Holiday => {
    const date = new Date(year, h.m - 1, h.d);
    date.setDate(date.getDate() + days);
    return { d: date.getDate(), m: date.getMonth() + 1 };
  };
  holidays.push(addDays(easter, 1));
  holidays.push(addDays(easter, 60));
  holidays.push({ d: 25, m: 12 }); holidays.push({ d: 26, m: 12 });
  return holidays;
};

// --- GLAVNA KOMPONENTA ---
function LaborPlannerContent({ defaultRestaurantId }: { defaultRestaurantId?: string | null }) {
  const [loading, setLoading] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

  const searchParams = useSearchParams();
  const router = useRouter();
  const urlRestaurantId = searchParams.get("restaurantId");

  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(urlRestaurantId || defaultRestaurantId || "");

  const [avgWage, setAvgWage] = useState("");
  const [vacationStd, setVacationStd] = useState("");
  const [sickStd, setSickStd] = useState("");
  const [extraUnprodStd, setExtraUnprodStd] = useState("");
  const [taxAustria, setTaxAustria] = useState("");
  const [budgetUmsatz, setBudgetUmsatz] = useState("");
  const [budgetCL, setBudgetCL] = useState("");
  const [budgetCLPct, setBudgetCLPct] = useState("");

  const [daysData, setDaysData] = useState<DayData[]>([]);
  const [isExporting, setIsExporting] = useState(false);

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
    if (!defaultRestaurantId) return;
    if (defaultRestaurantId !== selectedRestaurantId) {
      setSelectedRestaurantId(defaultRestaurantId);
      const next = new URLSearchParams(searchParams.toString());
      next.set("restaurantId", defaultRestaurantId);
      router.replace(`?${next.toString()}`, { scroll: false });
    }
  }, [defaultRestaurantId]); // Namjerno bez selectedRestaurantId – reagiraj samo na promjenu iz headera (cookie)

  // Sinkronizacija s URL-om samo kad URL i cookie (header) se podudaraju – npr. direktan link ili prvi load
  useEffect(() => {
    if (urlRestaurantId && urlRestaurantId === defaultRestaurantId && urlRestaurantId !== selectedRestaurantId) {
      setSelectedRestaurantId(urlRestaurantId);
    }
  }, [urlRestaurantId, selectedRestaurantId, defaultRestaurantId]);

  // Dani u mjesecu – kratice na njemačkom (Mo, Di, …)
  const generateEmptyDays = useCallback((m: number, y: number, savedRows: SavedRow[] = []) => {
    const daysInMonth = new Date(y, m, 0).getDate();
    const currentHolidays = getHolidaysForYear(y);
    const newDays: DayData[] = [];

    for (let i = 1; i <= 31; i++) {
      const date = new Date(y, m - 1, i);
      const dayName = date.toLocaleDateString("de-AT", { weekday: "short" });

      const isWeekend = dayName === "Sa" || dayName === "So";
      const isHoliday = currentHolidays.some((h) => h.d === i && h.m === m);
      const exists = i <= daysInMonth;
      const saved = savedRows[i - 1] || {};

      newDays.push({
        day: i,
        dayName,
        isWeekend,
        isHoliday,
        exists,
        umsatz: saved.umsatz || "",
        prod: saved.prod || "",
        sfStd: saved.sfStd || "",
        hmStd: saved.hmStd || "",
        nz: saved.nz || "",
        extra: saved.extra || "",
      });
    }
    setDaysData(newDays);
  }, []);

  const clearInputs = () => {
    setAvgWage(""); setVacationStd(""); setSickStd(""); setExtraUnprodStd(""); setTaxAustria("");
    setBudgetUmsatz(""); setBudgetCL(""); setBudgetCLPct("");
  };

  const loadDataFromDB = useCallback(
    async (m: number, y: number, rId: string) => {
      if (!rId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/labor-planner?year=${y}&month=${m}&restaurant=${rId}`);
        const json = await res.json();

        if (json.success && json.data) {
          const parsed: LaborPlanData = json.data;
          if (parsed.inputs) {
            setAvgWage(parsed.inputs.avgWage || "");
            setVacationStd(parsed.inputs.vacationStd || "");
            setSickStd(parsed.inputs.sickStd || "");
            setExtraUnprodStd(parsed.inputs.extraUnprodStd || "");
            setTaxAustria(parsed.inputs.taxAustria || "");
            setBudgetUmsatz(parsed.inputs.budgetUmsatz || "");
            setBudgetCL(parsed.inputs.budgetCL || "");
            setBudgetCLPct(parsed.inputs.budgetCLPct || "");
          }
          if (parsed.rows && Array.isArray(parsed.rows)) {
            generateEmptyDays(m, y, parsed.rows);
          } else {
            generateEmptyDays(m, y, []);
          }
        } else {
          clearInputs();
          generateEmptyDays(m, y, []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [generateEmptyDays]
  );

  useEffect(() => {
    if (selectedRestaurantId) {
      loadDataFromDB(month, year, selectedRestaurantId);
    }
  }, [month, year, selectedRestaurantId, loadDataFromDB]);

  const totals = (() => {
    let sumUmsatz = 0, sumProdStd = 0, sumSF = 0, sumHM = 0, sumNZ = 0, sumExtra = 0;

    daysData.forEach((d) => {
      if (!d.exists) return;
      const u = parseDE(d.umsatz);
      const p = parseDE(d.prod);
      const sf = parseDE(d.sfStd);

      sumUmsatz += u;
      sumHM += parseDE(d.hmStd);
      sumNZ += parseDE(d.nz);
      sumExtra += parseDE(d.extra);
      sumSF += sf;

      if (u > 0 && p > 0) {
        let tmp = u / p - sf;
        if (tmp < 0) tmp = 0;
        sumProdStd += tmp;
      }
    });

    const valUrlaub = parseDE(vacationStd);
    const valKrank = parseDE(sickStd);
    const valZusatz = parseDE(extraUnprodStd);
    const valWage = parseDE(avgWage);
    const valTax = parseDE(taxAustria);

    const totalHours = sumProdStd + sumHM + sumExtra + valUrlaub + valKrank + valZusatz;
    const clEuroRaw = (valWage > 0 && (totalHours > 0 || sumNZ > 0)) ? (totalHours * valWage) + sumNZ : 0;
    const clEuro = Math.max(0, clEuroRaw - valTax);
    const clPct = (sumUmsatz > 0 && clEuro > 0) ? (clEuro / sumUmsatz) * 100 : 0;
    const istProd = (sumProdStd + sumExtra) > 0 ? sumUmsatz / (sumProdStd + sumExtra) : 0;
    const realProd = totalHours > 0 ? sumUmsatz / totalHours : 0;
    const budgetCLVal = parseDE(budgetCL);

    return { sumUmsatz, sumProdStd, sumSF, sumHM, sumNZ, sumExtra, totalHours, clEuro, clPct, istProd, realProd, budgetCLVal };
  })();

  const saveDataToDB = async () => {
    if (!selectedRestaurantId) {
      toast.error("Bitte Restaurant auswählen.");
      return;
    }
    setLoading(true);

    const dataToSave: LaborPlanData = {
      inputs: { avgWage, vacationStd, sickStd, extraUnprodStd, taxAustria, budgetUmsatz, budgetCL, budgetCLPct },
      rows: daysData.map((d) => ({
        umsatz: d.umsatz,
        prod: d.prod,
        sfStd: d.sfStd,
        hmStd: d.hmStd,
        nz: d.nz,
        extra: d.extra,
      })),
    };

    try {
      const res = await fetch("/api/labor-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, restaurant: selectedRestaurantId, data: dataToSave }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Erfolgreich gespeichert!");
      } else {
        toast.error(json?.error || "Fehler beim Speichern.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Fehler beim Speichern.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrintSingle = () => {
    if (!selectedRestaurantId) {
      toast.error("Bitte Restaurant auswählen.");
      return;
    }
    setIsExporting(true);

    const doc = new jsPDF("p", "mm", "a4");
    const selectedRest = restaurants.find((r) => r.id === selectedRestaurantId);

    const tableBody = daysData.filter((d) => d.exists).map((d) => {
      const u = parseDE(d.umsatz);
      const p = parseDE(d.prod);
      const sf = parseDE(d.sfStd);
      let prodStd = 0;
      if (u > 0 && p > 0) prodStd = Math.max(0, u / p - sf);

      let dayLabel = `${d.day}. ${d.dayName}`;
      if (d.isHoliday) dayLabel += " *";

      return [
        dayLabel,
        d.umsatz || "",
        d.prod || "",
        prodStd > 0 ? fmtNum(prodStd) : "-",
        d.sfStd || "",
        d.hmStd || "",
        d.nz || "",
        d.extra || "",
      ];
    });

    const totalRow = [
      "Gesamt",
      fmtNum(totals.sumUmsatz),
      "-",
      fmtNum(totals.sumProdStd),
      fmtNum(totals.sumSF),
      fmtNum(totals.sumHM),
      fmtNum(totals.sumNZ),
      fmtNum(totals.sumExtra),
    ];

    doc.setFillColor(27, 58, 38);
    doc.rect(0, 0, 210, 25, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("AIW Services", 14, 15);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Personaleinsatzplanung", 14, 20);
    doc.text(`${selectedRest?.code || ""} | ${MONTH_NAMES_DE[month - 1]} ${year}`, 196, 15, { align: "right" });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    const yPos = 32;
    doc.text(`Stundensatz: ${avgWage || "-"} €`, 14, yPos);
    doc.text(`Urlaub: ${vacationStd || "-"} h`, 50, yPos);
    doc.text(`Krank: ${sickStd || "-"} h`, 80, yPos);
    doc.text(`Tax: ${taxAustria || "-"} €`, 110, yPos);

    doc.setFillColor(255, 199, 44);
    doc.roundedRect(145, 27, 50, 12, 2, 2, "F");
    doc.setTextColor(27, 58, 38);
    doc.setFontSize(7);
    doc.text("CL-Schätzung", 148, 31);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${fmtNum(totals.clEuro)} €`, 148, 36);

    autoTable(doc, {
      startY: 45,
      head: [["Tag", "Umsatz", "Prod(€)", "P.Std", "SF", "HM", "Nacht €", "Extra"]],
      body: [...tableBody, totalRow],
      theme: "grid",
      headStyles: { fillColor: [27, 58, 38], textColor: 255, fontSize: 7, halign: "center", fontStyle: "bold", cellPadding: 1.5 },
      footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold", fontSize: 7, cellPadding: 1.5 },
      styles: { fontSize: 7, cellPadding: 1.5, lineColor: [220, 220, 220], lineWidth: 0.1, valign: "middle", halign: "center", font: "helvetica" },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 18, halign: "left" },
        1: { halign: "right" },
        2: { halign: "center" },
        3: { halign: "center", fillColor: [250, 250, 250] },
        7: { halign: "center" },
      },
      didParseCell: function (data: unknown) {
        const hookData = data as AutoTableHookData;
        if (hookData.section === "body" && typeof hookData.row.index === "number" && hookData.row.index < tableBody.length) {
          const dayStr = hookData.row.raw[0];
          if (dayStr.includes("Sa") || dayStr.includes("So")) hookData.cell.styles.fillColor = [249, 250, 251];
          if (dayStr.includes("*")) {
            hookData.cell.styles.fillColor = [254, 226, 226];
            hookData.cell.styles.textColor = [220, 38, 38];
          }
        }
        if (typeof hookData.row.index === "number" && hookData.row.index === tableBody.length) {
          hookData.cell.styles.fillColor = [230, 230, 230];
          hookData.cell.styles.fontStyle = "bold";
        }
      },
    });

    doc.save(`Personaleinsatz_${selectedRest?.code || "Plan"}_${MONTH_NAMES_DE[month - 1]}_${year}.pdf`);
    setIsExporting(false);
  };

  const handleExportYear = async () => {
    if (!selectedRestaurantId) {
      toast.error("Bitte Restaurant auswählen.");
      return;
    }
    setLoading(true);
    try {
      const doc = new jsPDF("p", "mm", "a4");
      const selectedRest = restaurants.find((r) => r.id === selectedRestaurantId);
      const holidays = getHolidaysForYear(year);

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
        const calculatedRows: (string | number)[][] = [];
        let mSumUmsatz = 0, mSumProd = 0, mSumSF = 0, mSumHM = 0, mSumNZ = 0, mSumExtra = 0;

        for (let i = 1; i <= daysInMonth; i++) {
          const date = new Date(year, m - 1, i);
          const dayNameShort = date.toLocaleDateString("de-AT", { weekday: "short" });
          const isHoliday = holidays.some((h) => h.d === i && h.m === m);
          const saved = currentMonthRows[i - 1] || {};

          const u = parseDE(saved.umsatz);
          const p = parseDE(saved.prod);
          const sf = parseDE(saved.sfStd);
          const hm = parseDE(saved.hmStd);
          const nz = parseDE(saved.nz);
          const ex = parseDE(saved.extra);

          let prodStd = 0;
          if (u > 0 && p > 0) prodStd = Math.max(0, u / p - sf);

          mSumUmsatz += u;
          mSumProd += prodStd;
          mSumSF += sf;
          mSumHM += hm;
          mSumNZ += nz;
          mSumExtra += ex;

          let label = `${i}. ${dayNameShort}`;
          if (isHoliday) label += " *";

          calculatedRows.push([
            label,
            saved.umsatz || "",
            saved.prod || "",
            prodStd > 0 ? fmtNum(prodStd) : "-",
            saved.sfStd || "",
            saved.hmStd || "",
            saved.nz || "",
            saved.extra || "",
          ]);
        }

        const totalRow = [
          "Gesamt",
          fmtNum(mSumUmsatz),
          "-",
          fmtNum(mSumProd),
          fmtNum(mSumSF),
          fmtNum(mSumHM),
          fmtNum(mSumNZ),
          fmtNum(mSumExtra),
        ];

        doc.setFillColor(27, 58, 38);
        doc.rect(0, 0, 210, 20, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`${selectedRest?.code || ""} | ${MONTH_NAMES_DE[m - 1]} ${year}`, 105, 13, { align: "center" });

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        const yPos = 28;

        const valUrlaub = parseDE(currentInputs.vacationStd);
        const valKrank = parseDE(currentInputs.sickStd);
        const valZusatz = parseDE(currentInputs.extraUnprodStd);
        const valWage = parseDE(currentInputs.avgWage);
        const valTax = parseDE(currentInputs.taxAustria);
        const totalHours = mSumProd + mSumHM + mSumExtra + valUrlaub + valKrank + valZusatz;
        const clEuroRaw = (valWage > 0 && (totalHours > 0 || mSumNZ > 0)) ? (totalHours * valWage) + mSumNZ : 0;
        const clEuro = Math.max(0, clEuroRaw - valTax);
        const clPct = (mSumUmsatz > 0 && clEuro > 0) ? (clEuro / mSumUmsatz) * 100 : 0;

        doc.text(`Stundensatz: ${currentInputs.avgWage || "-"} € | Tax: ${currentInputs.taxAustria || "-"} €`, 14, yPos);
        doc.setFont("helvetica", "bold");
        doc.text(`CL: ${fmtNum(clEuro)} € (${fmtNum(clPct)} %)`, 150, yPos);

        autoTable(doc, {
          startY: yPos + 6,
          head: [["Tag", "Umsatz", "Prod(€)", "P.Std", "SF", "HM", "Nacht €", "Extra"]],
          body: [...calculatedRows, totalRow],
          theme: "grid",
          headStyles: { fillColor: [27, 58, 38], textColor: 255, fontSize: 7, halign: "center", cellPadding: 1.5 },
          footStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: "bold", fontSize: 7, cellPadding: 1.5 },
          styles: { fontSize: 7, cellPadding: 1.5, halign: "center" },
          columnStyles: { 0: { halign: "left", fontStyle: "bold" }, 1: { halign: "right" } },
        });
      }
      doc.save(`Personaleinsatz_Jahr_${year}.pdf`);
    } catch (e) {
      console.error(e);
      toast.error("Fehler beim Erstellen des Jahresberichts.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (idx: number, field: keyof DayData, val: string) => {
    const newData = [...daysData];
    newData[idx] = { ...newData[idx], [field]: val };
    setDaysData(newData);
  };

  const handleCopyDown = (field: keyof DayData) => {
    if (daysData.length === 0) return;
    if (!confirm("Wert des ersten Tages in alle Tage kopieren?")) return;
    const valToCopy = daysData[0][field];
    const newData = daysData.map((d) => (d.exists ? { ...d, [field]: valToCopy } : d));
    setDaysData(newData);
  };

  const selectedRest = restaurants.find((r) => r.id === selectedRestaurantId);
  const headerTitle = selectedRest ? `${selectedRest.code} – ${selectedRest.name || ""}` : "Personaleinsatzplanung";

  return (
    <div className="min-h-screen bg-background p-6 text-foreground font-sans">
      {loading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#1b3a26]" />
        </div>
      )}

      <div className="mx-auto flex flex-col md:flex-row justify-between items-center mb-8 gap-4 print:hidden" style={{ maxWidth: "1600px" }}>
        <h1 className="text-4xl font-extrabold tracking-tight uppercase">
          <span style={{ color: COLORS.green }}>Personaleinsatz</span>{" "}
          <span style={{ color: COLORS.yellow }}>{selectedRest ? (selectedRest.name || selectedRest.code) : "Planung"}</span>
        </h1>
        <div className="flex gap-3">
          <button
            onClick={saveDataToDB}
            className="px-6 py-2.5 bg-[#ffc72c] hover:bg-[#e0af25] text-[#1b3a26] font-bold rounded-full shadow-sm transition transform hover:scale-105 flex items-center gap-2"
          >
            Speichern
          </button>
          <button
            onClick={handlePrintSingle}
            className="px-6 py-2.5 bg-muted hover:bg-accent text-foreground font-bold rounded-full shadow-sm transition transform hover:scale-105 flex items-center gap-2"
          >
            Monat PDF
          </button>
          <button
            onClick={handleExportYear}
            className="px-6 py-2.5 bg-[#1b3a26] hover:bg-[#142e1e] text-white font-bold rounded-full shadow-sm transition transform hover:scale-105 flex items-center gap-2"
          >
            Ganzes Jahr
          </button>
        </div>
      </div>

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

      <div className="mx-auto bg-card p-8 rounded-2xl shadow-xl border border-border overflow-hidden" style={{ maxWidth: "1600px" }}>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          <div className="xl:col-span-3 flex flex-col gap-6">
            <div className="bg-card border border-border rounded-xl shadow-sm p-5 no-print">
              <h3 className="text-[#1b3a26] font-bold text-lg border-b border-border pb-3 mb-4 uppercase">Einstellungen</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Jahr</label>
                    <select
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="w-full p-2 bg-muted border border-border rounded-lg font-medium text-foreground focus:ring-2 focus:ring-[#ffc72c] outline-none"
                    >
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end justify-end">
                    <span className="text-3xl font-black text-[#1b3a26]">{MONTH_NAMES_DE[month - 1]}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {MONTH_NAMES_DE.map((mName, i) => (
                    <button
                      key={i}
                      onClick={() => setMonth(i + 1)}
                      className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                        month === i + 1 ? "bg-[#1b3a26] text-white shadow-md" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
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
                <InputRow label="Stundensatz (€)" value={avgWage} onChange={setAvgWage} />
                <InputRow label="Urlaub (h)" value={vacationStd} onChange={setVacationStd} />
                <InputRow label="Krankheit (h)" value={sickStd} onChange={setSickStd} />
                <div className="h-px bg-muted my-2" />
                <ReadOnlyRow label="Prod. Std" value={fmtNum(totals.sumProdStd)} />
                <ReadOnlyRow label="HM Std" value={fmtNum(totals.sumHM)} />
                <ReadOnlyRow label="Nacht (€)" value={fmtNum(totals.sumNZ)} />
                <div className="h-px bg-muted my-2" />
                <InputRow label="Zusatzstd. (nicht prod.)" value={extraUnprodStd} onChange={setExtraUnprodStd} />
                <InputRow label="Tax Austria (€)" value={taxAustria} onChange={setTaxAustria} />
                <div className="h-px bg-muted my-2" />
                <InputRow label="Budget Umsatz" value={budgetUmsatz} onChange={setBudgetUmsatz} />
                <InputRow label="Budget CL €" value={budgetCL} onChange={setBudgetCL} />
                <InputRow label="Budget CL %" value={budgetCLPct} onChange={setBudgetCLPct} />
              </div>
            </div>

            <div className="rounded-xl shadow-md p-5 space-y-3" style={{ backgroundColor: COLORS.yellow }}>
              <SummaryRow label="Gesamtumsatz" value={`${fmtNum(totals.sumUmsatz)} €`} color="text-[#1b3a26]" />
              <SummaryRow label="Gesamtstunden" value={`${fmtNum(totals.totalHours)} h`} color="text-[#1b3a26]" />
              <div className="bg-white/80 p-3 rounded-lg border border-[#1b3a26]/10 flex justify-between items-center my-2">
                <span className="text-sm font-bold text-[#1b3a26]">CL (€)</span>
                <span className={`text-xl font-black ${totals.budgetCLVal > totals.clEuro ? "text-green-700" : "text-red-600"}`}>
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
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse" style={{ borderColor: COLORS.border }}>
                  <thead>
                    <tr className="text-white uppercase text-xs tracking-wider" style={{ backgroundColor: COLORS.green }}>
                      <th className="p-3 border border-border text-center font-bold w-24">Tag</th>
                      <th className="p-3 border border-border text-center w-28 cursor-pointer hover:bg-muted/50" onClick={() => handleCopyDown("umsatz")}>Umsatz</th>
                      <th className="p-3 border border-border text-center w-24 cursor-pointer hover:bg-muted/50" onClick={() => handleCopyDown("prod")}>Prod (€)</th>
                      <th className="p-3 border border-border text-center w-24 bg-[#142e1e]">P.Std</th>
                      <th className="p-3 border border-border text-center w-24 cursor-pointer hover:bg-muted/50" onClick={() => handleCopyDown("sfStd")}>SF</th>
                      <th className="p-3 border border-border text-center w-24 cursor-pointer hover:bg-muted/50" onClick={() => handleCopyDown("hmStd")}>HM</th>
                      <th className="p-3 border border-border text-center w-24 cursor-pointer hover:bg-muted/50" onClick={() => handleCopyDown("nz")}>Nacht €</th>
                      <th className="p-3 border border-border text-center w-24 cursor-pointer hover:bg-muted/50" onClick={() => handleCopyDown("extra")}>Extra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daysData.map((day, idx) => {
                      if (!day.exists) return null;
                      const u = parseDE(day.umsatz);
                      const p = parseDE(day.prod);
                      const sf = parseDE(day.sfStd);
                      let prodStdVal = 0;
                      if (u > 0 && p > 0) {
                        prodStdVal = (u / p) - sf;
                        if (prodStdVal < 0) prodStdVal = 0;
                      }
                      return (
                        <tr key={idx} style={{ backgroundColor: day.isHoliday ? "#fef2f2" : day.isWeekend ? "#f3f4f6" : "#ffffff" }}>
                          <td className={`p-1 px-3 border border-border text-xs font-bold whitespace-nowrap text-center ${day.isHoliday ? "text-red-600" : "text-gray-700"}`}>
                            {day.day}. {day.dayName} {day.isHoliday ? "*" : ""}
                          </td>
                          <td className="p-0 border border-border text-center"><TableInput val={day.umsatz} setVal={(v) => handleInputChange(idx, "umsatz", v)} /></td>
                          <td className="p-0 border border-border text-center"><TableInput val={day.prod} setVal={(v) => handleInputChange(idx, "prod", v)} /></td>
                          <td className="p-1 border border-border text-center text-foreground font-mono text-xs font-bold" style={{ backgroundColor: "#f9fafb" }}>
                            {prodStdVal > 0 ? fmtNum(prodStdVal) : "-"}
                          </td>
                          <td className="p-0 border border-border text-center"><TableInput val={day.sfStd} setVal={(v) => handleInputChange(idx, "sfStd", v)} /></td>
                          <td className="p-0 border border-border text-center"><TableInput val={day.hmStd} setVal={(v) => handleInputChange(idx, "hmStd", v)} /></td>
                          <td className="p-0 border border-border text-center"><TableInput val={day.nz} setVal={(v) => handleInputChange(idx, "nz", v)} /></td>
                          <td className="p-0 border border-border text-center"><TableInput val={day.extra} setVal={(v) => handleInputChange(idx, "extra", v)} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="font-bold border-t-2 border-border text-sm">
                    <tr style={{ backgroundColor: COLORS.lightGray }}>
                      <td className="p-3 border border-border text-center uppercase text-muted-foreground">Gesamt</td>
                      <td className="p-3 border border-border text-center">{fmtNum(totals.sumUmsatz)}</td>
                      <td className="p-3 border border-border text-center text-gray-400">—</td>
                      <td className="p-3 border border-border text-center" style={{ backgroundColor: "#e5e7eb" }}>{fmtNum(totals.sumProdStd)}</td>
                      <td className="p-3 border border-border text-center">{fmtNum(totals.sumSF)}</td>
                      <td className="p-3 border border-border text-center">{fmtNum(totals.sumHM)}</td>
                      <td className="p-3 border border-border text-center">{fmtNum(totals.sumNZ)}</td>
                      <td className="p-3 border border-border text-center">{fmtNum(totals.sumExtra)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const InputRow = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="flex justify-between items-center gap-3">
    <label className="text-xs font-bold text-gray-500 uppercase">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-24 p-1.5 border border-border rounded text-right focus:outline-none focus:border-[#1b3a26] focus:ring-1 focus:ring-[#1b3a26] text-sm font-semibold text-gray-800"
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
  <div className="flex justify-between items-center">
    <span className={`text-sm font-bold opacity-80 uppercase ${color}`}>{label}</span>
    <span className={`${bold ? "font-black text-lg" : "font-bold"} ${color}`}>{value}</span>
  </div>
);

const TableInput = ({ val, setVal }: { val: string; setVal: (v: string) => void }) => (
  <input
    type="text"
    value={val}
    onChange={(e) => setVal(e.target.value)}
    className="w-full h-9 px-1 bg-transparent text-center text-sm font-medium focus:outline-none focus:bg-yellow-50 text-foreground placeholder:text-muted-foreground hover:bg-muted transition-colors border-0"
    placeholder="0"
  />
);

export default function LaborPlannerClient(props: { defaultRestaurantId?: string | null }) {
  return (
    <Suspense fallback={<div className="p-10 text-center">Laden…</div>}>
      <LaborPlannerContent defaultRestaurantId={props.defaultRestaurantId} />
    </Suspense>
  );
}
