/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useState } from 'react';
import { X, Plus, Trash2, ChevronRight, BarChart3, Save } from 'lucide-react';
import { savePDSTemplate } from '../actions';

export default function SettingsModal({ year, initialGoals, initialScale, onClose }: any) {
  const [goals, setGoals] = useState<any[]>(initialGoals || []);
  const [scale, setScale] = useState<any[]>(initialScale || []);
  const [activeTab, setActiveTab] = useState<number | 'scale'>('scale');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    const cleanGoals = goals.map(g => ({ ...g, result: "", points: 0 }));
    await savePDSTemplate(year, cleanGoals, scale);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
        <div className="p-5 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-xl text-[#1a3826] uppercase">Postavke Bodovanja ({year})</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24} className="text-slate-400"/></button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/3 bg-slate-50 border-r p-4 overflow-y-auto">
            <div className="space-y-1">
              {goals.map((g, i) => (
                <button key={i} onClick={() => setActiveTab(i)} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase flex justify-between items-center transition-all ${activeTab === i ? 'bg-[#1a3826] text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}>
                  <span className="truncate">{g.title || `Cilj ${i+1}`}</span>
                  <ChevronRight size={14}/>
                </button>
              ))}
            </div>
            <button onClick={() => setGoals([...goals, { title: "", scoringRules: [], result: "", points: 0 }])} className="w-full mt-4 text-[10px] text-blue-600 font-black py-3 border-2 border-dashed border-blue-100 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-50 uppercase">+ Novi Cilj</button>
            <div className="mt-8 pt-6 border-t">
              <button onClick={() => setActiveTab('scale')} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black flex items-center gap-2 uppercase ${activeTab === 'scale' ? 'bg-[#1a3826] text-white shadow-md' : 'text-slate-700 hover:bg-slate-50'}`}>
                <BarChart3 size={16}/> SKALA USPJEŠNOSTI
              </button>
            </div>
          </div>

          <div className="w-2/3 p-8 overflow-y-auto bg-white">
            {activeTab === 'scale' ? (
              <div className="max-w-md mx-auto space-y-4">
                <h4 className="font-black text-slate-800 uppercase text-sm mb-6 tracking-widest">Konfiguracija Skale</h4>
                {scale.map((s, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 border rounded-2xl bg-slate-50/30">
                    <input value={s.label} onChange={e => {const n=[...scale]; n[i].label=e.target.value; setScale(n)}} className="font-black text-xs flex-1 outline-none bg-transparent" style={{color: s.colorHex}}/>
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border">
                      {/* FIX: text-slate-900 za vidljive brojeve */}
                      <input type="number" value={s.min} onChange={e => {const n=[...scale]; n[i].min=Number(e.target.value); setScale(n)}} className="w-12 text-center text-xs font-black text-slate-900 outline-none bg-transparent"/>
                      <span className="text-slate-300">-</span>
                      <input type="number" value={s.max} onChange={e => {const n=[...scale]; n[i].max=Number(e.target.value); setScale(n)}} className="w-12 text-center text-xs font-black text-slate-900 outline-none bg-transparent"/>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <input className="text-2xl font-black text-[#1a3826] outline-none w-full border-b mb-8 pb-2 uppercase tracking-tighter" value={goals[activeTab as number]?.title} onChange={e => {const n=[...goals]; n[activeTab as number].title=e.target.value; setGoals(n)}} placeholder="NAZIV CILJA..."/>
                <div className="rounded-2xl border overflow-hidden shadow-sm">
                  <table className="w-full">
                    <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                      <tr><th className="px-6 py-4 text-left">Od</th><th className="px-6 py-4 text-left">Do</th><th className="px-6 py-4 text-center">Bodovi</th><th className="w-10"></th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {goals[activeTab as number]?.scoringRules?.map((r: any, ri: number) => (
                        <tr key={ri} className="bg-white hover:bg-slate-50 transition-colors">
                          {/* FIX: text-slate-900 za vidljive brojeve */}
                          <td className="px-6 py-3"><input type="number" value={r.from} onChange={e => {const n=[...goals]; n[activeTab as number].scoringRules[ri].from=Number(e.target.value); setGoals(n)}} className="w-full p-2 border rounded-lg text-xs font-black text-slate-900 text-center outline-none bg-transparent"/></td>
                          <td className="px-6 py-3"><input type="number" value={r.to} onChange={e => {const n=[...goals]; n[activeTab as number].scoringRules[ri].to=Number(e.target.value); setGoals(n)}} className="w-full p-2 border rounded-lg text-xs font-black text-slate-900 text-center outline-none bg-transparent"/></td>
                          <td className="px-6 py-3"><input type="number" value={r.pts} onChange={e => {const n=[...goals]; n[activeTab as number].scoringRules[ri].pts=Number(e.target.value); setGoals(n)}} className="w-16 p-2 border-2 border-[#FFC72C] bg-yellow-50 rounded-lg text-xs font-black text-slate-900 text-center mx-auto block outline-none"/></td>
                          <td className="pr-4"><button onClick={() => {const n=[...goals]; n[activeTab as number].scoringRules.splice(ri,1); setGoals(n)}} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={() => {const n=[...goals]; if(!n[activeTab as number].scoringRules) n[activeTab as number].scoringRules=[]; n[activeTab as number].scoringRules.push({from:0,to:0,pts:0}); setGoals(n)}} className="mt-6 text-[10px] text-blue-600 font-black flex items-center gap-2 hover:bg-blue-50 px-4 py-2 rounded-xl border border-dashed border-blue-200 uppercase tracking-widest">+ Dodaj Raspon</button>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 text-slate-500 font-black text-[10px] uppercase hover:bg-slate-200 rounded-xl tracking-widest transition-all">Odustani</button>
          <button onClick={handleSave} disabled={isSaving} className="bg-[#1a3826] text-[#FFC72C] px-8 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg flex items-center gap-2">
            <Save size={16}/> {isSaving ? 'Čuvanje...' : 'Sačuvaj i Primijeni'}
          </button>
        </div>
      </div>
    </div>
  );
}