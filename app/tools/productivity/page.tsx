/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  Settings, Save, FileText, Plus, Trash2, 
  Calendar, Clock, AlertCircle, X, Check, Edit2, ChevronDown, Building2
} from "lucide-react";

// --- TIPOVI ---
interface Restaurant {
  id: string;
  code: string;
  name: string | null;
}

interface Station {
  key: string;
  label: string;
  group: "Service" | "Kuhinja" | "Lobby" | "McCafé" | "Ostalo" | "Custom";
  isCustom?: boolean;
}

interface HourData {
  rev: string;
  [key: string]: string;
}

interface AutoTableHookData {
  section: 'head' | 'body' | 'foot';
  row: { index: number; raw: (string | number)[] };
  cell: { styles: { fillColor?: number[]; textColor?: number[]; fontStyle?: string } };
}

const DEFAULT_STATIONS: Station[] = [
  { key: "ausgabe", label: "Izlaz", group: "Service" },
  { key: "kueche", label: "Kuhinja", group: "Kuhinja" },
  { key: "lobby", label: "Lobby", group: "Lobby" },
  { key: "mccafe", label: "McCafé", group: "McCafé" },
  { key: "drive", label: "Drive", group: "Service" },
  { key: "getraenke", label: "Pića", group: "Service" },
  { key: "kasse", label: "Kasa", group: "Service" },
  { key: "tableservice", label: "T.Serv.", group: "Service" },
  { key: "pommes", label: "Pomfrit", group: "Service" },
  { key: "sf", label: "SF Prod.", group: "Ostalo" },
  { key: "pause", label: "Pauza(-)", group: "Ostalo" },
];

const DAYS = [
  { key: "monday", label: "Ponedjeljak" },
  { key: "tuesday", label: "Utorak" },
  { key: "wednesday", label: "Srijeda" },
  { key: "thursday", label: "Četvrtak" },
  { key: "friday", label: "Petak" },
  { key: "saturday", label: "Subota" },
  { key: "sunday", label: "Nedjelja" },
  { key: "special_1", label: "Posebni Dan 1" },
  { key: "special_2", label: "Posebni Dan 2" },
  { key: "special_3", label: "Posebni Dan 3" },
];

const parseNum = (val: string | undefined): number => {
  if (!val) return 0;
  const clean = val.replace(",", ".");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const formatHourRange = (h: number) => {
  const next = (h + 1) % 24;
  return `${String(h).padStart(2, '0')}-${String(next).padStart(2, '0')} h`;
};

const fmtInt = (n: number) => 
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Math.round(n || 0));

function ProductivityToolContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Dohvaćamo restaurantId iz URL-a
  const urlId = searchParams.get("restaurantId");

  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  
  // Lokalni state koji služi kao backup ako URL zakasni
  const [activeRestId, setActiveRestId] = useState<string | null>(urlId);

  const [mode, setMode] = useState<"template" | "date">("template");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("monday");
  const [selectedDate, setSelectedDate] = useState("");
  
  const [rows, setRows] = useState<Record<number, HourData>>({});
  const [netCoeff, setNetCoeff] = useState("1.17");
  const [hoursFrom, setHoursFrom] = useState(6);
  const [hoursTo, setHoursTo] = useState(1);
  const [customDayNames, setCustomDayNames] = useState<Record<string, string>>({});
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [customStations, setCustomStations] = useState<Station[]>([]);
  
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [newColName, setNewColName] = useState("");

  useEffect(() => {
    setIsMounted(true);
    setSelectedDate(new Date().toISOString().split("T")[0]);
    
    // Dohvati restorane i postavi inicijalni ID ako ga nema u URL-u
    fetch("/api/restaurants")
      .then(res => res.json())
      .then(data => {
        setRestaurants(data);
        if (!urlId && data.length > 0) {
          setActiveRestId(data[0].id);
          const params = new URLSearchParams(searchParams.toString());
          params.set("restaurantId", data[0].id);
          router.replace(`?${params.toString()}`);
        }
      });
  }, []);

  // Sinhronizacija kad TopNav promijeni URL
  useEffect(() => {
    if (urlId) setActiveRestId(urlId);
  }, [urlId]);

  const allStations = useMemo(() => [...DEFAULT_STATIONS, ...customStations], [customStations]);
  const activeColumns = useMemo(() => allStations.filter(s => !hiddenColumns.includes(s.key)), [hiddenColumns, allStations]);

  const activeHours = useMemo(() => {
    const arr: number[] = [];
    let h = hoursFrom;
    while (true) {
      arr.push(h);
      if (h === (hoursTo === 0 ? 23 : (hoursTo - 1 + 24) % 24)) break;
      h = (h + 1) % 24;
      if (arr.length >= 24) break;
    }
    return arr;
  }, [hoursFrom, hoursTo]);

  const loadData = useCallback(async () => {
    if (!activeRestId) return;
    const key = mode === "template" ? selectedTemplateKey : selectedDate;
    setLoading(true);
    try {
      const res = await fetch(`/api/productivity?restaurantId=${activeRestId}&date=${key}`);
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        setRows(d.rows || {});
        if (d.netCoeff) setNetCoeff(d.netCoeff);
        if (d.hoursFrom !== undefined) setHoursFrom(d.hoursFrom);
        if (d.hoursTo !== undefined) setHoursTo(d.hoursTo);
        if (d.customDayNames) setCustomDayNames(d.customDayNames);
        if (d.hiddenColumns) setHiddenColumns(d.hiddenColumns);
        if (d.customStations) setCustomStations(d.customStations);
      } else {
        setRows({});
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [activeRestId, selectedTemplateKey, selectedDate, mode]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleInputChange = (h: number, field: string, val: string) => {
    setRows((prev) => ({ ...prev, [h]: { ...prev[h], [field]: val } }));
  };

  const getDayLabel = (key: string) => customDayNames[key] || DAYS.find(d => d.key === key)?.label || key;

  const handleRenameDay = () => {
    if (tempName.trim()) { setCustomDayNames(prev => ({ ...prev, [selectedTemplateKey]: tempName })); }
    setIsEditingName(false);
  };

  const totals = useMemo(() => {
    let sumBruto = 0;
    let sumNeto = 0;
    let sumStaff = 0;
    const coeff = parseNum(netCoeff) || 1;

    const rowStats = activeHours.map((h) => {
      const row = rows[h] || {};
      const bruto = parseNum(row.rev);
      const neto = bruto / coeff;
      
      const stationHours = activeColumns
        .filter(s => s.key !== "pause")
        .reduce((acc, s) => acc + parseNum(row[s.key]), 0);
      
      const pauseHours = parseNum(row["pause"]);
      const staffTotal = stationHours - pauseHours;

      const prod = staffTotal > 0 ? neto / staffTotal : 0;

      sumBruto += bruto;
      sumNeto += neto;
      sumStaff += staffTotal;

      return { h, bruto, neto, staffTotal, prod };
    });

    return { sumBruto, sumNeto, sumStaff, avgProd: sumStaff > 0 ? sumNeto / sumStaff : 0, rowStats };
  }, [activeHours, rows, activeColumns, netCoeff]);

  const handleSave = async () => {
    if (!activeRestId) return alert("Greška: Restoran nije identifikovan.");
    setLoading(true);
    const key = mode === "template" ? selectedTemplateKey : selectedDate;
    try {
      const res = await fetch("/api/productivity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          restaurantId: activeRestId, 
          date: key, 
          data: { rows, netCoeff, hoursFrom, hoursTo, customDayNames, hiddenColumns, customStations } 
        }),
      });
      if (res.ok) alert("✅ Podaci spremljeni.");
      else alert("❌ Greška kod spremanja.");
    } catch (error) { alert("❌ Greška na serveru."); } finally { setLoading(false); }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF("l", "mm", "a4");
    const currentRest = restaurants.find(r => r.id === activeRestId);
    const keyLabel = mode === "template" ? getDayLabel(selectedTemplateKey) : selectedDate;

    doc.setFillColor(26, 56, 38);
    doc.rect(0, 0, 297, 25, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("AIW Services - PRODUKTIVNOST", 14, 12);
    doc.setFontSize(10);
    doc.text(`${currentRest?.code || ''} - ${currentRest?.name || ''} | ${keyLabel}`, 14, 18);

    doc.setTextColor(0, 0, 0);
    doc.text(`Bruto: € ${fmtInt(totals.sumBruto)} | Neto: € ${fmtInt(totals.sumNeto)} | Sati: ${fmtInt(totals.sumStaff)} | Prod: € ${fmtInt(totals.avgProd)}`, 14, 32);

    const head = [["Sat", "BRUTO (€)", "NETO (€)", ...activeColumns.map(s => s.label), "Σ MA", "PROD."]];
    const body = totals.rowStats.map(s => {
      const row = rows[s.h] || {};
      return [
        formatHourRange(s.h),
        fmtInt(s.bruto),
        fmtInt(s.neto),
        ...activeColumns.map(col => {
          const val = parseNum(row[col.key]);
          return val === 0 ? "-" : fmtInt(val);
        }),
        fmtInt(s.staffTotal),
        fmtInt(s.prod)
      ];
    });

    const footer = [["UKUPNO", fmtInt(totals.sumBruto), fmtInt(totals.sumNeto), ...activeColumns.map(() => ""), fmtInt(totals.sumStaff), fmtInt(totals.avgProd)]];

    autoTable(doc, {
      startY: 38, head, body: [...body, ...footer], theme: 'grid',
      headStyles: { fillColor: [26, 56, 38], halign: 'center', fontSize: 7, textColor: 255 },
      styles: { fontSize: 7, halign: 'center', cellPadding: 1 },
      columnStyles: { 0: { fontStyle: 'bold', halign: 'left' }, 1: { fontStyle: 'bold' }, 2: { fillColor: [255, 199, 44], textColor: [26, 56, 38], fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.row.index === body.length) {
          data.cell.styles.fillColor = [26, 56, 38];
          data.cell.styles.textColor = 255;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });
    doc.save(`Produktivnost_${currentRest?.code}_${keyLabel}.pdf`);
  };

  if (!isMounted) return null;

  const currentRest = restaurants.find(r => r.id === activeRestId);

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      {loading && (
        <div className="fixed inset-0 bg-white/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-[#1b3a26]"></div>
        </div>
      )}
      
      <header className="bg-white border-b border-gray-200 p-4 shadow-sm z-20 shrink-0">
        <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
            <div className="flex items-center gap-6 w-full xl:w-auto">
                <h1 className="text-2xl font-black tracking-tight text-[#1b3a26] leading-none whitespace-nowrap uppercase">PROD<span className="text-[#ffc72c]">TOOL</span></h1>
                <div className="px-4 py-2 bg-[#1b3a26] text-white rounded-xl font-bold text-sm shadow-sm flex items-center gap-2">
                    <Building2 size={16} className="text-[#ffc72c]" />
                    {currentRest ? `${currentRest.code} - ${currentRest.name}` : "Učitavanje..."}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-200 w-full xl:w-auto">
                <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <button onClick={() => setMode("template")} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${mode==="template" ? "bg-[#1b3a26] text-white" : "text-gray-500"}`}><Settings size={14}/> ŠABLONI</button>
                    <button onClick={() => setMode("date")} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${mode==="date" ? "bg-[#1b3a26] text-white" : "text-gray-500"}`}><Calendar size={14}/> KALENDAR</button>
                </div>
                <div className="flex-1">
                    {mode === "template" ? (
                        <div className="flex items-center gap-2">
                            {isEditingName ? (
                                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-[#1b3a26]">
                                  <input autoFocus type="text" value={tempName} onChange={(e) => setTempName(e.target.value)} className="w-32 p-1 text-sm outline-none font-bold" />
                                  <button onClick={handleRenameDay} className="text-green-600 p-1"><Check size={16}/></button>
                                  <button onClick={() => setIsEditingName(false)} className="text-red-500 p-1"><X size={16}/></button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                      <select value={selectedTemplateKey} onChange={(e) => setSelectedTemplateKey(e.target.value)} className="h-10 pl-3 pr-8 bg-white border border-gray-300 rounded-lg text-sm font-bold appearance-none outline-none focus:ring-2 focus:ring-[#ffc72c]">
                                        {DAYS.map(d => <option key={d.key} value={d.key}>{getDayLabel(d.key)}</option>)}
                                      </select>
                                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                    </div>
                                    {selectedTemplateKey.startsWith('special') && (
                                      <button onClick={() => { setTempName(getDayLabel(selectedTemplateKey)); setIsEditingName(true); }} className="p-2 bg-white border border-gray-300 rounded-lg text-gray-500 hover:text-[#1b3a26]"><Edit2 size={16} /></button>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                      <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="h-10 px-3 bg-white border border-gray-300 rounded-lg text-sm font-bold" />
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 ml-auto w-full xl:w-auto justify-end">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <span className="text-[10px] font-black text-yellow-700 uppercase tracking-widest leading-none">Koef:</span>
                  <input type="text" value={netCoeff} onChange={(e) => setNetCoeff(e.target.value)} className="w-12 bg-transparent text-center font-bold text-sm outline-none text-[#1b3a26]" />
                </div>
                <button onClick={() => setShowHoursModal(true)} className="p-2.5 bg-white border rounded-xl hover:bg-gray-50 text-gray-500 shadow-sm transition-all"><Clock size={18}/></button>
                <button onClick={() => setShowColumnsModal(true)} className="p-2.5 bg-white border rounded-xl hover:bg-gray-50 text-gray-500 shadow-sm transition-all"><Settings size={18}/></button>
                <div className="h-8 w-px bg-gray-300 mx-1 hidden xl:block"></div>
                <button onClick={handleSave} className="flex items-center gap-2 h-10 px-6 bg-[#ffc72c] hover:bg-yellow-400 text-[#1b3a26] rounded-xl text-xs font-black shadow-md transition-all uppercase tracking-widest"><Save size={18}/> SPREMI</button>
                <button onClick={handleExportPDF} className="flex items-center gap-2 h-10 px-6 bg-[#1b3a26] hover:bg-[#142e1e] text-white rounded-xl text-xs font-black shadow-md transition-all uppercase tracking-widest"><FileText size={18}/> PDF</button>
            </div>
        </div>
      </header>

      <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center justify-center shrink-0">
         <div className="flex gap-10 bg-white px-10 py-3 rounded-2xl shadow-sm border border-gray-200">
            <div className="text-center"><p className="text-[9px] font-bold text-gray-400 uppercase mb-1 tracking-widest">Bruto Promet</p><p className="font-black text-xl text-[#1b3a26]">€ {fmtInt(totals.sumBruto)}</p></div>
            <div className="w-px bg-gray-100"></div>
            <div className="text-center"><p className="text-[9px] font-bold text-yellow-600 uppercase mb-1 tracking-widest">Neto Promet</p><p className="font-black text-xl text-yellow-600">€ {fmtInt(totals.sumNeto)}</p></div>
            <div className="w-px bg-gray-100"></div>
            <div className="text-center"><p className="text-[9px] font-bold text-gray-400 uppercase mb-1 tracking-widest">Sati (Σ MA)</p><p className="font-black text-xl text-[#1b3a26]">{fmtInt(totals.sumStaff)}</p></div>
            <div className="w-px bg-gray-100"></div>
            <div className="text-center"><p className="text-[9px] font-bold text-emerald-600 uppercase mb-1 tracking-widest font-black">Produktivnost</p><p className="font-black text-xl text-white bg-emerald-600 px-4 py-0.5 rounded-lg shadow-md">€ {fmtInt(totals.avgProd)}</p></div>
         </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full overflow-hidden max-w-[1920px] mx-auto">
            <div className="overflow-x-auto relative" style={{ maxHeight: "calc(100vh - 260px)" }}>
                <table className="w-full text-[11px] border-collapse">
                    <thead className="bg-[#1b3a26] text-white sticky top-0 z-40 shadow-md">
                        <tr className="uppercase tracking-widest font-black">
                            <th className="p-3 w-20 text-center border-r border-white/5 font-bold sticky left-0 bg-[#1b3a26] z-50">Sat</th>
                            <th className="p-3 w-32 text-center border-r border-white/5 bg-[#ffc72c] text-[#1b3a26] font-black sticky left-20 z-50">BRUTO (€)</th>
                            <th className="p-3 w-32 text-center border-r border-white/5 bg-[#e0af25] text-white font-black sticky left-[208px] z-50">NETO (€)</th>
                            {activeColumns.map(s => (
                              <th key={s.key} className={`p-3 min-w-[75px] text-center border-r border-white/5 font-bold ${s.key==='pause' ? 'bg-red-900/40 text-red-100' : ''}`}>{s.label}</th>
                            ))}
                            <th className="p-3 w-24 text-center bg-[#142e1e] font-black border-l border-white/5">Σ MA</th>
                            <th className="p-3 w-24 text-center bg-[#142e1e] font-black border-l border-white/5">Prod.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {totals.rowStats.map((stat, idx) => {
                            const row = rows[stat.h] || {};
                            return (
                                <tr key={stat.h} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/50 transition-colors`}>
                                    <td className={`p-3 font-black text-gray-400 text-center sticky left-0 z-10 border-r border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>{formatHourRange(stat.h)}</td>
                                    <td className="p-0 border-r border-gray-100 bg-yellow-50/20 sticky left-20 z-10"><input type="text" value={row.rev || ""} onChange={(e) => handleInputChange(stat.h, "rev", e.target.value)} className="w-full h-11 bg-transparent text-center font-black text-gray-900 text-sm focus:bg-white focus:ring-2 focus:ring-[#ffc72c] outline-none" placeholder="0" /></td>
                                    <td className="p-3 text-center font-black text-yellow-600 bg-yellow-50/40 border-r border-gray-100 sticky left-[208px] z-10">{fmtInt(stat.neto)}</td>
                                    {activeColumns.map(s => (
                                        <td key={s.key} className={`p-0 border-r border-gray-100 ${s.key === 'pause' ? 'bg-red-50/30' : ''}`}><input type="text" value={row[s.key] || ""} onChange={(e) => handleInputChange(stat.h, s.key, e.target.value)} className="w-full h-11 bg-transparent text-center text-gray-600 font-bold focus:bg-white focus:ring-2 focus:ring-[#1b3a26] outline-none transition-all" placeholder="-" /></td>
                                    ))}
                                    <td className="p-3 text-center font-black text-[#1b3a26] bg-gray-100/50 border-l border-gray-100 shadow-inner">{fmtInt(stat.staffTotal)}</td>
                                    <td className={`p-3 text-center font-black border-l border-gray-100 ${stat.prod > 0 ? 'text-white bg-[#1b3a26]' : 'text-gray-300'}`}>{stat.prod > 0 ? fmtInt(stat.prod) : "-"}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot className="bg-[#1b3a26] text-white font-black border-t-4 border-[#ffc72c] sticky bottom-0 z-40 shadow-2xl">
                        <tr>
                          <td className="p-4 text-left pl-6 sticky left-0 bg-[#1b3a26] z-50 uppercase tracking-widest text-[10px]">Ukupno</td>
                          <td className="p-4 text-center bg-[#ffc72c] text-[#1b3a26] text-sm sticky left-20 z-50">€ {fmtInt(totals.sumBruto)}</td>
                          <td className="p-4 text-center bg-[#e0af25] text-white text-sm sticky left-[208px] z-50">€ {fmtInt(totals.sumNeto)}</td>
                          {activeColumns.map(s => <td key={s.key} className="border-r border-white/5"></td>)}
                          <td className="p-4 text-center text-sm bg-[#142e1e] border-l border-white/10">{fmtInt(totals.sumStaff)}</td>
                          <td className="p-4 text-center text-[#ffc72c] text-sm bg-[#142e1e] border-l border-white/10">€ {fmtInt(totals.avgProd)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
      </div>

      {showHoursModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm border border-gray-100">
            <h3 className="font-black text-2xl text-[#1b3a26] text-center uppercase tracking-tighter mb-6">Podesi Sate</h3>
            <div className="flex gap-6 mb-8">
              <div className="flex-1 group"><label className="block text-[10px] font-black text-gray-400 mb-2 uppercase text-center tracking-widest">Start</label><input type="number" min="0" max="23" value={hoursFrom} onChange={e => setHoursFrom(Number(e.target.value))} className="w-full h-20 border-4 border-gray-100 rounded-2xl text-4xl font-black text-center text-[#1b3a26] focus:border-[#ffc72c] outline-none" /></div>
              <div className="flex items-center text-gray-300 pt-6 font-black text-2xl">➔</div>
              <div className="flex-1 group"><label className="block text-[10px] font-black text-gray-400 mb-2 uppercase text-center tracking-widest">End</label><input type="number" min="0" max="23" value={hoursTo} onChange={e => setHoursTo(Number(e.target.value))} className="w-full h-20 border-4 border-gray-100 rounded-2xl text-4xl font-black text-center text-[#1b3a26] focus:border-[#ffc72c] outline-none" /></div>
            </div>
            <button onClick={() => setShowHoursModal(false)} className="w-full bg-[#1b3a26] text-white py-4 rounded-2xl font-black uppercase text-sm shadow-lg tracking-widest transition-transform active:scale-95">Spremi Interval</button>
          </div>
        </div>
      )}

      {showColumnsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white p-6 rounded-3xl shadow-2xl w-full max-md max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b pb-4 shrink-0"><h3 className="font-black text-lg text-[#1b3a26] uppercase flex items-center gap-2"><Settings size={20} className="text-[#ffc72c]"/> Kolone i Stanice</h3><button onClick={() => setShowColumnsModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={20}/></button></div>
            <div className="overflow-auto flex-1 space-y-6">
              <div className="grid grid-cols-2 gap-2">
                {DEFAULT_STATIONS.map(s => (
                  <button key={s.key} onClick={() => { if (hiddenColumns.includes(s.key)) setHiddenColumns(prev => prev.filter(k => k !== s.key)); else setHiddenColumns(prev => [...prev, s.key]); }} className={`p-3 rounded-xl text-xs font-bold flex justify-between items-center border-2 transition-all ${!hiddenColumns.includes(s.key) ? 'border-green-500 bg-green-50 text-green-800' : 'bg-white border-gray-100 text-gray-400'}`}>{s.label} {!hiddenColumns.includes(s.key) && <Check size={14} strokeWidth={3}/>}</button>
                ))}
              </div>
              <div className="pt-6 border-t">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-3 tracking-widest">Moje Stanice (Max 3)</h4>
                {customStations.map(s => (
                  <div key={s.key} className="flex items-center gap-2 mb-2 p-2 bg-yellow-50 rounded-xl border border-yellow-200"><span className="flex-1 text-xs font-bold px-2">{s.label}</span><button onClick={() => setCustomStations(prev => prev.filter(x => x.key !== s.key))} className="text-red-400 hover:text-red-600 p-1.5 transition-colors"><Trash2 size={16}/></button></div>
                ))}
                {customStations.length < 3 && (
                  <div className="flex gap-2"><input type="text" placeholder="Naziv..." value={newColName} onChange={(e) => setNewColName(e.target.value)} className="flex-1 p-3 text-xs border rounded-xl font-bold" /><button onClick={() => { if(!newColName) return; setCustomStations(p => [...p, {key: `custom_${Date.now()}`, label: newColName, group: "Custom"}]); setNewColName(""); }} className="p-3 bg-[#1b3a26] text-white rounded-xl hover:bg-[#142e1e] transition-colors"><Plus size={20}/></button></div>
                )}
              </div>
            </div>
            <button onClick={() => setShowColumnsModal(false)} className="w-full mt-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase text-xs hover:bg-gray-200 transition-colors">Zatvori</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductivityTool() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-black uppercase tracking-widest">Učitavanje modula...</div>}>
      <ProductivityToolContent />
    </Suspense>
  );
}