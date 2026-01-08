"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Save, Printer, Settings, 
  TrendingUp, CheckCircle, AlertTriangle, RefreshCw,
  X, Filter, Clock, CalendarDays
} from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getProductivityData, saveProductivityReport, saveOpeningHours, getMonthlyProductivityData } from "@/app/actions/productivityActions";

// --- KONFIGURACIJA ---
const ALL_STATIONS = [
  { key: "ausgabe", label: "Ausg." },
  { key: "kitch", label: "Kuhinja" },
  { key: "lobby", label: "Lobby" },
  { key: "cafe", label: "McCafé" },
  { key: "drive", label: "Drive" },
  { key: "drinks", label: "Getr." },
  { key: "front", label: "Kasa" },
  { key: "table", label: "T.Serv." },
  { key: "fries", label: "Pom." },
  { key: "sf", label: "SF Prod." },
  { key: "pause", label: "Pause(-)" }
];

const DAYS = ["mo","di","mi","do","fr","sa","so"];
const DAY_NAMES: any = {mo:"Ponedjeljak", di:"Utorak", mi:"Srijeda", do:"Četvrtak", fr:"Petak", sa:"Subota", so:"Nedjelja"};
const DEFAULT_HOURS = { from: 7, to: 1 };

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: `${String(i).padStart(2, '0')}:00`
}));

// Helper za učitavanje slike
const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
    });
};

