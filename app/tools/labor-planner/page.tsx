"use client";

import React, { useState, useEffect, useCallback } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  d: number; // Dan
  m: number; // Mjesec
}

// --- BOJE ---
const COLORS = {
  green: "#1b3a26", // Tamno zelena
  yellow: "#ffc72c", // McDonald's žuta
  lightGray: "#f3f4f6",
  white: "#ffffff",
  border: "#d1d5db",
};

// --- POMOĆNE FUNKCIJE ---

const parseDE = (s: string | number | undefined | null): number => {
  if (!s) return 0;
  const clean = String(s).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const v = parseFloat(clean);
  return isNaN(v) ? 0 : v;
};

const fmtNum = (n: number, dec: number = 2): string => {
  return new Intl.NumberFormat("bs-BA", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(n || 0);
};

// --- LOGIKA PRAZNIKA ---
const getEasterDate = (year: number): Holiday => {
  const f = Math.floor, a = year % 19, b = f(year / 100), c = year % 100, d = f(b / 4), e = b % 4, g = f((8 * b + 13) / 25), h = (19 * a + b - d - g + 15) % 30, i = f(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = f((a + 11 * h + 22 * l) / 451), n = h + l - 7 * m + 114, month = f(n / 31), day = 1 + (n % 31);
  return { d: day, m: month };
};

const getHolidaysForYear = (year: number): Holiday[] => {
  const holidays: Holiday[] = [];
  // Fiksni
  holidays.push({d: 1, m: 1}); holidays.push({d: 2, m: 1}); holidays.push({d: 1, m: 3}); 
  holidays.push({d: 1, m: 5}); holidays.push({d: 2, m: 5}); holidays.push({d: 25, m: 11}); 
  // Pomični
  const easter = getEasterDate(year);
  const addDays = (h: Holiday, days: number): Holiday => {
    const date = new Date(year, h.m - 1, h.d);
    date.setDate(date.getDate() + days);
    return { d: date.getDate(), m: date.getMonth() + 1 };
  };
  holidays.push(addDays(easter, 1));
  holidays.push(addDays(easter, 60));
  holidays.push({d: 25, m: 12}); holidays.push({d: 26, m: 12}); 
  return holidays;
};

// --- GLAVNA KOMPONENTA ---
export default function LaborPlanner() {
  const [loading, setLoading] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");

  const [avgWage, setAvgWage] = useState("");
  const [vacationStd, setVacationStd] = useState("");
  const [sickStd, setSickStd] = useState("");
  const [extraUnprodStd, setExtraUnprodStd] = useState("");
  const [budgetUmsatz, setBudgetUmsatz] = useState("");
  const [budgetCL, setBudgetCL] = useState("");
  const [budgetCLPct, setBudgetCLPct] = useState("");

  const [daysData, setDaysData] = useState<DayData[]>([]);

  const monthNames = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];

  // 1. DOHVAT RESTORANA
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const res = await fetch("/api/restaurants");
        const data = await res.json();
        setRestaurants(data);
        if (data.length > 0 && !selectedRestaurantId) {
           setSelectedRestaurantId(data[0].id);
        }
      } catch (err) {
        console.error("Greška", err);
      }
    };
    fetchRestaurants();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. GENERIRANJE DANA
  const generateEmptyDays = useCallback((m: number, y: number, savedRows: SavedRow[] = []) => {
    const daysInMonth = new Date(y, m, 0).getDate();
    const currentHolidays = getHolidaysForYear(y);
    const newDays: DayData[] = [];
    const dayNamesBS = { Mon: "Pon", Tue: "Uto", Wed: "Sri", Thu: "Čet", Fri: "Pet", Sat: "Sub", Sun: "Ned" };

    for (let i = 1; i <= 31; i++) {
        const date = new Date(y, m - 1, i);
        const dayNameEng = date.toLocaleDateString("en-US", { weekday: "short" }) as keyof typeof dayNamesBS;
        const dayName = dayNamesBS[dayNameEng] || dayNameEng;
        
        const isWeekend = dayName === "Sub" || dayName === "Ned";
        const isHoliday = currentHolidays.some(h => h.d === i && h.m === m);
        const exists = i <= daysInMonth;
        const saved = savedRows[i - 1] || {};

        newDays.push({
          day: i, dayName, isWeekend, isHoliday, exists,
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
    setAvgWage(""); setVacationStd(""); setSickStd(""); setExtraUnprodStd("");
    setBudgetUmsatz(""); setBudgetCL(""); setBudgetCLPct("");
  };

  // 3. UČITAVANJE
  const loadDataFromDB = useCallback(async (m: number, y: number, rId: string) => {
    if(!rId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/labor-planner?year=${y}&month=${m}&restaurant=${rId}`);
      const json = await res.json();
      if (json.success && json.data) {
        const parsed: LaborPlanData = json.data;
        if(parsed.inputs) {
            setAvgWage(parsed.inputs.avgWage || "");
            setVacationStd(parsed.inputs.vacationStd || "");
            setSickStd(parsed.inputs.sickStd || "");
            setExtraUnprodStd(parsed.inputs.extraUnprodStd || "");
            setBudgetUmsatz(parsed.inputs.budgetUmsatz || "");
            setBudgetCL(parsed.inputs.budgetCL || "");
            setBudgetCLPct(parsed.inputs.budgetCLPct || "");
        }
        if(parsed.rows && Array.isArray(parsed.rows)) {
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
  }, [generateEmptyDays]);

  useEffect(() => {
    if(selectedRestaurantId) {
      loadDataFromDB(month, year, selectedRestaurantId);
    }
  }, [month, year, selectedRestaurantId, loadDataFromDB]);

  // 4. TOTALI
  const totals = (() => {
    let sumUmsatz = 0, sumProdStd = 0, sumSF = 0, sumHM = 0, sumNZ = 0, sumExtra = 0;
    daysData.forEach((d) => {
      if (!d.exists) return;
      const u = parseDE(d.umsatz); const p = parseDE(d.prod); const sf = parseDE(d.sfStd);
      sumUmsatz += u; sumHM += parseDE(d.hmStd); sumNZ += parseDE(d.nz); sumExtra += parseDE(d.extra); sumSF += sf;
      if (u > 0 && p > 0) { let tmp = u / p - sf; if (tmp < 0) tmp = 0; sumProdStd += tmp; }
    });
    const valUrlaub = parseDE(vacationStd); const valKrank = parseDE(sickStd); const valZusatz = parseDE(extraUnprodStd); const valWage = parseDE(avgWage);
    const totalHours = sumProdStd + sumHM + sumExtra + valUrlaub + valKrank + valZusatz;
    const clEuro = (valWage > 0 && (totalHours > 0 || sumNZ > 0)) ? (totalHours * valWage) + sumNZ : 0;
    const clPct = (sumUmsatz > 0 && clEuro > 0) ? (clEuro / sumUmsatz) * 100 : 0;
    const istProd = (sumProdStd + sumExtra) > 0 ? sumUmsatz / (sumProdStd + sumExtra) : 0;
    const realProd = totalHours > 0 ? sumUmsatz / totalHours : 0;
    const budgetCLVal = parseDE(budgetCL);
    return { sumUmsatz, sumProdStd, sumSF, sumHM, sumNZ, sumExtra, totalHours, clEuro, clPct, istProd, realProd, budgetCLVal };
  })();

  // 5. SPREMANJE
  const saveDataToDB = async () => {
    if(!selectedRestaurantId) return alert("Molimo odaberite restoran");
    setLoading(true);
    const dataToSave: LaborPlanData = {
        inputs: { avgWage, vacationStd, sickStd, extraUnprodStd, budgetUmsatz, budgetCL, budgetCLPct },
        rows: daysData.map(d => ({
            umsatz: d.umsatz, prod: d.prod, sfStd: d.sfStd, hmStd: d.hmStd, nz: d.nz, extra: d.extra
        }))
    };
    try {
        const res = await fetch('/api/labor-planner', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year, month, restaurant: selectedRestaurantId, data: dataToSave })
        });
        if(res.ok) alert("✅ Podaci uspješno spremljeni!");
        else alert("❌ Greška pri spremanju");
    } catch (error) { console.error(error); alert("❌ Greška pri spremanju"); } 
    finally { setLoading(false); }
  };

  // 6. PDF EXPORT - MJESEČNI (Podaci -> Tablica)
  const handlePrintSingle = () => {
    if(!selectedRestaurantId) return alert("Odaberite restoran.");
    
    // Kreiraj novi PDF
    const doc = new jsPDF("p", "mm", "a4");
    const selectedRest = restaurants.find(r => r.id === selectedRestaurantId);
    const restTitle = selectedRest ? `${selectedRest.code} - ${selectedRest.name || ''}` : "";

    // Pripremi podatke za tablicu iz trenutnog state-a (daysData)
    const tableBody = daysData.filter(d => d.exists).map(d => {
        const u = parseDE(d.umsatz); 
        const p = parseDE(d.prod); 
        const sf = parseDE(d.sfStd);
        let prodStd = 0;
        if (u > 0 && p > 0) { prodStd = Math.max(0, (u / p) - sf); }

        let dayLabel = `${d.day}. ${d.dayName}`;
        if(d.isHoliday) dayLabel += " *";

        return [
            dayLabel,
            d.umsatz || "",
            d.prod || "",
            prodStd > 0 ? fmtNum(prodStd) : "-",
            d.sfStd || "",
            d.hmStd || "",
            d.nz || "",
            d.extra || ""
        ];
    });

    // Total red
    const totalRow = [
        "UKUPNO",
        fmtNum(totals.sumUmsatz),
        "-",
        fmtNum(totals.sumProdStd),
        fmtNum(totals.sumSF),
        fmtNum(totals.sumHM),
        fmtNum(totals.sumNZ),
        fmtNum(totals.sumExtra)
    ];

    // Header (Zeleni)
    doc.setFillColor(27, 58, 38);
    doc.rect(0, 0, 210, 25, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("AIW Services", 14, 16);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Labor Planner | ${restTitle} | ${monthNames[month-1]} ${year}`, 14, 22);

    // KPI Sekcija
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    const yPos = 35;
    
    doc.text(`Satnica: ${avgWage || '-'} € | GO: ${vacationStd || '-'}h | BO: ${sickStd || '-'}h`, 14, yPos);
    doc.setFont("helvetica", "bold");
    doc.text(`CL: ${fmtNum(totals.clEuro)} € (${fmtNum(totals.clPct)} %) | Sati: ${fmtNum(totals.totalHours)}`, 110, yPos);

    // Generiraj Tablicu
    autoTable(doc, {
        startY: yPos + 8,
        head: [['Dan', 'Promet', 'Prod(€)', 'P.Sati', 'SF', 'HM', 'Noćni', 'Extra']],
        body: [...tableBody, totalRow],
        theme: 'grid',
        headStyles: { fillColor: [27, 58, 38], textColor: 255, fontSize: 9, halign: 'center' },
        footStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.1, valign: 'middle', halign: 'center' },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 20, halign: 'left' },
            1: { halign: 'right' },
            2: { halign: 'center' },
            3: { halign: 'center', fillColor: [245, 245, 245] },
            7: { halign: 'center' }
        },
        // OVDJE KORISTIMO any DA SPRIJEČIMO TYPE ERROR
        didParseCell: function(data: any) {
            if (data.section === 'body' && data.row.index < tableBody.length) {
                const rowRaw = data.row.raw as string[];
                const dayStr = rowRaw[0];
                
                if (dayStr.includes('Sub') || dayStr.includes('Ned')) {
                    data.cell.styles.fillColor = [243, 244, 246]; // Siva
                }
                if (dayStr.includes('*')) {
                    data.cell.styles.fillColor = [254, 226, 226]; // Crvenkasta
                }
            }
            if (data.row.index === tableBody.length) {
                 data.cell.styles.fillColor = [220, 220, 220];
                 data.cell.styles.fontStyle = 'bold';
            }
        }
    });

    doc.save(`Labor_${selectedRest?.code || 'Plan'}_${monthNames[month-1]}_${year}.pdf`);
  };

  // 7. PDF EXPORT - GODIŠNJI
  const handleExportYear = async () => {
    if(!selectedRestaurantId) return alert("Odaberite restoran.");
    setLoading(true);
    try {
        const doc = new jsPDF("p", "mm", "a4");
        const selectedRest = restaurants.find(r => r.id === selectedRestaurantId);
        const restTitle = selectedRest ? `${selectedRest.code} - ${selectedRest.name || ''}` : "";
        const holidays = getHolidaysForYear(year);

        for (let m = 1; m <= 12; m++) {
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
            let mSumUmsatz=0, mSumProd=0, mSumSF=0, mSumHM=0, mSumNZ=0, mSumExtra=0;

            for (let i = 1; i <= daysInMonth; i++) {
                const date = new Date(year, m - 1, i);
                const dayNameShort = date.toLocaleDateString("bs-BA", { weekday: "short" });
                const isHoliday = holidays.some(h => h.d === i && h.m === m);
                const saved = currentMonthRows[i - 1] || {};

                const u = parseDE(saved.umsatz); 
                const p = parseDE(saved.prod); 
                const sf = parseDE(saved.sfStd);
                const hm = parseDE(saved.hmStd);
                const nz = parseDE(saved.nz);
                const ex = parseDE(saved.extra);

                let prodStd = 0;
                if (u > 0 && p > 0) { prodStd = Math.max(0, (u / p) - sf); }

                mSumUmsatz+=u; mSumProd+=prodStd; mSumSF+=sf; mSumHM+=hm; mSumNZ+=nz; mSumExtra+=ex;

                let label = `${i}. ${dayNameShort}`;
                if(isHoliday) label += " *"; 

                calculatedRows.push([
                    label,
                    saved.umsatz || "",
                    saved.prod || "",
                    prodStd > 0 ? fmtNum(prodStd) : "-",
                    saved.sfStd || "",
                    saved.hmStd || "",
                    saved.nz || "",
                    saved.extra || ""
                ]);
            }

            const totalRow = [
                "UKUPNO",
                fmtNum(mSumUmsatz),
                "-",
                fmtNum(mSumProd),
                fmtNum(mSumSF),
                fmtNum(mSumHM),
                fmtNum(mSumNZ),
                fmtNum(mSumExtra)
            ];

            if (m > 1) doc.addPage();

            // HEADER
            doc.setFillColor(27, 58, 38);
            doc.rect(0, 0, 210, 20, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("AIW Services", 14, 12);
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.text(`Labor Planner | ${restTitle} | ${monthNames[m-1]} ${year}`, 14, 17);

            // KPI
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(9);
            const yPos = 28;
            
            const valUrlaub = parseDE(currentInputs.vacationStd);
            const valKrank = parseDE(currentInputs.sickStd);
            const valZusatz = parseDE(currentInputs.extraUnprodStd);
            const valWage = parseDE(currentInputs.avgWage);
            const totalHours = mSumProd + mSumHM + mSumExtra + valUrlaub + valKrank + valZusatz;
            const clEuro = (valWage > 0 && (totalHours > 0 || mSumNZ > 0)) ? (totalHours * valWage) + mSumNZ : 0;
            const clPct = (mSumUmsatz > 0 && clEuro > 0) ? (clEuro / mSumUmsatz) * 100 : 0;

            doc.text(`Satnica: ${currentInputs.avgWage || '-'} € | GO: ${currentInputs.vacationStd || '-'}h | BO: ${currentInputs.sickStd || '-'}h`, 14, yPos);
            doc.setFont("helvetica", "bold");
            doc.text(`CL: ${fmtNum(clEuro)} € (${fmtNum(clPct)} %) | Sati: ${fmtNum(totalHours)}`, 130, yPos);

            // TABLICA
            autoTable(doc, {
                startY: yPos + 5,
                head: [['Dan', 'Promet', 'Prod(€)', 'P.Sati', 'SF', 'HM', 'Noćni', 'Extra']],
                body: [...calculatedRows, totalRow],
                theme: 'grid',
                headStyles: { fillColor: [27, 58, 38], textColor: 255, fontSize: 8, halign: 'center' },
                footStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', fontSize: 8 },
                styles: { fontSize: 7, cellPadding: 1.5, lineColor: [200, 200, 200], lineWidth: 0.1, valign: 'middle', halign: 'center' },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 15, halign: 'left' },
                    1: { halign: 'right' },
                    2: { halign: 'center' },
                    3: { halign: 'center', fillColor: [245, 245, 245] },
                    7: { halign: 'center' }
                },
                didParseCell: function(data: any) {
                    if (data.section === 'body' && data.row.index < calculatedRows.length) {
                        const raw = data.row.raw as string[];
                        const dayStr = raw[0];
                        if (dayStr.includes('Sub') || dayStr.includes('Ned')) {
                            data.cell.styles.fillColor = [243, 244, 246];
                        }
                        if (dayStr.includes('*')) {
                            data.cell.styles.fillColor = [254, 226, 226];
                        }
                    }
                    if (data.row.index === calculatedRows.length) {
                         data.cell.styles.fillColor = [220, 220, 220];
                         data.cell.styles.fontStyle = 'bold';
                    }
                }
            });
        }
        doc.save(`Labor_Plan_Godisnji_${year}.pdf`);
    } catch (e) {
        console.error(e);
        alert("Greška kod generiranja godišnjeg izvještaja.");
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
      if(daysData.length === 0) return;
      if(!confirm("Kopirati vrijednost prvog dana na sve ostale dane?")) return;
      const valToCopy = daysData[0][field];
      const newData = daysData.map(d => d.exists ? ({...d, [field]: valToCopy}) : d);
      setDaysData(newData);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-gray-800 font-sans">
      {loading && (
          <div className="fixed inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#1b3a26]"></div>
          </div>
      )}

      {/* HEADER */}
      <div className="mx-auto flex flex-col md:flex-row justify-between items-center mb-8 gap-4 print:hidden" style={{ maxWidth: '1600px' }}>
        <h1 className="text-4xl font-extrabold tracking-tight uppercase">
            <span style={{ color: COLORS.green }}>LABOR</span> <span style={{ color: COLORS.yellow }}>PLANNER</span>
        </h1>
        <div className="flex gap-3">
            <button onClick={saveDataToDB} className="px-6 py-2.5 bg-[#ffc72c] hover:bg-[#e0af25] text-[#1b3a26] font-bold rounded-full shadow-sm transition transform hover:scale-105 flex items-center gap-2">
                💾 SPREMI
            </button>
            <button onClick={handlePrintSingle} className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-full shadow-sm transition transform hover:scale-105 flex items-center gap-2">
                📄 Mjesec PDF
            </button>
            <button onClick={handleExportYear} className="px-6 py-2.5 bg-[#1b3a26] hover:bg-[#142e1e] text-white font-bold rounded-full shadow-sm transition transform hover:scale-105 flex items-center gap-2">
                📚 Cijela Godina
            </button>
        </div>
      </div>

      {/* GLAVNI CONTAINER */}
      <div 
        className="mx-auto bg-white p-8 rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
        style={{ backgroundColor: '#ffffff', color: '#000000', maxWidth: '1600px' }} 
      >
        
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
            {/* LIJEVA STRANA */}
            <div className="xl:col-span-3 flex flex-col gap-6">
                
                {/* 1. KARTICA POSTAVKI */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 no-print" style={{ backgroundColor: '#ffffff' }}>
                    <h3 className="text-[#1b3a26] font-bold text-lg border-b border-gray-100 pb-3 mb-4 uppercase">Postavke</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Restoran</label>
                            <select 
                                value={selectedRestaurantId} 
                                onChange={(e) => setSelectedRestaurantId(e.target.value)}
                                className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg font-medium text-gray-800 focus:ring-2 focus:ring-[#ffc72c] outline-none"
                            >
                                {restaurants.map(r => <option key={r.id} value={r.id}>{r.code} - {r.name}</option>)}
                            </select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Godina</label>
                                <select 
                                    value={year} 
                                    onChange={(e) => setYear(Number(e.target.value))}
                                    className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg font-medium text-gray-800 focus:ring-2 focus:ring-[#ffc72c] outline-none"
                                >
                                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div className="flex items-end justify-end">
                                <span className="text-3xl font-black text-[#1b3a26]">{monthNames[month-1]}</span>
                            </div>
                        </div>

                        {/* Mjeseci Picker */}
                        <div className="flex flex-wrap gap-1.5 pt-2">
                            {monthNames.map((mName, i) => (
                                <button 
                                    key={i}
                                    onClick={() => setMonth(i + 1)}
                                    className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                                        month === i + 1 
                                        ? 'bg-[#1b3a26] text-white shadow-md' 
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                                >
                                    {mName.substring(0,3)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 2. ULAZNI PODACI */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5" style={{ backgroundColor: '#ffffff' }}>
                    <h3 className="text-gray-700 font-bold text-sm uppercase mb-3">Parametri</h3>
                    <div className="space-y-2">
                        <InputRow label="Satnica (€)" value={avgWage} onChange={setAvgWage} />
                        <InputRow label="Godišnji (h)" value={vacationStd} onChange={setVacationStd} />
                        <InputRow label="Bolovanje (h)" value={sickStd} onChange={setSickStd} />
                        <div className="h-px bg-gray-100 my-2"></div>
                        <ReadOnlyRow label="Prod. Sati" value={fmtNum(totals.sumProdStd)} />
                        <ReadOnlyRow label="HM Sati" value={fmtNum(totals.sumHM)} />
                        <ReadOnlyRow label="Noćni (€)" value={fmtNum(totals.sumNZ)} />
                        <div className="h-px bg-gray-100 my-2"></div>
                        <InputRow label="Dodatni Sati" value={extraUnprodStd} onChange={setExtraUnprodStd} />
                        <InputRow label="Budžet Promet" value={budgetUmsatz} onChange={setBudgetUmsatz} />
                        <InputRow label="Budžet CL €" value={budgetCL} onChange={setBudgetCL} />
                        <InputRow label="Budžet CL %" value={budgetCLPct} onChange={setBudgetCLPct} />
                    </div>
                </div>

                {/* 3. TOTALI (KPI) */}
                <div className="rounded-xl shadow-md p-5 space-y-3" style={{ backgroundColor: COLORS.yellow }}>
                     <SummaryRow label="UKUPAN PROMET" value={`€ ${fmtNum(totals.sumUmsatz)}`} color="text-[#1b3a26]" />
                     <SummaryRow label="UKUPNO SATI" value={`${fmtNum(totals.totalHours)} h`} color="text-[#1b3a26]" />
                     
                     <div className="bg-white/80 p-3 rounded-lg border border-[#1b3a26]/10 flex justify-between items-center my-2">
                        <span className="text-sm font-bold text-[#1b3a26]">CL (€)</span>
                        <span className={`text-xl font-black ${totals.budgetCLVal > totals.clEuro ? 'text-green-700' : 'text-red-600'}`}>
                            € {fmtNum(totals.clEuro)}
                        </span>
                     </div>

                     <SummaryRow label="CL %" value={`${fmtNum(totals.clPct)} %`} bold color="text-[#1b3a26]" />
                     <div className="h-px bg-[#1b3a26]/20 my-1"></div>
                     <SummaryRow label="PROD. (IST)" value={totals.istProd > 0 ? `€ ${fmtNum(totals.istProd)}` : '—'} color="text-[#1b3a26]" />
                     <SummaryRow label="PROD. (REAL)" value={totals.realProd > 0 ? `€ ${fmtNum(totals.realProd)}` : '—'} color="text-[#1b3a26]" />
                </div>

            </div>

            {/* DESNA STRANA - TABLICA */}
            <div className="xl:col-span-9">
                <div className="border border-gray-300 rounded-lg overflow-hidden" style={{ borderColor: COLORS.border, backgroundColor: '#ffffff' }}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse" style={{ borderColor: COLORS.border }}>
                            <thead>
                                <tr className="text-white uppercase text-xs tracking-wider" style={{ backgroundColor: COLORS.green }}>
                                    <th className="p-3 border border-gray-400 text-left font-bold w-24">Dan</th>
                                    <th className="p-3 border border-gray-400 text-center w-28 cursor-pointer hover:bg-white/10" onClick={() => handleCopyDown('umsatz')}>Promet</th>
                                    <th className="p-3 border border-gray-400 text-center w-24 cursor-pointer hover:bg-white/10" onClick={() => handleCopyDown('prod')}>Prod (€)</th>
                                    <th className="p-3 border border-gray-400 text-center w-24 bg-[#142e1e]">P. Sati</th>
                                    <th className="p-3 border border-gray-400 text-center w-24 cursor-pointer hover:bg-white/10" onClick={() => handleCopyDown('sfStd')}>SF Sati</th>
                                    <th className="p-3 border border-gray-400 text-center w-24 cursor-pointer hover:bg-white/10" onClick={() => handleCopyDown('hmStd')}>HM Sati</th>
                                    <th className="p-3 border border-gray-400 text-center w-24 cursor-pointer hover:bg-white/10" onClick={() => handleCopyDown('nz')}>Noćni €</th>
                                    <th className="p-3 border border-gray-400 text-center w-24 cursor-pointer hover:bg-white/10" onClick={() => handleCopyDown('extra')}>Extra</th>
                                </tr>
                            </thead>
                            <tbody>
                                {daysData.map((day, idx) => {
                                    if (!day.exists) return null;
                                    const u = parseDE(day.umsatz); const p = parseDE(day.prod); const sf = parseDE(day.sfStd);
                                    let prodStdVal = 0; if(u > 0 && p > 0) { prodStdVal = (u / p) - sf; if(prodStdVal < 0) prodStdVal = 0; }

                                    return (
                                        <tr key={idx} style={{ backgroundColor: day.isHoliday ? '#fef2f2' : day.isWeekend ? '#f3f4f6' : '#ffffff' }}>
                                            <td className={`p-1 px-3 border border-gray-300 text-xs font-bold whitespace-nowrap 
                                                ${day.isHoliday ? 'text-red-600' : 'text-gray-700'}`}>
                                                {day.day}. {day.dayName} {day.isHoliday ? '*' : ''}
                                            </td>
                                            <td className="p-0 border border-gray-300"><TableInput val={day.umsatz} setVal={(v) => handleInputChange(idx, 'umsatz', v)} /></td>
                                            <td className="p-0 border border-gray-300"><TableInput val={day.prod} setVal={(v) => handleInputChange(idx, 'prod', v)} /></td>
                                            <td className="p-1 border border-gray-300 text-center text-gray-900 font-mono text-xs font-bold" style={{ backgroundColor: '#f9fafb' }}>
                                                {prodStdVal > 0 ? fmtNum(prodStdVal) : '-'}
                                            </td>
                                            <td className="p-0 border border-gray-300"><TableInput val={day.sfStd} setVal={(v) => handleInputChange(idx, 'sfStd', v)} /></td>
                                            <td className="p-0 border border-gray-300"><TableInput val={day.hmStd} setVal={(v) => handleInputChange(idx, 'hmStd', v)} /></td>
                                            <td className="p-0 border border-gray-300"><TableInput val={day.nz} setVal={(v) => handleInputChange(idx, 'nz', v)} /></td>
                                            <td className="p-0 border border-gray-300"><TableInput val={day.extra} setVal={(v) => handleInputChange(idx, 'extra', v)} /></td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                            <tfoot className="font-bold border-t-2 border-gray-400 text-sm">
                                <tr style={{ backgroundColor: COLORS.lightGray }}>
                                    <td className="p-3 border border-gray-300 text-left uppercase text-gray-600">Ukupno</td>
                                    <td className="p-3 border border-gray-300 text-right">{fmtNum(totals.sumUmsatz)}</td>
                                    <td className="p-3 border border-gray-300 text-center text-gray-400">—</td>
                                    <td className="p-3 border border-gray-300 text-center" style={{ backgroundColor: '#e5e7eb' }}>{fmtNum(totals.sumProdStd)}</td>
                                    <td className="p-3 border border-gray-300 text-center">{fmtNum(totals.sumSF)}</td>
                                    <td className="p-3 border border-gray-300 text-center">{fmtNum(totals.sumHM)}</td>
                                    <td className="p-3 border border-gray-300 text-center">{fmtNum(totals.sumNZ)}</td>
                                    <td className="p-3 border border-gray-300 text-center">{fmtNum(totals.sumExtra)}</td>
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

// --- REDIZAJNIRANE KOMPONENTE ---

const InputRow = ({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) => (
    <div className="flex justify-between items-center gap-3">
        <label className="text-xs font-bold text-gray-500 uppercase">{label}</label>
        <input 
            type="text" 
            value={value} 
            onChange={(e) => onChange(e.target.value)} 
            className="w-24 p-1.5 border border-gray-300 rounded text-right focus:outline-none focus:border-[#1b3a26] focus:ring-1 focus:ring-[#1b3a26] text-sm font-semibold text-gray-800" 
        />
    </div>
);

const ReadOnlyRow = ({ label, value }: { label: string, value: string }) => (
    <div className="flex justify-between items-center gap-3 bg-gray-50 p-1.5 rounded border border-gray-200">
        <label className="text-xs font-bold text-gray-400 uppercase">{label}</label>
        <div className="font-mono text-sm font-bold text-gray-700">{value}</div>
    </div>
);

const SummaryRow = ({ label, value, bold, color = "text-gray-900" }: { label: string, value: string, bold?: boolean, color?: string }) => (
    <div className="flex justify-between items-center">
        <span className={`text-sm font-bold opacity-80 uppercase ${color}`}>{label}</span>
        <span className={`${bold ? 'font-black text-lg' : 'font-bold'} ${color}`}>{value}</span>
    </div>
);

const TableInput = ({ val, setVal }: { val: string, setVal: (v: string) => void }) => (
    <input 
        type="text" 
        value={val} 
        onChange={(e) => setVal(e.target.value)} 
        className="w-full h-9 px-1 bg-transparent text-center text-sm font-medium focus:outline-none focus:bg-yellow-50 text-gray-900 placeholder-gray-300 hover:bg-gray-50 transition-colors"
        placeholder="0"
    />
);