"use client";

import { useState, Suspense } from "react"; // Dodan Suspense
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Trash2, Settings, DollarSign } from "lucide-react";

interface DayRow {
  id: number;
  dayName: string;
  isWeekend: boolean;
  sales: number | "";
  target: number;
  sf: number | "";
  hm: number | "";
  nz: number | "";
  extra: number | "";
}

// 1. Premjesti glavnu logiku u zasebnu komponentu
function LaborPlannerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const restaurantCode = searchParams.get("restaurant");

  // POSTAVKE
  const [hourlyWage, setHourlyWage] = useState<number>(11.80);
  const [vacationHours, setVacationHours] = useState<number>(0);
  const [sickHours, setSickHours] = useState<number>(0);
  const [budgetSales, setBudgetSales] = useState<number | "">("");
  const [budgetCost, setBudgetCost] = useState<number | "">("");

  // GENERISANJE 31 DANA
  const daysOfWeek = ["Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota", "Nedjelja"];
  const [rows, setRows] = useState<DayRow[]>(() => {
    return Array.from({ length: 31 }, (_, i) => {
      const dayName = daysOfWeek[i % 7];
      return {
        id: i + 1,
        dayName,
        isWeekend: dayName === "Subota" || dayName === "Nedjelja",
        sales: "", target: 100, sf: "", hm: "", nz: "", extra: ""
      };
    });
  });

  const updateRow = (id: number, field: keyof DayRow, value: string) => {
    const numValue = value === "" ? "" : parseFloat(value);
    setRows(prev => prev.map(row => row.id === id ? { ...row, [field]: numValue } : row));
  };

  const handleClear = () => {
    if (confirm("Da li ste sigurni?")) {
      setRows(rows.map(r => ({ ...r, sales: "", target: 100, sf: "", hm: "", nz: "", extra: "" })));
    }
  };

  const calculateTotals = () => {
    let sSales = 0, sProd = 0, sSF = 0, sHM = 0, sNZ = 0, sExtra = 0;

    rows.forEach(row => {
      const sales = Number(row.sales) || 0;
      const target = row.target || 1;
      const sf = Number(row.sf) || 0;
      let prod = 0;
      if (sales > 0 || sf > 0) {
         if (target > 0) prod = (sales / target) - sf;
      }
      sSales += sales;
      sProd += prod;
      sSF += sf;
      sHM += Number(row.hm) || 0;
      sNZ += Number(row.nz) || 0;
      sExtra += Number(row.extra) || 0;
    });

    const totalHoursPaid = sProd + sHM + sExtra + vacationHours + sickHours;
    const totalCost = (totalHoursPaid * hourlyWage) + sNZ;
    
    let realPercent = 0;
    if (sSales > 0) realPercent = (totalCost / sSales) * 100;

    let budgetPercent = 0;
    const bSales = Number(budgetSales) || 0;
    const bCost = Number(budgetCost) || 0;
    if (bSales > 0) budgetPercent = (bCost / bSales) * 100;

    return { sales: sSales, prodHours: sProd, sf: sSF, hm: sHM, nz: sNZ, extra: sExtra, totalHoursPaid, totalCost, realPercent, budgetPercent };
  };

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 text-[#0F172A] print:bg-white print:p-0">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-6 print:hidden">
            <button onClick={() => router.push(restaurantCode ? `/restaurant/${restaurantCode}` : '/restaurants')} className="flex items-center gap-2 text-slate-500 font-bold hover:text-[#1a3826]"><ArrowLeft className="w-5 h-5" /> Nazad</button>
            <div className="flex gap-2">
                <button onClick={handleClear} className="px-4 py-2 bg-white border border-slate-200 text-red-600 font-bold rounded-md flex items-center gap-2"><Trash2 className="w-4 h-4" /> Obriši</button>
                <button onClick={() => window.print()} className="px-4 py-2 bg-[#1a3826] text-white font-bold rounded-md flex items-center gap-2"><Printer className="w-4 h-4" /> Štampaj</button>
            </div>
        </div>
        <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-4">
            <h1 className="text-2xl font-bold text-slate-900 uppercase">Mjesečni Planer Rada</h1>
            {restaurantCode && <div className="text-xl font-mono font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded">{restaurantCode}</div>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 print:grid-cols-3">
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm print:border">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><Settings className="w-3 h-3"/> Postavke</h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><label>Satnica (€)</label><input type="number" value={hourlyWage} onChange={e => setHourlyWage(Number(e.target.value))} className="w-20 text-right border rounded font-bold" /></div>
                    <div className="flex justify-between"><label>Godišnji (h)</label><input type="number" value={vacationHours} onChange={e => setVacationHours(Number(e.target.value))} className="w-20 text-right border rounded" /></div>
                    <div className="flex justify-between"><label>Bolovanje (h)</label><input type="number" value={sickHours} onChange={e => setSickHours(Number(e.target.value))} className="w-20 text-right border rounded" /></div>
                </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm print:border">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><DollarSign className="w-3 h-3"/> Budžet</h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><label>Plan Promet (€)</label><input type="number" value={budgetSales} onChange={e => setBudgetSales(Number(e.target.value))} className="w-24 text-right border rounded" /></div>
                    <div className="flex justify-between"><label>Plan Trošak (€)</label><input type="number" value={budgetCost} onChange={e => setBudgetCost(Number(e.target.value))} className="w-24 text-right border rounded" /></div>
                    <div className="text-right text-xs">Max Labor %: <strong>{totals.budgetPercent.toFixed(2)}%</strong></div>
                </div>
            </div>
            <div className={`p-4 rounded-lg border shadow-sm flex flex-col justify-between ${totals.totalCost <= (Number(budgetCost) || 999999) ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                <h3 className="text-xs font-bold uppercase mb-2">Rezultat</h3>
                <div className="flex justify-between items-end">
                    <div><div className="text-xs opacity-70">Isplata sati</div><div className="text-2xl font-black text-slate-800">{totals.totalHoursPaid.toFixed(1)} h</div></div>
                    <div className="text-right"><div className="text-xs opacity-70">Trošak</div><div className="text-xl font-bold text-slate-800">{totals.totalCost.toLocaleString('de-DE', {style: 'currency', currency: 'EUR'})}</div></div>
                </div>
                <div className="mt-2 pt-2 border-t border-black/10 flex justify-between items-center"><span className="font-bold text-sm">REALNI %</span><span className="text-2xl font-black">{totals.realPercent.toFixed(2)}%</span></div>
            </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-x-auto print:shadow-none print:border-0">
            <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-100 text-slate-600 text-xs uppercase print:bg-slate-200">
                    <tr><th className="px-2 py-2 border w-8">#</th><th className="px-2 py-2 border w-24">Dan</th><th className="px-2 py-2 border text-right bg-blue-50/50">Promet</th><th className="px-2 py-2 border text-right w-16">Cilj</th><th className="px-2 py-2 border text-right bg-slate-50 font-bold">Prod.*</th><th className="px-2 py-2 border text-right w-16">SF</th><th className="px-2 py-2 border text-right w-16">HM</th><th className="px-2 py-2 border text-right w-20">NZ</th><th className="px-2 py-2 border text-right w-16">Extra</th></tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        let prodDisplay = 0;
                        const s = Number(row.sales) || 0; const sf = Number(row.sf) || 0;
                        if(s > 0 || sf > 0) prodDisplay = (s / (row.target || 1)) - sf;
                        return (
                            <tr key={row.id} className={`hover:bg-slate-50 ${row.isWeekend ? 'bg-slate-50/50' : ''}`}>
                                <td className="px-1 py-1 border text-center text-xs text-slate-400">{row.id}</td>
                                <td className={`px-2 py-1 border text-xs font-bold ${row.isWeekend ? 'text-[#1a3826]' : 'text-slate-600'}`}>{row.dayName}</td>
                                <td className="p-0 border"><input type="number" className="w-full h-full px-2 py-1 text-right outline-none bg-transparent focus:bg-blue-50" value={row.sales} onChange={e => updateRow(row.id, 'sales', e.target.value)} /></td>
                                <td className="p-0 border"><input type="number" className="w-full h-full px-2 py-1 text-right outline-none bg-transparent focus:bg-blue-50 text-xs" value={row.target} onChange={e => updateRow(row.id, 'target', e.target.value)} /></td>
                                <td className="px-2 py-1 border text-right font-mono font-bold bg-slate-50">{prodDisplay !== 0 ? prodDisplay.toFixed(2) : ''}</td>
                                <td className="p-0 border"><input type="number" className="w-full h-full px-2 py-1 text-right outline-none bg-transparent focus:bg-blue-50 text-xs" value={row.sf} onChange={e => updateRow(row.id, 'sf', e.target.value)} /></td>
                                <td className="p-0 border"><input type="number" className="w-full h-full px-2 py-1 text-right outline-none bg-transparent focus:bg-blue-50 text-xs" value={row.hm} onChange={e => updateRow(row.id, 'hm', e.target.value)} /></td>
                                <td className="p-0 border"><input type="number" className="w-full h-full px-2 py-1 text-right outline-none bg-transparent focus:bg-blue-50 text-xs" value={row.nz} onChange={e => updateRow(row.id, 'nz', e.target.value)} /></td>
                                <td className="p-0 border"><input type="number" className="w-full h-full px-2 py-1 text-right outline-none bg-transparent focus:bg-blue-50 text-xs" value={row.extra} onChange={e => updateRow(row.id, 'extra', e.target.value)} /></td>
                            </tr>
                        )
                    })}
                </tbody>
                <tfoot className="bg-[#1a3826] text-white font-bold text-xs uppercase print:bg-slate-300 print:text-black">
                    <tr><td colSpan={2} className="px-4 py-3 border border-white/10">UKUPNO</td><td className="px-2 py-3 text-right border border-white/10">{totals.sales.toLocaleString('de-DE')} €</td><td className="px-2 py-3 text-right border border-white/10">-</td><td className="px-2 py-3 text-right border border-white/10 bg-white/10">{totals.prodHours.toFixed(1)}</td><td className="px-2 py-3 text-right border border-white/10">{totals.sf.toFixed(0)}</td><td className="px-2 py-3 text-right border border-white/10">{totals.hm.toFixed(0)}</td><td className="px-2 py-3 text-right border border-white/10">{totals.nz.toFixed(0)}</td><td className="px-2 py-3 text-right border border-white/10">{totals.extra.toFixed(0)}</td></tr>
                </tfoot>
            </table>
        </div>
      </div>
    </div>
  );
}

// 2. Eksportuj komponentu umotanu u Suspense
export default function MonthlyLaborPlanner() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Učitavanje planera...</div>}>
      <LaborPlannerContent />
    </Suspense>
  );
}