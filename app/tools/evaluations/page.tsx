"use client";

import { useState, useEffect, useRef, Suspense } from "react"; // Dodan Suspense
import { useRouter, useSearchParams } from "next/navigation";
import { 
  ArrowLeft, Save, Printer, Trash2, Settings, 
  User, Calendar, CheckCircle, Plus, X, ChevronRight, BarChart3, MinusCircle 
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// --- TIPOVI ---
interface Goal {
  id: number;
  title: string;
  result: string;
  points: number;
}

interface Range {
  from: number;
  to: number;
  pts: number;
}

interface ScaleLevel {
  label: string;
  min: number;
  max: number;
  colorHex: string; 
  colorName: string; 
}

interface EvaluationData {
  meta: {
    year: string;
    employee: string;
    manager: string;
    commEmp: string;
    commMan: string;
  };
  goals: Goal[];
  ranges: Record<number, Range[]>; 
  scale: ScaleLevel[];
  signatures: {
    emp: string | null; 
    man: string | null;
  };
}

const LS_KEY = "mcd_eval_data_v11"; 

const DEFAULT_SCALE: ScaleLevel[] = [
  { label: "Nezadovoljava", min: 0, max: 59, colorHex: "#dc2626", colorName: "red" },
  { label: "Potrebno poboljšanje", min: 60, max: 79, colorHex: "#ca8a04", colorName: "yellow" },
  { label: "Dobro", min: 80, max: 94, colorHex: "#2563eb", colorName: "blue" },
  { label: "Izvrsno", min: 95, max: 100, colorHex: "#16a34a", colorName: "emerald" }
];

const INITIAL_GOALS: Goal[] = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, title: "", result: "", points: 0 }));

