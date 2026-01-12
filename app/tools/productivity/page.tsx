/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  Settings, Save, FileText, Plus, Trash2, 
  Calendar, Clock, AlertCircle, X, Check, Edit2, Info, ChevronDown, Building2
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

interface ProductivityState {
  rows: Record<number, HourData>;
  hoursFrom: number;
  hoursTo: number;
  customDayNames: Record<string, string>;
  hiddenColumns: string[];
  customStations: Station[];
}

// Defaultne fiksne kolone
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

// --- POMOĆNE FUNKCIJE ---

const parseNum = (val: string | undefined): number => {
  if (!val) return 0;
  const clean = val.replace(",", ".");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const fmtCurr = (n: number) => 
  new Intl.NumberFormat("bs-BA", { style: "currency", currency: "EUR" }).format(n);

const fmtNum = (n: number) => 
  new Intl.NumberFormat("bs-BA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// --- GLAVNA KOMPONENTA ---

export default function ProductivityTool() {
  // Ovo rješava Hydration Error
  const [isMounted, setIsMounted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestId, setSelectedRestId] = useState("");
  
  const [mode, setMode] = useState<"template" | "date">("template");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("monday");
  const [selectedDate, setSelectedDate] = useState("");

  const [hoursFrom, setHoursFrom] = useState(6);
  const [hoursTo, setHoursTo] = useState(1);
  const [rows, setRows] = useState<Record<number, HourData>>({});
  
  const [customDayNames, setCustomDayNames] = useState<Record<string, string>>({});
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [customStations, setCustomStations] = useState<Station[]>([]);
  
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [newColName, setNewColName] = useState("");

  // Postavi isMounted na true tek nakon prvog renderiranja na klijentu
  useEffect(() => {
    setIsMounted(true);
    setSelectedDate(new Date().toISOString().split("T")[0]);
  }, []);

  // 1. UČITAVANJE RESTORANA
  useEffect(() => {
    fetch("/api/restaurants")
      .then((res) => {
        if(!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
            setRestaurants(data);
            if (data.length > 0) setSelectedRestId(data[0].id);
        } else {
            setRestaurants([]); 
        }
      })
      .catch(err => {
          console.error(err);
          setRestaurants([]);
      });
  }, []);

  const allStations = useMemo(() => {
    return [...DEFAULT_STATIONS, ...customStations];
  }, [customStations]);

  const activeColumns = useMemo(() => {
    return allStations.filter(s => !hiddenColumns.includes(s.key));
  }, [hiddenColumns, allStations]);

  const activeHours = useMemo(() => {
    const arr: number[] = [];
    if (hoursFrom === hoursTo) {
      for (let i = 0; i < 24; i++) arr.push(i);
    } else {
      let h = hoursFrom;
      while (true) {
        arr.push(h);
        h = (h + 1) % 24;
        if (h === hoursTo) break;
      }
    }
    return arr;
  }, [hoursFrom, hoursTo]);

  const loadData = useCallback(async () => {
    const key = mode === "template" ? selectedTemplateKey : selectedDate;
    if (!selectedRestId || !key) return;
    
    try {
      const res = await fetch(`/api/productivity?restaurantId=${selectedRestId}&date=${key}`);
      const json = await res.json();
      
      if (json.success && json.data) {
        const savedData = json.data as any;
        setRows(savedData.rows || {});
        if (typeof savedData.hoursFrom === 'number') setHoursFrom(savedData.hoursFrom);
        if (typeof savedData.hoursTo === 'number') setHoursTo(savedData.hoursTo);
        if (savedData.customDayNames) setCustomDayNames(savedData.customDayNames);
        if (savedData.hiddenColumns) setHiddenColumns(savedData.hiddenColumns);
        if (savedData.customStations) setCustomStations(savedData.customStations);
      } else {
        setRows({});
      }
    } catch (err) {
      console.error(err);
    } 
  }, [selectedRestId, selectedTemplateKey, selectedDate, mode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInputChange = (h: number, field: string, val: string) => {
    setRows((prev) => ({
      ...prev,
      [h]: { ...prev[h], [field]: val },
    }));
  };

  const handleRenameDay = () => {
    if (tempName.trim()) {
      setCustomDayNames(prev => ({ ...prev, [selectedTemplateKey]: tempName }));
    }
    setIsEditingName(false);
  };

  const getDayLabel = (key: string) => {
    if (customDayNames[key]) return customDayNames[key];
    return DAYS.find(d => d.key === key)?.label || key;
  };

  const handleAddCustomStation = () => {
    if (customStations.length >= 3) return alert("Maksimalno 3 dodatna radna mjesta.");
    if (!newColName.trim()) return;
    
    const newStation: Station = {
      key: `custom_${Date.now()}`,
      label: newColName,
      group: "Custom",
      isCustom: true
    };
    
    setCustomStations(prev => [...prev, newStation]);
    setNewColName("");
  };

  const removeCustomStation = (key: string) => {
    setCustomStations(prev => prev.filter(s => s.key !== key));
  };

  const totals = useMemo(() => {
    let sumRev = 0;
    let sumStaff = 0;

    const rowStats = activeHours.map((h) => {
      const row = rows[h] || {};
      const rev = parseNum(row.rev);
      const staff = activeColumns.reduce((acc, s) => acc + parseNum(row[s.key]), 0);
      const prod = staff > 0 ? rev / staff : 0;

      sumRev += rev;
      sumStaff += staff;

      return { h, rev, staff, prod };
    });

    const avgProd = sumStaff > 0 ? sumRev / sumStaff : 0;
    return { sumRev, sumStaff, avgProd, rowStats };
  }, [activeHours, rows, activeColumns]);

  const handleSave = async () => {
    if (!selectedRestId) return alert("Odaberite restoran");
    setLoading(true);
    
    const key = mode === "template" ? selectedTemplateKey : selectedDate;

    const dataToSave: ProductivityState = {
      rows,
      hoursFrom,
      hoursTo,
      customDayNames,
      hiddenColumns,
      customStations
    };

    try {
      const res = await fetch("/api/productivity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: selectedRestId,
          date: key,
          data: dataToSave,
        }),
      });
      if (res.ok) alert("✅ Podaci uspješno spremljeni!");
      else alert("❌ Greška pri spremanju");
    } catch (error) {
      console.error(error);
      alert("❌ Greška");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const doc = new jsPDF("l", "mm", "a4");
    const selectedRest = restaurants.find((r) => r.id === selectedRestId);
    const keyLabel = mode === "template" ? getDayLabel(selectedTemplateKey) : selectedDate;
    
    doc.setFillColor(27, 58, 38);
    doc.rect(0, 0, 297, 25, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("AIW Services - Produktivnost", 14, 10);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${selectedRest?.code || ''} | ${keyLabel} | ${hoursFrom}:00 - ${hoursTo}:00`, 14, 18);

    doc.setTextColor(0, 0, 0);
    doc.text(`Promet: ${fmtCurr(totals.sumRev)} | Sati: ${fmtNum(totals.sumStaff)} | Prod: ${fmtCurr(totals.avgProd)}`, 14, 32);

    const headRow = ["Sat", "Promet", ...activeColumns.map(s => s.label), "Σ MA", "Prod."];

    const bodyData = totals.rowStats.map((stat) => {
      const rowData = rows[stat.h] || {};
      return [
        `${String(stat.h).padStart(2, '0')}:00`,
        fmtNum(stat.rev),
        ...activeColumns.map(s => {
          const val = parseNum(rowData[s.key]);
          return val === 0 ? "" : fmtNum(val);
        }),
        fmtNum(stat.staff),
        fmtNum(stat.prod)
      ];
    });

    const footerRow = [
      "UKUPNO",
      fmtNum(totals.sumRev),
      ...activeColumns.map(() => ""),
      fmtNum(totals.sumStaff),
      fmtNum(totals.avgProd)
    ];

    autoTable(doc, {
      startY: 36,
      head: [headRow],
      body: [...bodyData, footerRow],
      theme: 'grid',
      headStyles: { fillColor: [27, 58, 38], halign: 'center', textColor: 255, fontSize: 8 },
      styles: { fontSize: 7, halign: 'center', lineColor: [200, 200, 200], lineWidth: 0.1, cellPadding: 1 },
      columnStyles: { 0: { fontStyle: 'bold', halign: 'left', cellWidth: 15 }, 1: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: function(data: any) {
        if (data.row.index === bodyData.length) {
           data.cell.styles.fillColor = [220, 220, 220];
           data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    doc.save(`Prod_${selectedRest?.code}_${keyLabel}.pdf`);
  };

  // AKO NIJE MOUNTAN (SERVER SIDE), NE PRIKAZUJ NIŠTA
  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      {loading && (
        <div className="fixed inset-0 bg-white/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-[#1b3a26]"></div>
        </div>
      )}

      {/* --- HEADER --- */}
      <header className="bg-white border-b border-gray-200 p-4 shadow-sm z-20 shrink-0">
        <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
            
            {/* Lijeva strana */}
            <div className="flex items-center gap-6 w-full xl:w-auto">
                <h1 className="text-2xl font-black tracking-tight text-[#1b3a26] leading-none whitespace-nowrap">
                    PROD<span className="text-[#ffc72c]">TOOL</span>
                </h1>
                
                <div className="relative w-full xl:w-72">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Building2 size={20} />
                    </div>
                    <select 
                        value={selectedRestId}
                        onChange={(e) => setSelectedRestId(e.target.value)}
                        className="w-full h-12 pl-10 pr-10 border-2 border-gray-300 rounded-xl text-lg font-bold text-gray-800 bg-white focus:ring-2 focus:ring-[#ffc72c] focus:border-[#1b3a26] outline-none appearance-none cursor-pointer shadow-sm transition-all hover:border-gray-400"
                    >
                        {restaurants.length === 0 ? (
                            <option value="">Učitavanje restorana...</option>
                        ) : (
                            restaurants.map(r => <option key={r.id} value={r.id}>{r.code} - {r.name}</option>)
                        )}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={20} />
                </div>
            </div>

            {/* Sredina */}
            <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-200 w-full xl:w-auto">
                <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <button 
                        onClick={() => setMode("template")} 
                        className={`px-4 py-2 text-xs font-bold transition flex items-center gap-2 ${mode==="template" ? "bg-[#1b3a26] text-white" : "text-gray-500 hover:bg-gray-50"}`}
                    >
                        <Settings size={14}/> ŠABLONI
                    </button>
                    <button 
                        onClick={() => setMode("date")} 
                        className={`px-4 py-2 text-xs font-bold transition flex items-center gap-2 ${mode==="date" ? "bg-[#1b3a26] text-white" : "text-gray-500 hover:bg-gray-50"}`}
                    >
                        <Calendar size={14}/> KALENDAR
                    </button>
                </div>

                <div className="flex-1">
                    {mode === "template" ? (
                        <div className="flex items-center gap-2">
                            {isEditingName ? (
                                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-[#1b3a26] shadow-sm">
                                    <input autoFocus type="text" value={tempName} onChange={(e) => setTempName(e.target.value)} className="w-32 p-1 text-sm outline-none font-bold bg-transparent" />
                                    <button onClick={handleRenameDay} className="text-green-600 hover:bg-green-100 p-1 rounded"><Check size={16}/></button>
                                    <button onClick={() => setIsEditingName(false)} className="text-red-500 hover:bg-red-100 p-1 rounded"><X size={16}/></button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <select 
                                            value={selectedTemplateKey} 
                                            onChange={(e) => setSelectedTemplateKey(e.target.value)} 
                                            className="h-10 pl-3 pr-8 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-800 outline-none cursor-pointer focus:border-[#1b3a26] shadow-sm appearance-none"
                                        >
                                            {DAYS.map(d => <option key={d.key} value={d.key}>{getDayLabel(d.key)}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                    </div>
                                    
                                    {selectedTemplateKey.startsWith('special') && (
                                        <button 
                                            onClick={() => { setTempName(getDayLabel(selectedTemplateKey)); setIsEditingName(true); }} 
                                            className="p-2 bg-white border border-gray-300 rounded-lg text-gray-500 hover:text-[#1b3a26] hover:border-[#1b3a26] transition shadow-sm"
                                            title="Preimenuj dan"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="relative">
                            <input 
                                type="date" 
                                value={selectedDate} 
                                onChange={(e) => setSelectedDate(e.target.value)} 
                                className="h-10 px-3 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-800 outline-none focus:border-[#1b3a26] shadow-sm"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Desna strana */}
            <div className="flex flex-wrap items-center gap-2 ml-auto w-full xl:w-auto justify-end">
                <button onClick={() => setShowHoursModal(true)} className="flex items-center gap-2 h-10 px-4 bg-white border border-gray-300 hover:border-[#1b3a26] text-gray-700 hover:text-[#1b3a26] rounded-lg text-sm font-bold transition shadow-sm">
                    <Clock size={18}/> <span>{String(hoursFrom).padStart(2,'0')}-{String(hoursTo).padStart(2,'0')}</span>
                </button>
                <button onClick={() => setShowColumnsModal(true)} className="flex items-center gap-2 h-10 px-4 bg-white border border-gray-300 hover:border-[#1b3a26] text-gray-700 hover:text-[#1b3a26] rounded-lg text-sm font-bold transition shadow-sm">
                    <Settings size={18}/> <span className="hidden sm:inline">Kolone</span>
                </button>
                <div className="h-8 w-px bg-gray-300 mx-1 hidden xl:block"></div>
                <button onClick={handleSave} className="flex items-center gap-2 h-10 px-6 bg-[#ffc72c] hover:bg-[#e0af25] text-[#1b3a26] rounded-lg text-sm font-black shadow-md transition transform hover:scale-105">
                    <Save size={18}/> SPREMI
                </button>
                <button onClick={handleExport} className="flex items-center gap-2 h-10 px-6 bg-[#1b3a26] hover:bg-[#142e1e] text-white rounded-lg text-sm font-black shadow-md transition transform hover:scale-105">
                    <FileText size={18}/> PDF
                </button>
                <button onClick={() => alert("MEO funkcionalnost je trenutno u izradi!")} className="flex items-center gap-2 h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-black shadow-md transition transform hover:scale-105 ml-2">
                    MEO <AlertCircle size={18}/>
                </button>
            </div>
        </div>
      </header>

      {/* --- KPI BAR --- */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-2 flex items-center justify-center shrink-0">
         <div className="flex gap-8 bg-white px-6 py-2 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-baseline gap-2">
                <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Promet</span>
                <span className="font-black text-xl text-[#1b3a26]">{fmtCurr(totals.sumRev)}</span>
            </div>
            <div className="w-px bg-gray-200"></div>
            <div className="flex items-baseline gap-2">
                <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Sati</span>
                <span className="font-black text-xl text-[#1b3a26]">{fmtNum(totals.sumStaff)}</span>
            </div>
            <div className="w-px bg-gray-200"></div>
            <div className="flex items-baseline gap-2">
                <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Produktivnost</span>
                <span className="font-black text-xl text-white bg-[#1b3a26] px-2 py-0.5 rounded-lg shadow-sm">{fmtCurr(totals.avgProd)}</span>
            </div>
         </div>
      </div>

      {/* --- TABLICA --- */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        <div className="bg-white rounded-xl shadow border border-gray-200 w-full overflow-hidden">
            <div className="overflow-x-auto relative" style={{ maxHeight: "calc(100vh - 220px)" }}>
                <table className="w-full text-xs border-collapse">
                    <thead className="bg-[#1b3a26] text-white sticky top-0 z-20 shadow-md">
                        <tr>
                            <th className="p-3 w-16 text-left border-r border-white/10 font-bold sticky left-0 bg-[#1b3a26] z-30">Sat</th>
                            <th className="p-3 w-28 text-center border-r border-white/10 bg-[#ffc72c] text-[#1b3a26] font-bold shadow-inner sticky left-16 z-30">PROMET</th>
                            {activeColumns.map(s => (
                                <th key={s.key} className="p-3 min-w-[70px] text-center border-r border-white/10 font-medium whitespace-nowrap">
                                    {s.label}
                                </th>
                            ))}
                            <th className="p-3 w-20 text-center bg-[#142e1e] font-bold border-l border-white/10">Σ MA</th>
                            <th className="p-3 w-20 text-center bg-[#142e1e] font-bold">Prod.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {totals.rowStats.map((stat, idx) => (
                            <tr key={stat.h} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50 transition-colors duration-150`}>
                                <td className={`p-2 font-bold text-gray-500 border-r border-gray-200 text-center sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                    {String(stat.h).padStart(2, '0')}:00
                                </td>
                                <td className="p-0 border-r border-gray-200 bg-yellow-50/30 sticky left-16 z-10">
                                    <input 
                                        type="text"
                                        value={rows[stat.h]?.rev || ""}
                                        onChange={(e) => handleInputChange(stat.h, "rev", e.target.value)}
                                        className="w-full h-9 bg-transparent text-center font-bold text-gray-900 text-sm focus:bg-white focus:ring-2 focus:ring-inset focus:ring-[#ffc72c] outline-none transition-all"
                                        placeholder="0"
                                    />
                                </td>
                                {activeColumns.map(s => (
                                    <td key={s.key} className="p-0 border-r border-gray-200">
                                        <input 
                                            type="text"
                                            value={rows[stat.h]?.[s.key] || ""}
                                            onChange={(e) => handleInputChange(stat.h, s.key, e.target.value)}
                                            className="w-full h-9 bg-transparent text-center text-gray-600 font-medium focus:bg-white focus:ring-2 focus:ring-inset focus:ring-[#1b3a26] outline-none transition-all hover:bg-gray-100/50"
                                            placeholder="-"
                                        />
                                    </td>
                                ))}
                                <td className="p-2 text-center font-bold text-gray-800 bg-gray-100 border-l border-gray-200">{fmtNum(stat.staff)}</td>
                                <td className={`p-2 text-center font-bold border-l border-gray-200 ${stat.prod > 0 ? 'text-[#1b3a26]' : 'text-gray-300'}`}>
                                    {stat.prod > 0 ? fmtNum(stat.prod) : "-"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300 sticky bottom-0 z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
                        <tr>
                            <td className="p-3 text-left text-sm pl-4 text-gray-600 sticky left-0 bg-gray-100 z-30">UKUPNO</td>
                            <td className="p-3 text-center text-[#1b3a26] bg-yellow-100/80 text-sm border-r border-gray-300 sticky left-16 z-30">{fmtCurr(totals.sumRev)}</td>
                            {activeColumns.map(s => <td key={s.key} className="border-r border-gray-300"></td>)}
                            <td className="p-3 text-center text-sm border-r border-gray-300 bg-white">{fmtNum(totals.sumStaff)}</td>
                            <td className="p-3 text-center text-[#1b3a26] text-sm bg-white">{fmtCurr(totals.avgProd)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
      </div>

      {/* --- MODAL ZA SATE --- */}
      {showHoursModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm transform scale-100 transition-all border border-gray-100">
                <div className="text-center mb-6">
                    <h3 className="font-black text-2xl text-[#1b3a26] uppercase">Radno Vrijeme</h3>
                    <p className="text-gray-400 text-xs font-bold uppercase mt-1">Postavi interval</p>
                </div>
                
                <div className="flex gap-4 mb-8">
                    <div className="flex-1 group">
                        <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase text-center group-focus-within:text-[#1b3a26] transition">Početak (h)</label>
                        <input 
                            type="number" min="0" max="23" 
                            value={hoursFrom} onChange={e => setHoursFrom(Number(e.target.value))} 
                            className="w-full border-2 border-gray-200 p-4 rounded-xl focus:border-[#ffc72c] focus:ring-0 outline-none font-black text-4xl text-center text-[#1b3a26] bg-gray-50 focus:bg-white transition"
                        />
                    </div>
                    <div className="flex items-center text-gray-300 pt-6">➔</div>
                    <div className="flex-1 group">
                        <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase text-center group-focus-within:text-[#1b3a26] transition">Kraj (h)</label>
                        <input 
                            type="number" min="0" max="23" 
                            value={hoursTo} onChange={e => setHoursTo(Number(e.target.value))} 
                            className="w-full border-2 border-gray-200 p-4 rounded-xl focus:border-[#ffc72c] focus:ring-0 outline-none font-black text-4xl text-center text-[#1b3a26] bg-gray-50 focus:bg-white transition"
                        />
                    </div>
                </div>

                <button 
                    onClick={() => setShowHoursModal(false)} 
                    className="w-full bg-[#1b3a26] text-white py-4 rounded-xl font-black text-sm hover:bg-[#142e1e] transition-colors shadow-lg uppercase tracking-wider active:scale-95 duration-150"
                >
                    Potvrdi Promjene
                </button>
            </div>
        </div>
      )}

      {/* --- MODAL ZA KOLONE --- */}
      {showColumnsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col border border-gray-100">
                <div className="flex justify-between items-center mb-6 border-b pb-4 shrink-0">
                    <h3 className="font-black text-lg text-[#1b3a26] uppercase flex items-center gap-2">
                        <Settings size={20} className="text-[#ffc72c]"/> Postavke Kolona
                    </h3>
                    <button onClick={() => setShowColumnsModal(false)} className="p-1 hover:bg-gray-100 rounded-full transition"><X size={20} className="text-gray-400"/></button>
                </div>
                
                <div className="overflow-auto flex-1 pr-2 custom-scrollbar">
                    {/* Standardne */}
                    <div className="mb-6">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-3 tracking-wider">Standardna Radna Mjesta</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {DEFAULT_STATIONS.map(s => (
                                <button
                                    key={s.key}
                                    onClick={() => {
                                        if (hiddenColumns.includes(s.key)) setHiddenColumns(prev => prev.filter(k => k !== s.key));
                                        else setHiddenColumns(prev => [...prev, s.key]);
                                    }}
                                    className={`p-3 rounded-xl text-xs font-bold flex justify-between items-center transition border-2 ${
                                        !hiddenColumns.includes(s.key)
                                        ? 'bg-green-50 border-green-500 text-green-800 shadow-sm'
                                        : 'bg-white border-gray-100 text-gray-400'
                                    }`}
                                >
                                    {s.label} {!hiddenColumns.includes(s.key) && <Check size={14} strokeWidth={3}/>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom */}
                    <div className="mb-2">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Moja Radna Mjesta (Max 3)</h4>
                            <span className="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-500">{customStations.length}/3</span>
                        </div>
                        
                        <div className="space-y-2 mb-3">
                            {customStations.map(s => (
                                <div key={s.key} className="flex items-center gap-2 p-2 border-2 rounded-xl bg-yellow-50 border-[#ffc72c]/30">
                                    <button 
                                        onClick={() => {
                                            if (hiddenColumns.includes(s.key)) setHiddenColumns(prev => prev.filter(k => k !== s.key));
                                            else setHiddenColumns(prev => [...prev, s.key]);
                                        }}
                                        className={`flex-1 text-left text-xs font-bold flex items-center gap-2 ${hiddenColumns.includes(s.key) ? 'text-gray-400' : 'text-gray-800'}`}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${!hiddenColumns.includes(s.key) ? 'bg-[#1b3a26] border-[#1b3a26]' : 'border-gray-300'}`}>
                                            {!hiddenColumns.includes(s.key) && <Check size={10} className="text-white" strokeWidth={3}/>}
                                        </div>
                                        {s.label}
                                    </button>
                                    <button onClick={() => removeCustomStation(s.key)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                        
                        {customStations.length < 3 && (
                            <div className="flex gap-2 items-center border-2 border-dashed border-gray-300 p-1.5 rounded-xl hover:border-gray-400 transition focus-within:border-[#1b3a26] focus-within:bg-white bg-gray-50">
                                <input 
                                    type="text" 
                                    placeholder="Naziv novog mjesta..." 
                                    value={newColName}
                                    onChange={(e) => setNewColName(e.target.value)}
                                    className="flex-1 p-2 text-xs outline-none bg-transparent font-bold placeholder-gray-400 text-gray-800"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddCustomStation()}
                                />
                                <button 
                                    onClick={handleAddCustomStation} 
                                    className={`p-2 rounded-lg transition ${newColName.trim() ? 'bg-[#1b3a26] text-white hover:bg-[#142e1e] shadow-md' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                    disabled={!newColName.trim()}
                                >
                                    <Plus size={16} strokeWidth={3}/>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <button onClick={() => setShowColumnsModal(false)} className="w-full bg-gray-100 text-gray-800 py-3 rounded-xl font-black text-xs mt-4 hover:bg-gray-200 shrink-0 uppercase tracking-wide transition">Zatvori</button>
            </div>
        </div>
      )}

    </div>
  );
}