function ProductivityContent() {
  const router = useRouter();
  const chartRef = useRef<any>(null);

  // GLOBAL STATE
  const [restId, setRestId] = useState<string | null>(null);
  const [restName, setRestName] = useState("");
  
  // DATA STATE
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dayType, setDayType] = useState("mo");
  
  const [tableData, setTableData] = useState<any>({});
  const [hoursConfig, setHoursConfig] = useState<any>({});
  
  // SETTINGS & UI
  const [targetProd, setTargetProd] = useState(120);
  const [netCoeff, setNetCoeff] = useState(1.17);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isHoursModalOpen, setIsHoursModalOpen] = useState(false);
  const [totals, setTotals] = useState({ gross: 0, net: 0, hours: 0, prod: 0 });

  // VISIBILITY STATE
  const [visibleStations, setVisibleStations] = useState<string[]>(ALL_STATIONS.map(s => s.key));

  // --- INIT ---
  useEffect(() => {
    const id = localStorage.getItem("selected_restaurant_id");
    const name = localStorage.getItem("selected_restaurant_name");
    if (!id) { router.push("/select-restaurant"); return; }
    setRestId(id);
    setRestName(name || "");
  }, [router]);

  useEffect(() => {
    if (restId && date) {
      loadData();
      const d = new Date(date);
      const dayIndex = d.getDay(); 
      const map = ["so", "mo", "di", "mi", "do", "fr", "sa"];
      setDayType(map[dayIndex]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restId, date]);

  // --- LOGIC ---
  const loadData = async () => {
    if(!restId) return;
    setIsLoading(true);
    const { report, openingHours } = await getProductivityData(restId, date);
    
    if(openingHours) setHoursConfig(openingHours);
    if(report) {
      setTableData(report.hourlyData || {});
      setTargetProd(report.targetProd);
      setNetCoeff(report.netCoeff);
    } else {
      setTableData({});
    }
    setIsLoading(false);
  };

  useEffect(() => {
    calculateTotals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableData, netCoeff, visibleStations]); 

  const calculateTotals = () => {
    let gross = 0, hours = 0;
    const activeStations = ALL_STATIONS.filter(s => visibleStations.includes(s.key));

    Object.values(tableData).forEach((row: any) => {
        gross += Number(row.gross) || 0;
        activeStations.forEach(s => {
            const val = Number(row[s.key]) || 0;
            if (s.key === 'pause') hours -= val;
            else hours += val;
        });
    });
    
    const net = gross / netCoeff;
    const prod = hours > 0 ? net / hours : 0;
    
    setTotals({ gross, net, hours, prod });
  };

  const handleCellChange = (h: number, field: string, value: string) => {
    setTableData((prev: any) => ({
        ...prev,
        [h]: { ...prev[h], [field]: value }
    }));
  };

  const handleSave = async () => {
    if(!restId) return;
    setIsLoading(true);
    await saveProductivityReport(restId, date, tableData, targetProd, netCoeff);
    setIsLoading(false);
    alert("✅ Podaci sačuvani u bazu!");
  };

  const handleSaveHours = async () => {
    if(!restId) return;
    await saveOpeningHours(restId, hoursConfig);
    setIsHoursModalOpen(false);
    alert("✅ Radno vrijeme sačuvano!");
  };

  const toggleStation = (key: string) => {
    setVisibleStations(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key) 
        : [...prev, key]
    );
  };

  const updateHoursConfigState = (day: string, type: 'from' | 'to', val: number) => {
      setHoursConfig((prev: any) => ({
          ...prev,
          [day]: {
              ...(prev[day] || DEFAULT_HOURS),
              [type]: val
          }
      }));
  };

  const getDayHours = () => hoursConfig?.[dayType] || DEFAULT_HOURS;
  const { from, to } = getDayHours();
  const hoursArray: number[] = []; 
  let h = from;
  let safety = 0;
  while (h !== to && safety < 24) {
      hoursArray.push(h);
      h = (h + 1) % 24;
      safety++;
  }

  // --- ZAJEDNIČKA FUNKCIJA ZA CRTANJE STRANICE ---
  const generatePageContent = (
      doc: any, 
      pageDate: string, 
      pageData: any, 
      pageTarget: number, 
      pageCoeff: number, 
      logo: HTMLImageElement | null
  ) => {
      // Filtrirane stanice
      const activeStations = ALL_STATIONS.filter(s => visibleStations.includes(s.key));

      // Header Pozadina
      doc.setFillColor(26, 56, 38);
      doc.rect(0, 0, 297, 30, 'F'); 

      // LOGO (Desno gore, manji i elegantniji)
      if (logo) {
          // x=250, y=5, w=30, h=15
          doc.addImage(logo, 'PNG', 250, 7, 30, 15); 
      }

      // Naslov
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20); doc.setFont("helvetica", 'bold');
      doc.text("DNEVNI PLAN PRODUKTIVNOSTI", 14, 18);
      
      // Info linija
      doc.setFontSize(10); doc.setFont("helvetica", 'normal');
      doc.text(`Restoran: ${restName} | Datum: ${pageDate}`, 14, 25);
      doc.text(`Cilj: ${pageTarget} | Koef: ${pageCoeff}`, 240, 25, {align:'right'}); // Pomjereno lijevo od loga

      // Priprema podataka za tabelu
      const hours = Object.keys(pageData).map(Number).sort((a,b) => a - b);
      const morningHours = hours.filter(h => h < 5);
      const dayHours = hours.filter(h => h >= 5);
      const sortedHours = [...dayHours, ...morningHours];
      const finalHours = sortedHours.length > 0 ? sortedHours : Array.from({length:17}, (_,i)=>i+7);

      const bodyRows = finalHours.map(h => {
          const row = pageData[h] || {};
          const g = Number(row.gross) || 0;
          const n = g / pageCoeff;
          
          let rowHrs = 0;
          activeStations.forEach(s => {
              const v = Number(row[s.key]) || 0;
              if(s.key === 'pause') rowHrs -= v;
              else rowHrs += v;
          });
          
          const p = rowHrs > 0 ? n / rowHrs : 0;

          return [
              `${('0'+h).slice(-2)}:00`,
              g.toFixed(2),
              n.toFixed(2),
              ...activeStations.map(s => (Number(row[s.key]) || 0).toFixed(1)),
              rowHrs.toFixed(1),
              p.toFixed(0)
          ];
      });

      // Totals za footer
      let tGross = 0, tNet = 0, tHours = 0;
      bodyRows.forEach((r: any) => {
          tGross += Number(r[1]);
          tNet += Number(r[2]);
          tHours += Number(r[r.length-2]);
      });
      const tProd = tHours > 0 ? tNet / tHours : 0;

      // Col Totals (Stations)
      const stationTotals = activeStations.map((s, idx) => {
          return finalHours.reduce((acc, h) => acc + (Number(pageData[h]?.[s.key]) || 0), 0).toFixed(1);
      });

      bodyRows.push([
          "TOTAL",
          tGross.toFixed(2),
          tNet.toFixed(2),
          ...stationTotals,
          tHours.toFixed(1),
          tProd.toFixed(0)
      ]);

      autoTable(doc, {
          head: [['Sat', 'Bruto', 'Neto', ...activeStations.map(s => s.label), 'Sati', 'Prod.']],
          body: bodyRows,
          startY: 35,
          theme: 'grid',
          headStyles: { 
              fillColor: [26, 56, 38], 
              textColor: 255, 
              fontSize: 8, 
              halign: 'center',
              lineWidth: 0.1,
              lineColor: [200, 200, 200]
          },
          styles: { 
              fontSize: 8, 
              halign: 'center', 
              cellPadding: 1.5, 
              lineColor: [220, 220, 220], 
              lineWidth: 0.1 
          },
          columnStyles: {
              0: { fontStyle: 'bold', fillColor: [245, 245, 245] },
              1: { fontStyle: 'bold' },
              2: { fontStyle: 'bold', textColor: [26, 56, 38] },
              [activeStations.length + 4]: { fontStyle: 'bold', fillColor: [255, 248, 220] }
          },
          didParseCell: (data) => {
              if (data.row.index === bodyRows.length - 1) {
                  data.cell.styles.fillColor = [255, 199, 44];
                  data.cell.styles.textColor = [0, 0, 0];
                  data.cell.styles.fontStyle = 'bold';
              }
          }
      });
  };

  const exportDailyPDF = async () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    let logo = null;
    try { logo = await loadImage('/logo.png'); } catch (e) {}
    generatePageContent(doc, date, tableData, targetProd, netCoeff, logo);
    doc.save(`Produktivnost_Dnevni_${date}.pdf`);
  };

  const exportMonthlyPDF = async () => {
    if(!restId) return;
    setIsExporting(true);

    try {
        const yearMonth = date.substring(0, 7); 
        const monthlyData = await getMonthlyProductivityData(restId, yearMonth);
        
        if (monthlyData.length === 0) {
            alert("Nema sačuvanih podataka za ovaj mjesec.");
            return;
        }

        const doc = new jsPDF('l', 'mm', 'a4'); 
        let logo = null;
        try { logo = await loadImage('/logo.png'); } catch (e) {}

        monthlyData.forEach((report: any, index: number) => {
            if (index > 0) doc.addPage();
            const hData = typeof report.hourlyData === 'string' ? JSON.parse(report.hourlyData) : report.hourlyData;
            generatePageContent(
                doc, 
                report.date, 
                hData, 
                report.targetProd, 
                report.netCoeff, 
                logo
            );
        });

        doc.save(`Produktivnost_Mjesec_${yearMonth}.pdf`);

    } catch (error) {
        console.error(error);
        alert("Greška pri generisanju mjesečnog izvještaja.");
    } finally {
        setIsExporting(false);
    }
  };

  if(!restId) return null;

  const activeStations = ALL_STATIONS.filter(s => visibleStations.includes(s.key));

  return (
    <div className="h-screen w-full overflow-hidden bg-[#F8FAFC] flex flex-col font-sans text-slate-800">
      
      {/* HEADER */}
      <div className="bg-[#1a3826] text-white pt-4 pb-6 px-6 shadow-md relative z-10 flex-shrink-0">
          <div className="max-w-[1800px] mx-auto flex flex-col md:flex-row justify-between items-end gap-4">
              <div>
                  <button onClick={() => router.back()} className="flex items-center gap-2 text-white/70 font-bold hover:text-white mb-2 text-xs">
                      <ArrowLeft className="w-3 h-3" /> Nazad
                  </button>
                  <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                      CL Alat <span className="text-[#FFC72C]">v2.5</span>
                      {(isLoading || isExporting) && <RefreshCw className="animate-spin w-4 h-4 text-white/50"/>}
                  </h1>
                  <p className="text-emerald-100 text-xs opacity-80">{restName} • Planiranje Produktivnosti</p>
              </div>
              <div className="flex gap-2">
                  <button onClick={exportMonthlyPDF} disabled={isExporting} className="bg-slate-700 text-white px-4 py-2 rounded font-bold text-xs flex items-center gap-2 shadow hover:bg-slate-600 disabled:opacity-50">
                      <CalendarDays size={14}/> {isExporting ? "Generisanje..." : "Mjesečni PDF"}
                  </button>
                  <button onClick={exportDailyPDF} className="bg-[#FFC72C] text-[#1a3826] px-4 py-2 rounded font-bold text-xs flex items-center gap-2 shadow hover:bg-yellow-400">
                      <Printer size={14}/> Dnevni PDF
                  </button>
                  <button onClick={handleSave} className="bg-white text-[#1a3826] px-4 py-2 rounded font-bold text-xs flex items-center gap-2 shadow hover:bg-gray-100">
                      <Save size={14}/> Sačuvaj
                  </button>
              </div>
          </div>
      </div>

      {/* TOOLBAR */}
      <div className="bg-white border-b border-slate-200 p-4 shadow-sm flex-shrink-0">
          <div className="max-w-[1800px] mx-auto grid grid-cols-2 md:grid-cols-6 gap-4 items-end">
              <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Datum</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border rounded p-2 text-sm font-bold bg-slate-50"/>
              </div>
              <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Cilj (Neto/h)</label>
                  <input type="number" value={targetProd} onChange={e => setTargetProd(Number(e.target.value))} className="w-full border rounded p-2 text-sm font-bold"/>
              </div>
              <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Neto Koeficijent</label>
                  <input type="number" step="0.01" value={netCoeff} onChange={e => setNetCoeff(Number(e.target.value))} className="w-full border rounded p-2 text-sm font-bold text-blue-600 bg-blue-50"/>
              </div>
              <div className="col-span-2 flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setIsHoursModalOpen(true)}>
                  <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Radno Vrijeme ({DAY_NAMES[dayType]})</span>
                      <span className="font-bold text-[#1a3826] text-sm flex items-center gap-2">
                        <Clock size={14}/>
                        {('0'+from).slice(-2)}:00 - {('0'+to).slice(-2)}:00
                      </span>
                  </div>
                  <Settings size={16} className="text-slate-400"/>
              </div>
          </div>
      </div>

      {/* FILTER CHIPS */}
      <div className="px-4 pt-4 flex-shrink-0">
          <div className="max-w-[1800px] mx-auto flex flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-2"><Filter size={12}/> Prikaz:</span>
              {ALL_STATIONS.map(s => (
                  <button 
                    key={s.key}
                    onClick={() => toggleStation(s.key)}
                    className={`text-[10px] px-2 py-1 rounded-full border transition-all font-bold flex items-center gap-1 ${visibleStations.includes(s.key) ? 'bg-[#1a3826] text-white border-[#1a3826]' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'}`}
                  >
                    {visibleStations.includes(s.key) && <CheckCircle size={10}/>} {s.label}
                  </button>
              ))}
          </div>
      </div>

      {/* KPI CARDS */}
      <div className="p-4 bg-[#F8FAFC] flex-shrink-0">
          <div className="max-w-[1800px] mx-auto grid grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border shadow-sm">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Ukupno Bruto</div>
                  <div className="text-xl font-black text-slate-800">{totals.gross.toLocaleString('bs-BA')} <span className="text-xs font-normal text-slate-400">KM</span></div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm bg-blue-50/30">
                  <div className="text-[10px] uppercase font-bold text-blue-400">Ukupno Neto</div>
                  <div className="text-xl font-black text-blue-700">{totals.net.toLocaleString('bs-BA', {maximumFractionDigits:0})} <span className="text-xs font-normal text-blue-400">KM</span></div>
              </div>
              <div className="bg-white p-4 rounded-xl border shadow-sm">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Ukupno Sati</div>
                  <div className="text-xl font-black text-orange-600">{totals.hours.toFixed(1)} <span className="text-xs font-normal text-slate-400">h</span></div>
              </div>
              <div className={`p-4 rounded-xl border shadow-sm flex justify-between items-center ${totals.prod >= targetProd ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <div>
                      <div className={`text-[10px] uppercase font-bold ${totals.prod >= targetProd ? 'text-emerald-600' : 'text-red-500'}`}>Produktivnost</div>
                      <div className={`text-2xl font-black ${totals.prod >= targetProd ? 'text-emerald-700' : 'text-red-600'}`}>{totals.prod.toFixed(0)}</div>
                  </div>
                  {totals.prod >= targetProd ? <CheckCircle className="text-emerald-500 w-8 h-8"/> : <AlertTriangle className="text-red-500 w-8 h-8"/>}
              </div>
          </div>
      </div>

      {/* TABLE */}
      <div className="flex-grow overflow-auto px-4 pb-4">
          <div className="max-w-[1800px] mx-auto bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
              <table className="w-full text-center text-xs border-collapse">
                  <thead className="bg-[#1a3826] text-white font-bold uppercase sticky top-0 z-20">
                      <tr>
                          <th className="p-3 w-16 text-left pl-4">Sat</th>
                          <th className="p-3 w-24 bg-white/10 border-r border-white/20">Bruto (KM)</th>
                          <th className="p-3 w-24 bg-[#FFC72C] text-[#1a3826] border-r border-white/20">Neto (KM)</th>
                          {activeStations.map(s => <th key={s.key} className="p-3 border-r border-white/10 min-w-[60px]">{s.label}</th>)}
                          <th className="p-3 w-20 bg-slate-700">Sati</th>
                          <th className="p-3 w-20 bg-slate-800">Prod.</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                      {hoursArray.map(h => {
                          const row = tableData[h] || {};
                          const gross = Number(row.gross) || 0;
                          const net = gross / netCoeff;
                          
                          let rowHrs = 0;
                          activeStations.forEach(s => {
                              const v = Number(row[s.key]) || 0;
                              if(s.key === 'pause') rowHrs -= v;
                              else rowHrs += v;
                          });
                          
                          const prod = rowHrs > 0 ? net / rowHrs : 0;

                          return (
                              <tr key={h} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-2 text-left pl-4 font-bold text-slate-500 bg-slate-50 border-r">{('0'+h).slice(-2)}:00</td>
                                  
                                  <td className="p-0 border-r bg-white">
                                      <input type="number" 
                                          className="w-full h-full p-2 text-center outline-none bg-transparent font-bold text-slate-700 focus:bg-blue-50"
                                          placeholder="0"
                                          value={row.gross || ""}
                                          onChange={e => handleCellChange(h, 'gross', e.target.value)}
                                      />
                                  </td>

                                  <td className="p-2 border-r bg-yellow-50 text-[#1a3826] font-bold">
                                      {gross > 0 ? net.toFixed(0) : "-"}
                                  </td>

                                  {activeStations.map(s => (
                                      <td key={s.key} className="p-0 border-r">
                                          <input type="number" 
                                              className="w-full h-full p-2 text-center outline-none bg-transparent text-slate-600 focus:bg-emerald-50 placeholder:text-slate-200"
                                              placeholder="-"
                                              value={row[s.key] || ""}
                                              onChange={e => handleCellChange(h, s.key, e.target.value)}
                                          />
                                      </td>
                                  ))}

                                  <td className="p-2 font-bold bg-slate-50 border-r text-orange-600">{rowHrs > 0 ? rowHrs.toFixed(1) : "-"}</td>
                                  <td className={`p-2 font-bold ${prod >= targetProd ? 'text-emerald-600 bg-emerald-50' : prod > 0 ? 'text-red-500 bg-red-50' : 'text-slate-300'}`}>
                                      {prod > 0 ? prod.toFixed(0) : "-"}
                                  </td>
                              </tr>
                          )
                      })}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold text-slate-800 sticky bottom-0 z-20 border-t-2 border-slate-300">
                      <tr>
                          <td className="p-3 text-left pl-4">TOTAL</td>
                          <td className="p-3 border-r">{totals.gross.toFixed(0)}</td>
                          <td className="p-3 border-r bg-[#FFC72C]/20">{totals.net.toFixed(0)}</td>
                          <td colSpan={activeStations.length} className="p-3 border-r text-[10px] uppercase text-slate-400 tracking-widest text-center">Raspodjela Sati</td>
                          <td className="p-3 border-r text-orange-600">{totals.hours.toFixed(1)}</td>
                          <td className={`p-3 ${totals.prod >= targetProd ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{totals.prod.toFixed(0)}</td>
                      </tr>
                  </tfoot>
              </table>
          </div>
      </div>

      {/* HOURS MODAL (REDESIGNED) */}
      {isHoursModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
                
                {/* Modal Header */}
                <div className="p-5 border-b bg-[#1a3826] text-white flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-lg flex items-center gap-2"><Clock size={18} className="text-[#FFC72C]"/> Podešavanje Radnog Vremena</h3>
                        <p className="text-xs text-white/70 mt-1">Definišite početak i kraj smjene za svaki dan.</p>
                    </div>
                    <button onClick={() => setIsHoursModalOpen(false)} className="text-white/70 hover:text-white transition-colors"><X size={24}/></button>
                </div>

                {/* Modal Body */}
                <div className="p-6 max-h-[60vh] overflow-y-auto bg-slate-50">
                    <div className="grid grid-cols-1 gap-3">
                        {DAYS.map(d => {
                            const h = hoursConfig?.[d] || DEFAULT_HOURS;
                            return (
                                <div key={d} className="grid grid-cols-12 items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:border-[#1a3826]/30 transition-all">
                                    
                                    {/* Dan */}
                                    <div className="col-span-4 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-[#1a3826]/10 flex items-center justify-center text-[#1a3826] font-bold text-xs">
                                            {d.substring(0,2).toUpperCase()}
                                        </div>
                                        <span className="font-bold text-sm text-slate-700 uppercase">{DAY_NAMES[d]}</span>
                                    </div>

                                    {/* Selectori */}
                                    <div className="col-span-8 flex items-center justify-end gap-2">
                                        
                                        {/* FROM */}
                                        <div className="flex flex-col">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 ml-1">Od</label>
                                            <select 
                                                value={h.from} 
                                                onChange={(e) => updateHoursConfigState(d, 'from', Number(e.target.value))}
                                                className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-[#1a3826] focus:border-[#1a3826] block p-2.5 font-bold outline-none"
                                            >
                                                {TIME_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                        </div>

                                        <div className="h-[1px] w-4 bg-slate-300 mt-5"></div>

                                        {/* TO */}
                                        <div className="flex flex-col">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 ml-1">Do</label>
                                            <select 
                                                value={h.to} 
                                                onChange={(e) => updateHoursConfigState(d, 'to', Number(e.target.value))}
                                                className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-[#1a3826] focus:border-[#1a3826] block p-2.5 font-bold outline-none"
                                            >
                                                {TIME_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                        </div>

                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-5 border-t bg-white flex justify-end gap-3">
                    <button onClick={() => setIsHoursModalOpen(false)} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-lg text-sm">Odustani</button>
                    <button onClick={handleSaveHours} className="bg-[#1a3826] text-white px-6 py-2.5 rounded-lg font-bold text-sm shadow-lg hover:bg-[#264f36] flex items-center gap-2">
                        <Save size={16}/> Sačuvaj Izmjene
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}

// 2. Eksportujemo "omotanu" komponentu u Suspense
export default function ProductivityPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-[#1a3826] font-bold">Učitavanje alata...</div>}>
      <ProductivityContent />
    </Suspense>
  );
}