// --- GLAVNA KOMPONENTA (Sada interna funkcija) ---
function EvaluationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const restaurantCode = searchParams.get("restaurant");

  // --- STATE ---
  const [data, setData] = useState<EvaluationData>({
    meta: { year: "2025", employee: "", manager: "", commEmp: "", commMan: "" },
    goals: INITIAL_GOALS,
    ranges: {},
    scale: DEFAULT_SCALE,
    signatures: { emp: null, man: null }
  });

  const [totalScore, setTotalScore] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentSettingId, setCurrentSettingId] = useState<number | 'scale'>(1);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const years = Array.from({ length: 6 }, (_, i) => (2025 + i).toString());
  
  // Refovi
  const sigEmpRef = useRef<HTMLCanvasElement>(null);
  const sigManRef = useRef<HTMLCanvasElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // --- INIT ---
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.scale) parsed.scale = DEFAULT_SCALE;
        if (!parsed.goals || parsed.goals.length === 0) parsed.goals = INITIAL_GOALS; 
        setData(parsed);
        setTimeout(() => {
          loadSigToCanvas(sigEmpRef.current, parsed.signatures.emp);
          loadSigToCanvas(sigManRef.current, parsed.signatures.man);
        }, 500);
      } catch (e) { console.error(e); }
    }
    setupCanvas(sigEmpRef.current, 'emp');
    setupCanvas(sigManRef.current, 'man');
  }, []);

  useEffect(() => {
    const sum = data.goals.reduce((acc, g) => acc + (Number(g.points) || 0), 0);
    setTotalScore(sum);
  }, [data.goals]);

  // --- CANVAS FUNKCIJE ---
  const setupCanvas = (canvas: HTMLCanvasElement | null, type: 'emp' | 'man') => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#000000";
    let drawing = false;
    const start = (e: any) => {
      drawing = true;
      ctx.beginPath();
      const r = canvas.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      ctx.moveTo(x, y);
    };
    const move = (e: any) => {
      if (!drawing) return;
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      ctx.lineTo(x, y);
      ctx.stroke();
    };
    const end = () => {
      drawing = false;
      setData(prev => ({ ...prev, signatures: { ...prev.signatures, [type]: canvas.toDataURL() } }));
    };
    canvas.addEventListener("mousedown", start); canvas.addEventListener("mousemove", move); canvas.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start); canvas.addEventListener("touchmove", move); canvas.addEventListener("touchend", end);
  };

  const loadSigToCanvas = (canvas: HTMLCanvasElement | null, dataUrl: string | null) => {
    if (!canvas || !dataUrl) return;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => ctx?.drawImage(img, 0, 0);
    img.src = dataUrl;
  };

  const clearSig = (type: 'emp' | 'man') => {
    const canvas = type === 'emp' ? sigEmpRef.current : sigManRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setData(prev => ({ ...prev, signatures: { ...prev.signatures, [type]: null } }));
    }
  };

  // --- LOGIKA CILJEVA ---
  const addGoal = () => {
    setData(prev => {
        const newId = prev.goals.length > 0 ? Math.max(...prev.goals.map(g => g.id)) + 1 : 1;
        return { ...prev, goals: [...prev.goals, { id: newId, title: "", result: "", points: 0 }] };
    });
  };

  const removeGoal = (id: number) => {
      if (data.goals.length <= 1) {
          alert("Morate imati barem jedan cilj.");
          return;
      }
      if(confirm("Obrisati ovaj cilj?")) {
          setData(prev => ({
              ...prev,
              goals: prev.goals.filter(g => g.id !== id),
          }));
          if (currentSettingId === id) setCurrentSettingId(data.goals.find(g => g.id !== id)?.id || 'scale');
      }
  };

  const handleResultChange = (id: number, val: string) => {
    const numVal = parseFloat(val.replace(",", "."));
    let points = 0;
    const goalRanges = data.ranges[id];
    if (goalRanges && !isNaN(numVal)) {
      const found = goalRanges.find(r => numVal >= r.from && numVal <= r.to);
      if (found) points = found.pts;
    }
    updateGoal(id, "result", val, points);
  };

  const updateGoal = (id: number, field: keyof Goal, value: any, newPoints?: number) => {
    setData(prev => ({
      ...prev,
      goals: prev.goals.map(g => {
        if (g.id === id) {
          const updated = { ...g, [field]: value };
          if (newPoints !== undefined) updated.points = newPoints;
          return updated;
        }
        return g;
      })
    }));
  };

  // --- SETTINGS LOGIKA ---
  const addRange = (goalId: number) => {
    setData(prev => ({
      ...prev,
      ranges: { ...prev.ranges, [goalId]: [...(prev.ranges[goalId] || []), { from: 0, to: 0, pts: 0 }] }
    }));
  };
  
  const updateRange = (goalId: number, idx: number, field: keyof Range, val: number) => {
    setData(prev => {
      const list = [...(prev.ranges[goalId] || [])];
      list[idx] = { ...list[idx], [field]: val };
      return { ...prev, ranges: { ...prev.ranges, [goalId]: list } };
    });
  };

  const removeRange = (goalId: number, idx: number) => {
    setData(prev => {
      const list = [...(prev.ranges[goalId] || [])];
      list.splice(idx, 1);
      return { ...prev, ranges: { ...prev.ranges, [goalId]: list } };
    });
  };

  const updateScale = (index: number, field: 'min' | 'max', value: number) => {
    setData(prev => {
        const newScale = [...prev.scale];
        newScale[index] = { ...newScale[index], [field]: value };
        return { ...prev, scale: newScale };
    });
  };

  // --- PDF GENERATOR ---
  const generatePDF = async () => {
    if (!printRef.current) return;
    setIsGeneratingPdf(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const canvas = await html2canvas(printRef.current, { 
        scale: 2,
        useCORS: true, 
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 1200,
        onclone: (clonedDoc) => {
             const styles = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
             styles.forEach(s => s.remove());
        }
      });
      
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "mm", "a4");
      
      const a4WidthMm = 210;
      const a4HeightMm = 297;
      const canvasAspect = canvas.width / canvas.height;
      const a4Aspect = a4WidthMm / a4HeightMm;

      let imgWidthMm, imgHeightMm;

      if (canvasAspect < a4Aspect) {
          imgHeightMm = a4HeightMm;
          imgWidthMm = a4HeightMm * canvasAspect;
      } else {
          imgWidthMm = a4WidthMm;
          imgHeightMm = a4WidthMm / canvasAspect;
      }

      const xOffset = (a4WidthMm - imgWidthMm) / 2;
      const yOffset = (a4HeightMm - imgHeightMm) / 2; 

      pdf.addImage(imgData, "JPEG", xOffset, Math.max(0, yOffset), imgWidthMm, imgHeightMm);
      pdf.save(`Evaluacija_${data.meta.employee || "Zaposlenik"}.pdf`);
    } catch (err: any) {
      alert("Greška: " + (err.message || err));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleReset = () => {
    if(confirm("Da li ste sigurni da želite obrisati sve podatke i vratiti na početno?")) {
        localStorage.removeItem(LS_KEY);
        window.location.reload();
    }
  }

  return (
    <div className="h-screen w-full overflow-y-auto bg-[#F8FAFC] flex flex-col font-sans">
      
      {/* --- HIDDEN PRINT CONTAINER --- */}
      <div style={{ position: "fixed", top: 0, left: "-9999px", width: "800px", zIndex: -10 }}>
        <div ref={printRef} style={{ backgroundColor: "#ffffff", color: "#000000", padding: "0", fontFamily: "sans-serif", paddingBottom: "20px" }}>
            
            {/* PDF HEADER (GREEN) */}
            <div style={{ backgroundColor: "#1a3826", color: "white", padding: "25px 30px", marginBottom: "25px" }}>
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                   <div>
                       <h1 style={{ fontSize: "24px", fontWeight: "900", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>McDonald's</h1>
                       <p style={{ fontSize: "11px", margin: "4px 0 0 0", opacity: 0.8, textTransform: "uppercase", letterSpacing: "2px" }}>Evaluacija Učinka</p>
                   </div>
                   <div style={{ textAlign: "right" }}>
                       <p style={{ fontSize: "20px", fontWeight: "bold", margin: 0, color: "#FFC72C" }}>{data.meta.year}</p>
                       <p style={{ fontSize: "9px", margin: 0, opacity: 0.7 }}>{new Date().toLocaleDateString()}</p>
                   </div>
               </div>
            </div>

            <div style={{ padding: "0 40px" }}>
                {/* Info */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "25px", padding: "15px", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", borderRadius: "6px" }}>
                   <div><span style={{ display:"block", fontSize:"9px", fontWeight:"bold", color:"#64748b", textTransform:"uppercase", marginBottom: "4px" }}>Zaposlenik</span><span style={{ fontSize:"16px", fontWeight:"bold", color: "#1e293b" }}>{data.meta.employee || "-"}</span></div>
                   <div><span style={{ display:"block", fontSize:"9px", fontWeight:"bold", color:"#64748b", textTransform:"uppercase", marginBottom: "4px" }}>Evaluator</span><span style={{ fontSize:"16px", fontWeight:"bold", color: "#1e293b" }}>{data.meta.manager || "-"}</span></div>
                </div>

                {/* Tabela - Dinamicki redovi */}
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", marginBottom: "25px" }}>
                    <thead>
                        <tr style={{ backgroundColor: "#1a3826", color: "white" }}>
                            <th style={{ padding: "10px", textAlign: "left", width: "55%" }}>CILJ / KPI</th>
                            <th style={{ padding: "10px", textAlign: "left", width: "25%" }}>REZULTAT</th>
                            <th style={{ padding: "10px", textAlign: "center", width: "20%", backgroundColor: "#FFC72C", color: "#1a3826", fontWeight: "bold" }}>BODOVI</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.goals.filter(g => g.title || g.result).map(g => (
                            <tr key={g.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                                <td style={{ padding: "10px", fontWeight: "bold", color: "#334155" }}>{g.title}</td>
                                <td style={{ padding: "10px", color: "#475569" }}>{g.result}</td>
                                <td style={{ padding: "10px", textAlign: "center", fontWeight: "bold", fontSize: "14px" }}>{g.points}</td>
                            </tr>
                        ))}
                        {data.goals.filter(g => g.title || g.result).length === 0 && (
                             <tr style={{ borderBottom: "1px solid #e2e8f0" }}><td colSpan={3} style={{ padding: "15px", textAlign: "center", fontStyle: "italic", color: "#94a3b8" }}>Nema unesenih ciljeva.</td></tr>
                        )}
                        <tr style={{ backgroundColor: "#f1f5f9" }}>
                            <td colSpan={2} style={{ padding: "12px", textAlign: "right", fontWeight: "bold", textTransform: "uppercase", fontSize: "12px" }}>UKUPNO BODOVA:</td>
                            <td style={{ padding: "12px", textAlign: "center", fontWeight: "900", fontSize: "18px", color: "#1a3826" }}>{totalScore}</td>
                        </tr>
                    </tbody>
                </table>
                
                {/* Skala */}
                <div style={{ marginBottom: "25px" }}>
                    <h4 style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "8px", color: "#64748b", borderBottom: "1px solid #e2e8f0", paddingBottom: "4px" }}>Skala Uspješnosti</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px", textAlign: "center", fontSize: "9px" }}>
                        {data.scale.map((s, i) => (
                            <div key={i} style={{ border: "1px solid #e2e8f0", borderTop: `3px solid ${s.colorHex}`, padding: "8px", backgroundColor: "#fff", borderRadius: "4px" }}>
                                <strong style={{ display: "block", color: s.colorHex, fontSize: "12px", marginBottom: "2px" }}>{s.min} - {s.max}</strong>
                                <span style={{ color: "#475569" }}>{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Komentari */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "30px" }}>
                    <div style={{ border: "1px solid #e2e8f0", padding: "12px", borderRadius: "6px", height: "100px", backgroundColor: "#fff" }}>
                        <h4 style={{ fontSize: "9px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "6px", color: "#1a3826" }}>Komentar Zaposlenika</h4>
                        <p style={{ fontSize: "10px", fontStyle: "italic", margin: 0, color: "#334155", whiteSpace: "pre-wrap" }}>{data.meta.commEmp || "Nema komentara"}</p>
                    </div>
                    <div style={{ border: "1px solid #e2e8f0", padding: "12px", borderRadius: "6px", height: "100px", backgroundColor: "#fff" }}>
                        <h4 style={{ fontSize: "9px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "6px", color: "#1a3826" }}>Zaključak Managera</h4>
                        <p style={{ fontSize: "10px", fontStyle: "italic", margin: 0, color: "#334155", whiteSpace: "pre-wrap" }}>{data.meta.commMan || "Nema zaključka"}</p>
                    </div>
                </div>

                {/* Potpisi */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", marginTop: "10px" }}>
                     <div style={{ textAlign: "center" }}>
                         {data.signatures.emp ? <img src={data.signatures.emp} style={{ height: "45px", borderBottom: "1px solid #000", marginBottom: "4px", display: "block", margin: "0 auto" }} /> : <div style={{ height: "45px", borderBottom: "1px solid #000", marginBottom: "4px" }}></div>}
                         <p style={{ fontSize: "9px", fontWeight: "bold", textTransform: "uppercase", color: "#64748b" }}>Potpis Zaposlenika</p>
                     </div>
                     <div style={{ textAlign: "center" }}>
                         {data.signatures.man ? <img src={data.signatures.man} style={{ height: "45px", borderBottom: "1px solid #000", marginBottom: "4px", display: "block", margin: "0 auto" }} /> : <div style={{ height: "45px", borderBottom: "1px solid #000", marginBottom: "4px" }}></div>}
                         <p style={{ fontSize: "9px", fontWeight: "bold", textTransform: "uppercase", color: "#64748b" }}>Potpis Evaluatora</p>
                     </div>
                </div>
            </div>

            {/* PDF FOOTER */}
            <div style={{ backgroundColor: "#1a3826", height: "15px", marginTop: "30px" }}></div>
        </div>
      </div>

      {/* --- UI HEADER (KOMPAKTNIJI ZELENI DIZAJN) --- */}
      <div className="bg-[#1a3826] text-white pt-4 pb-6 px-6 shadow-md relative overflow-hidden flex-shrink-0 z-10">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#FFC72C] rounded-full blur-[80px] opacity-10 pointer-events-none -mr-10 -mt-10"></div>
          
          <div className="max-w-6xl mx-auto relative z-10">
              <button onClick={() => router.push(restaurantCode ? `/restaurant/${restaurantCode}` : '/restaurants')} className="flex items-center gap-2 text-white/70 font-bold hover:text-white mb-3 transition-colors text-xs">
                  <ArrowLeft className="w-3 h-3" /> Nazad na Dashboard
              </button>

              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                  <div>
                      <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight mb-1">Evaluacija Učinka</h1>
                      <p className="text-emerald-100 flex items-center gap-2 text-xs opacity-80">
                          <CheckCircle className="w-3 h-3 text-[#FFC72C]" />
                          Službeni HR alat
                      </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                      <button onClick={handleReset} className="px-3 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded hover:bg-white/20 flex items-center gap-1 font-bold text-[10px] transition-all">
                          <Trash2 className="w-3 h-3" /> Reset
                      </button>
                      <button onClick={() => setIsSettingsOpen(true)} className="px-3 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded hover:bg-white/20 flex items-center gap-1 font-bold text-[10px] transition-all">
                          <Settings className="w-3 h-3" /> Pravila
                      </button>
                      <button onClick={generatePDF} disabled={isGeneratingPdf} className="px-3 py-1.5 bg-[#FFC72C] text-[#1a3826] rounded hover:bg-[#ffd666] flex items-center gap-1 font-bold text-[10px] shadow-sm transition-all">
                          {isGeneratingPdf ? "Generisanje..." : <><Printer className="w-3 h-3" /> PDF</>}
                      </button>
                      <button onClick={() => {localStorage.setItem(LS_KEY, JSON.stringify(data)); alert("Sačuvano!");}} className="px-4 py-1.5 bg-white text-[#1a3826] rounded hover:bg-gray-100 flex items-center gap-1 font-bold text-[10px] shadow-sm transition-all">
                          <Save className="w-3 h-3" /> Sačuvaj
                      </button>
                  </div>
              </div>
          </div>
      </div>

      {/* --- MAIN CONTENT (SKROLABILNI DIO) --- */}
      <div className="flex-grow overflow-y-auto px-4 md:px-6 py-6 bg-[#F8FAFC]">
          <div className="max-w-6xl mx-auto space-y-5">
              
              {/* OSNOVNI PODACI - Kompaktniji grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 col-span-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block"><Calendar className="w-3 h-3 inline mr-1"/> Godina</label>
                      <select value={data.meta.year} onChange={(e) => setData({...data, meta: {...data.meta, year: e.target.value}})} className="w-full font-bold text-sm text-slate-700 outline-none bg-transparent py-0.5">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 col-span-1 md:col-span-2">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block"><User className="w-3 h-3 inline mr-1"/> Zaposlenik</label>
                      <input type="text" value={data.meta.employee} onChange={(e) => setData({...data, meta: {...data.meta, employee: e.target.value}})} className="w-full font-bold text-sm text-slate-900 outline-none py-0.5" placeholder="Ime i prezime..." />
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 col-span-2 md:col-span-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block"><User className="w-3 h-3 inline mr-1"/> Evaluator</label>
                      <input type="text" value={data.meta.manager} onChange={(e) => setData({...data, meta: {...data.meta, manager: e.target.value}})} className="w-full font-bold text-sm text-slate-900 outline-none py-0.5" placeholder="Ime menadžera..." />
                  </div>
                  <div className="bg-[#1a3826] p-3 rounded-lg shadow-md text-white flex flex-col justify-center relative overflow-hidden col-span-2 md:col-span-1">
                        <div className="absolute top-0 right-0 w-12 h-12 bg-[#FFC72C] rounded-full blur-[20px] opacity-20 -mr-2 -mt-2"></div>
                        <div className="relative z-10 text-center md:text-left">
                           <label className="text-[9px] font-bold text-emerald-200 uppercase tracking-wider block mb-0.5">Rezultat</label>
                           <div className="text-2xl font-black text-[#FFC72C] leading-none">{totalScore} <span className="text-xs text-white/50 font-medium">pts</span></div>
                        </div>
                  </div>
              </div>

              {/* TABELA CILJEVA (DINAMIČKA) */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 w-10 text-center">#</th>
                                <th className="px-4 py-3">Cilj / KPI</th>
                                <th className="px-4 py-3 w-1/4">Ostvareni Rezultat</th>
                                <th className="px-4 py-3 w-20 text-center bg-[#1a3826]/5 text-[#1a3826]">Bodovi</th>
                                <th className="px-2 py-3 w-8"></th> {/* Kolona za brisanje */}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data.goals.map((goal, index) => (
                                <tr key={goal.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-4 py-2 text-center text-slate-400 font-mono text-xs">{index + 1}</td>
                                    <td className="px-4 py-2">
                                        <input type="text" value={goal.title} onChange={(e) => updateGoal(goal.id, 'title', e.target.value)} className="w-full outline-none bg-transparent font-medium text-slate-700 placeholder-slate-300 text-sm" placeholder="Unesi naziv cilja..." />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input type="text" value={goal.result} onChange={(e) => handleResultChange(goal.id, e.target.value)} className="w-full outline-none bg-transparent text-slate-600 placeholder-slate-300 text-sm" placeholder="Rezultat..." />
                                    </td>
                                    <td className="px-4 py-2 bg-[#1a3826]/5 text-center">
                                        <input type="number" value={goal.points} onChange={(e) => updateGoal(goal.id, 'points', Number(e.target.value))} className="w-full text-center font-bold text-[#1a3826] outline-none bg-transparent text-base" />
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                        {data.goals.length > 1 && (
                                            <button onClick={() => removeGoal(goal.id)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1">
                                                <MinusCircle className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
                  {/* Dugme za dodavanje cilja */}
                  <div className="bg-slate-50 p-2 border-t border-slate-200 flex justify-center">
                      <button onClick={addGoal} className="text-xs font-bold text-[#1a3826] hover:bg-[#1a3826]/10 px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors">
                          <Plus className="w-3 h-3" /> Dodaj Novi Cilj
                      </button>
                  </div>
              </div>

              {/* KOMENTARI I POTPISI */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-10">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                      <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><User className="w-4 h-4"/> Zapažanja Zaposlenika</h3>
                      <textarea value={data.meta.commEmp} onChange={(e) => setData({...data, meta: {...data.meta, commEmp: e.target.value}})} className="w-full h-24 p-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#1a3826]/20 outline-none resize-none mb-4" placeholder="Unesite komentare..."></textarea>
                      <div className="mt-auto pt-3 border-t border-slate-100">
                          <div className="flex justify-between items-center mb-2"><label className="text-[9px] font-bold text-slate-400 uppercase">Potpis</label><button onClick={() => clearSig('emp')} className="text-[9px] text-red-500 hover:underline">Obriši</button></div>
                          <div className="border border-dashed border-slate-300 rounded-lg bg-slate-50/50 cursor-crosshair h-20 relative hover:border-[#1a3826]/30 transition-colors">
                              <canvas ref={sigEmpRef} className="w-full h-full block touch-none"></canvas>
                              {!data.signatures.emp && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs opacity-50">Potpiši ovdje</div>}
                          </div>
                      </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                      <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Zaključak Managera</h3>
                      <textarea value={data.meta.commMan} onChange={(e) => setData({...data, meta: {...data.meta, commMan: e.target.value}})} className="w-full h-24 p-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#1a3826]/20 outline-none resize-none mb-4" placeholder="Unesite zaključak..."></textarea>
                      <div className="mt-auto pt-3 border-t border-slate-100">
                          <div className="flex justify-between items-center mb-2"><label className="text-[9px] font-bold text-slate-400 uppercase">Potpis</label><button onClick={() => clearSig('man')} className="text-[9px] text-red-500 hover:underline">Obriši</button></div>
                          <div className="border border-dashed border-slate-300 rounded-lg bg-slate-50/50 cursor-crosshair h-20 relative hover:border-[#1a3826]/30 transition-colors">
                              <canvas ref={sigManRef} className="w-full h-full block touch-none"></canvas>
                              {!data.signatures.man && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs opacity-50">Potpiši ovdje</div>}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* --- FOOTER (VISIBLE UI) --- */}
      <footer className="bg-[#1a3826] text-white/40 py-4 text-center text-[10px] border-t border-white/5 flex-shrink-0 z-10">
          <div className="max-w-6xl mx-auto px-6 flex justify-between items-center">
              <span>&copy; {new Date().getFullYear()} McDonald's Toolat</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> System Active</span>
          </div>
      </footer>

      {/* --- SETTINGS MODAL --- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-[#1a3826]/40 z-[100] flex items-center justify-center p-4 backdrop-blur-sm overflow-hidden">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">Postavke Bodovanja</h3>
                        <p className="text-xs text-slate-500">Konfigurišite pravila za ciljeve i skalu uspješnosti</p>
                    </div>
                    <button onClick={() => setIsSettingsOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400"/></button>
                </div>
                
                <div className="flex-1 flex overflow-hidden">
                    {/* SIDEBAR */}
                    <div className="w-1/3 bg-slate-50 border-r border-slate-200 overflow-y-auto p-3 flex flex-col">
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-2 block px-2">Ciljevi</label>
                        <div className="space-y-1 mb-4">
                            {data.goals.map((g, index) => (
                                <button key={g.id} onClick={() => setCurrentSettingId(g.id)} className={`w-full text-left px-3 py-2 rounded-md text-xs transition-all flex justify-between items-center group ${currentSettingId === g.id ? 'bg-white shadow border border-slate-200 text-[#1a3826] font-bold' : 'hover:bg-slate-100 text-slate-600'}`}>
                                    <span className="truncate">{index + 1}. {g.title || `(Cilj ${index + 1})`}</span>
                                    {currentSettingId === g.id && <ChevronRight className="w-3 h-3 text-[#1a3826]" />}
                                </button>
                            ))}
                        </div>
                        <div className="mt-auto border-t border-slate-200 pt-3">
                            <label className="text-[9px] font-bold text-slate-400 uppercase mb-2 block px-2">Generalno</label>
                            <button onClick={() => setCurrentSettingId('scale')} className={`w-full text-left px-3 py-2 rounded-md text-xs transition-all flex justify-between items-center group ${currentSettingId === 'scale' ? 'bg-[#1a3826] text-white shadow-md' : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                                <span className="flex items-center gap-1.5"><BarChart3 className="w-3 h-3"/> ⚙️ SKALA USPJEŠNOSTI</span>
                                {currentSettingId === 'scale' && <ChevronRight className="w-3 h-3 text-white" />}
                            </button>
                        </div>
                    </div>

                    {/* MAIN CONTENT */}
                    <div className="w-2/3 p-6 flex flex-col bg-white overflow-y-auto">
                        {typeof currentSettingId === 'number' && (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h4 className="font-bold text-base text-slate-800">
                                            Pravila za: {data.goals.find(g => g.id === currentSettingId)?.title || `Cilj ${data.goals.findIndex(g => g.id === currentSettingId) + 1}`}
                                        </h4>
                                        <p className="text-xs text-slate-400">Definišite raspone rezultata i pripadajuće bodove</p>
                                    </div>
                                    <button onClick={() => addRange(currentSettingId as number)} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md font-bold hover:bg-blue-100 flex items-center gap-1 text-xs"><Plus className="w-3 h-3"/> Dodaj Raspon</button>
                                </div>
                                <div className="border border-slate-100 rounded-lg overflow-hidden shadow-sm">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="px-4 py-2 text-left">Od</th><th className="px-4 py-2 text-left">Do</th><th className="px-4 py-2 text-center">Bodovi</th><th className="px-4 py-2"></th></tr></thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {(data.ranges[currentSettingId] || []).map((range, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="p-2"><input type="number" value={range.from} onChange={(e) => updateRange(currentSettingId as number, idx, 'from', Number(e.target.value))} className="w-full p-1.5 border border-slate-200 rounded text-center text-xs" placeholder="Min" /></td>
                                                    <td className="p-2"><input type="number" value={range.to} onChange={(e) => updateRange(currentSettingId as number, idx, 'to', Number(e.target.value))} className="w-full p-1.5 border border-slate-200 rounded text-center text-xs" placeholder="Max" /></td>
                                                    <td className="p-2"><div className="flex justify-center"><input type="number" value={range.pts} onChange={(e) => updateRange(currentSettingId as number, idx, 'pts', Number(e.target.value))} className="w-16 p-1.5 border border-[#FFC72C] bg-[#FFC72C]/10 text-[#1a3826] font-bold rounded text-center text-xs" placeholder="Pts" /></div></td>
                                                    <td className="p-2 text-center"><button onClick={() => removeRange(currentSettingId as number, idx)} className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><Trash2 className="w-3 h-3"/></button></td>
                                                </tr>
                                            ))}
                                            {(data.ranges[currentSettingId] || []).length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic text-xs">Nema definisanih pravila za ovaj cilj.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                        {currentSettingId === 'scale' && (
                            <>
                                <div className="mb-4">
                                    <h4 className="font-bold text-base text-slate-800">Konfiguracija Skale Uspješnosti</h4>
                                    <p className="text-xs text-slate-400">Definišite granice bodova za svaku kategoriju</p>
                                </div>
                                <div className="space-y-3">
                                    {data.scale.map((s, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg hover:shadow-sm transition-shadow bg-white">
                                            <div className={`w-32 text-xs font-bold truncate`} style={{ color: s.colorHex }}>{s.label}</div>
                                            <div className="flex items-center gap-2 flex-1 justify-end">
                                                <input type="number" value={s.min} onChange={(e) => updateScale(idx, 'min', Number(e.target.value))} className="w-16 p-1.5 border border-slate-200 rounded text-center font-bold text-xs" />
                                                <span className="text-slate-300 text-xs">-</span>
                                                <input type="number" value={s.max} onChange={(e) => updateScale(idx, 'max', Number(e.target.value))} className="w-16 p-1.5 border border-slate-200 rounded text-center font-bold text-xs" />
                                            </div>
                                            <div className="text-[10px] text-slate-400 w-10 text-right">pts</div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <div className="p-3 border-t border-slate-100 flex justify-end bg-slate-50 gap-2">
                    <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-1.5 bg-[#1a3826] text-white rounded-md font-bold hover:bg-[#264f36] transition-colors text-xs">Sačuvaj i Zatvori</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

// --- EXPORT WRAPPED IN SUSPENSE ---
export default function EvaluationsPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-[#1a3826] font-bold">Učitavanje...</div>}>
      <EvaluationsContent />
    </Suspense>
  );
}