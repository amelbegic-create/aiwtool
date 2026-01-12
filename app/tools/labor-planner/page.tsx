"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Save, Printer, CalendarDays, Download, RefreshCw, Calculator, DollarSign
} from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveLaborReport, getLaborData, getYearlyLaborData } from "@/app/actions/laborActions";

const MONTHS = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];
const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];
const DAY_NAMES = ["Ned", "Pon", "Uto", "Sri", "Čet", "Pet", "Sub"];

function LaborPlannerContent() {
  const router = useRouter();
  const [restId, setRestId] = useState<string | null>(null);
  const [restName, setRestName] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<any[]>([]);
  const [hourlyWage, setHourlyWage] = useState(11.80);
  const [budgetSales, setBudgetSales] = useState(0);
  const [budgetCost, setBudgetCost] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem("selected_restaurant_id");
    const name = localStorage.getItem("selected_restaurant_name");
    if (!id) { router.push("/select-restaurant"); return; }
    setRestId(id);
    setRestName(name || "");
  }, [router]);

  useEffect(() => {
    if (restId) loadData();
  }, [restId, selectedMonth, selectedYear]);

  const loadData = async () => {
    setIsLoading(true);
    const data = await getLaborData(restId!, selectedMonth, selectedYear);
    if (data) {
      setRows(data.daysData as any[]);
      setHourlyWage(data.hourlyWage);
      setBudgetSales(data.budgetSales);
      setBudgetCost(data.budgetCost);
    } else {
      generateRows();
    }
    setIsLoading(false);
  };

  const generateRows = () => {
    const days = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const newRows = Array.from({ length: days }, (_, i) => {
      const date = new Date(selectedYear, selectedMonth, i + 1);
      return { day: i + 1, name: DAY_NAMES[date.getDay()], isWeekend: date.getDay() === 0 || date.getDay() === 6, sales: 0, target: 100, sf: 0, hm: 0, nz: 0, extra: 0 };
    });
    setRows(newRows);
  };

  const calculateTotals = () => {
    let tSales = 0, tHours = 0, tCost = 0;
    rows.forEach(r => {
      const s = Number(r.sales) || 0;
      const target = Number(r.target) || 1;
      const sf = Number(r.sf) || 0;
      const prodHrs = s > 0 ? (s / target) - sf : 0;
      const rowHrs = prodHrs + (Number(r.hm) || 0) + (Number(r.extra) || 0);
      tSales += s; tHours += rowHrs; tCost += (rowHrs * hourlyWage) + (Number(r.nz) || 0);
    });
    const tProd = tSales > 0 ? (tCost / tSales) * 100 : 0;
    const bProd = budgetSales > 0 ? (budgetCost / budgetSales) * 100 : 0;
    return { tSales, tHours, tCost, tProd, bProd };
  };

  const totals = calculateTotals();

  const handleSave = async () => {
    setIsLoading(true);
    const res = await saveLaborReport(restId!, selectedMonth, selectedYear, rows, hourlyWage, budgetSales, budgetCost);
    setIsLoading(false);
    if(res.success) alert("✅ Podaci uspješno sačuvani u Neon DB!");
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-[#F8FAFC] flex flex-col font-sans">
      {/* HEADER */}
      <div className="bg-[#1a3826] text-white p-6 shadow-md flex justify-between items-center shrink-0">
        <div>
          <button onClick={() => router.back()} className="text-white/70 hover:text-white flex items-center gap-1 text-xs font-bold mb-1 uppercase tracking-widest">
            <ArrowLeft size={12}/> Nazad
          </button>
          <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
            Labor Planer <span className="text-[#FFC72C]">{selectedYear}</span>
            {isLoading && <RefreshCw className="animate-spin w-4 h-4 opacity-50"/>}
          </h1>
          <p className="text-[10px] text-emerald-200 uppercase font-black tracking-widest leading-none">{restName}</p>
        </div>
        <div className="flex gap-2">
           <button onClick={handleSave} className="bg-[#FFC72C] text-[#1a3826] px-5 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-xl hover:bg-yellow-400 transition-all flex items-center gap-2">
            <Save size={14}/> Sačuvaj Plan
          </button>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="bg-white border-b border-slate-200 p-4 shrink-0 shadow-sm">
        <div className="max-w-[1800px] mx-auto grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="flex gap-2">
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="w-full border rounded-xl p-2 text-[10px] font-black uppercase bg-slate-50 outline-none focus:ring-2 focus:ring-[#1a3826]">
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="w-full border rounded-xl p-2 text-[10px] font-black uppercase bg-slate-50 outline-none focus:ring-2 focus:ring-[#1a3826]">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col justify-center">
             <label className="text-[8px] font-black text-slate-400 uppercase block mb-1 ml-1 tracking-tighter">Prosječna Satnica (€)</label>
             <input type="number" step="0.1" value={hourlyWage} onChange={e => setHourlyWage(Number(e.target.value))} className="w-full bg-transparent font-black text-blue-600 outline-none px-1 text-sm"/>
          </div>
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col justify-center">
             <label className="text-[8px] font-black text-slate-400 uppercase block mb-1 ml-1 tracking-tighter">Planirani Promet (€)</label>
             <input type="number" value={budgetSales} onChange={e => setBudgetSales(Number(e.target.value))} className="w-full bg-transparent font-black text-[#1a3826] outline-none px-1 text-sm"/>
          </div>
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col justify-center">
             <label className="text-[8px] font-black text-slate-400 uppercase block mb-1 ml-1 tracking-tighter">Dozvoljeni Trošak (€)</label>
             <input type="number" value={budgetCost} onChange={e => setBudgetCost(Number(e.target.value))} className="w-full bg-transparent font-black text-[#1a3826] outline-none px-1 text-sm"/>
          </div>
          <div className={`p-2 rounded-xl border flex flex-col justify-center items-center shadow-sm ${totals.tProd <= totals.bProd ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-600'}`}>
            <span className="text-[8px] font-black uppercase opacity-60 tracking-widest mb-1">Status Labor %</span>
            <div className="text-xl font-black leading-none">{totals.tProd.toFixed(2)}%</div>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-grow overflow-auto p-4 bg-white">
        <div className="max-w-[1800px] mx-auto bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-center text-[10px] border-collapse">
            <thead className="bg-[#1a3826] text-white font-black uppercase sticky top-0 z-20">
              <tr>
                <th className="p-3 border-r border-white/5 w-10">#</th>
                <th className="p-3 border-r border-white/5 text-left w-20">Dan</th>
                <th className="p-3 border-r border-white/5 bg-white/5">Promet (€)</th>
                <th className="p-3 border-r border-white/5">Cilj</th>
                <th className="p-3 border-r border-white/5 bg-[#FFC72C] text-[#1a3826]">Sati (Prod)</th>
                <th className="p-3 border-r border-white/5">SF</th>
                <th className="p-3 border-r border-white/5">HM</th>
                <th className="p-3 border-r border-white/5">NZ (€)</th>
                <th className="p-3 border-r border-white/5">Extra</th>
                <th className="p-3 bg-slate-800">Ukupno h</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row, idx) => {
                const prodHrs = row.sales > 0 ? (row.sales / row.target) - row.sf : 0;
                const totalRowHrs = prodHrs + row.hm + row.extra;
                return (
                  <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${row.isWeekend ? 'bg-slate-50/30' : ''}`}>
                    <td className="p-2 border-r border-slate-50 text-slate-300 font-bold">{row.day}</td>
                    <td className={`p-2 border-r border-slate-50 text-left font-black uppercase ${row.isWeekend ? 'text-[#1a3826]' : 'text-slate-400'}`}>{row.name}</td>
                    <td className="p-0 border-r border-slate-50"><input type="number" className="w-full p-2 text-center outline-none bg-transparent font-black text-slate-700 focus:bg-emerald-50 transition-all" value={row.sales || ""} onChange={e => {
                        const newRows = [...rows];
                        newRows[idx].sales = parseFloat(e.target.value) || 0;
                        setRows(newRows);
                    }} /></td>
                    <td className="p-0 border-r border-slate-50"><input type="number" className="w-full p-2 text-center outline-none bg-transparent text-slate-400" value={row.target} onChange={e => {
                        const newRows = [...rows];
                        newRows[idx].target = parseFloat(e.target.value) || 1;
                        setRows(newRows);
                    }} /></td>
                    <td className="p-2 border-r border-slate-50 font-black bg-amber-50/30 text-[#1a3826]">{prodHrs > 0 ? prodHrs.toFixed(1) : "-"}</td>
                    <td className="p-0 border-r border-slate-50"><input type="number" className="w-full p-2 text-center outline-none bg-transparent text-slate-500" value={row.sf || ""} onChange={e => {
                        const newRows = [...rows];
                        newRows[idx].sf = parseFloat(e.target.value) || 0;
                        setRows(newRows);
                    }} /></td>
                    <td className="p-0 border-r border-slate-50"><input type="number" className="w-full p-2 text-center outline-none bg-transparent text-slate-500" value={row.hm || ""} onChange={e => {
                        const newRows = [...rows];
                        newRows[idx].hm = parseFloat(e.target.value) || 0;
                        setRows(newRows);
                    }} /></td>
                    <td className="p-0 border-r border-slate-50"><input type="number" className="w-full p-2 text-center outline-none bg-transparent font-black text-blue-600 focus:bg-blue-50" value={row.nz || ""} onChange={e => {
                        const newRows = [...rows];
                        newRows[idx].nz = parseFloat(e.target.value) || 0;
                        setRows(newRows);
                    }} /></td>
                    <td className="p-0 border-r border-slate-50"><input type="number" className="w-full p-2 text-center outline-none bg-transparent text-slate-500" value={row.extra || ""} onChange={e => {
                        const newRows = [...rows];
                        newRows[idx].extra = parseFloat(e.target.value) || 0;
                        setRows(newRows);
                    }} /></td>
                    <td className="p-2 font-black bg-slate-50/50 text-[#1a3826]">{totalRowHrs > 0 ? totalRowHrs.toFixed(1) : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function LaborPlannerPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center font-black uppercase text-[#1a3826] bg-[#F8FAFC]">Učitavanje Modula...</div>}>
      <LaborPlannerContent />
    </Suspense>
  );
}