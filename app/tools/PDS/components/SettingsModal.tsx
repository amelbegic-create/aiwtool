/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useState } from 'react';
import { X, Plus, Trash2, Save, Target, BarChart4, ChevronRight } from 'lucide-react';
import { savePDSTemplate } from '../actions';
import { PDSGoal, PDSScaleLevel, PDSScoringRule } from '../types';

interface SettingsModalProps {
  year: number;
  initialGoals: PDSGoal[];
  initialScale: PDSScaleLevel[];
  onClose: () => void;
}

export default function SettingsModal({ year, initialGoals, initialScale, onClose }: SettingsModalProps) {
  const [goals, setGoals] = useState<PDSGoal[]>(initialGoals || []);
  const [scale, setScale] = useState<PDSScaleLevel[]>(initialScale || []);
  const [activeTab, setActiveTab] = useState<'goals' | 'scale'>('goals');
  const [selectedGoalIndex, setSelectedGoalIndex] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Očisti rezultate prije spremanja u template
    const cleanGoals = goals.map(g => ({ ...g, result: "", points: 0 }));
    await savePDSTemplate(year, cleanGoals, scale);
    setIsSaving(false);
    onClose();
  };

  const addGoal = () => {
    setGoals([...goals, { title: "Novi cilj", scoringRules: [], result: "", points: 0 }]);
    setSelectedGoalIndex(goals.length);
  };

  const updateGoal = (index: number, field: keyof PDSGoal, value: any) => {
    const newGoals = [...goals];
    newGoals[index] = { ...newGoals[index], [field]: value };
    setGoals(newGoals);
  };

  const addRule = (goalIndex: number) => {
    const newGoals = [...goals];
    newGoals[goalIndex].scoringRules.push({ from: 0, to: 0, pts: 0 });
    setGoals(newGoals);
  };

  const updateRule = (goalIndex: number, ruleIndex: number, field: keyof PDSScoringRule, value: number) => {
    const newGoals = [...goals];
    newGoals[goalIndex].scoringRules[ruleIndex] = { 
        ...newGoals[goalIndex].scoringRules[ruleIndex], 
        [field]: value 
    };
    setGoals(newGoals);
  };

  const removeRule = (goalIndex: number, ruleIndex: number) => {
    const newGoals = [...goals];
    newGoals[goalIndex].scoringRules.splice(ruleIndex, 1);
    setGoals(newGoals);
  };

  const addScaleLevel = () => {
    setScale([...scale, { label: "Nova razina", min: 0, max: 0, colorHex: "#000000" }]);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">KONFIGURACIJA PDS-a</h2>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Godina: {year}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Sidebar */}
          <div className="w-64 bg-slate-50 border-r flex flex-col shrink-0">
            <div className="p-4 space-y-2">
              <button 
                onClick={() => setActiveTab('goals')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'goals' ? 'bg-[#1a3826] text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}
              >
                <Target size={18} /> CILJEVI I BODOVI
              </button>
              <button 
                onClick={() => setActiveTab('scale')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'scale' ? 'bg-[#1a3826] text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}
              >
                <BarChart4 size={18} /> SKALA USPJEHA
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto bg-white p-8">
            
            {/* GOALS TAB */}
            {activeTab === 'goals' && (
              <div className="flex gap-8 h-full">
                {/* List of Goals */}
                <div className="w-1/3 border-r pr-8 flex flex-col h-full">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider">Lista Ciljeva</h3>
                    <button onClick={addGoal} className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-lg font-bold text-[#1a3826] transition-colors">+ DODAJ</button>
                  </div>
                  <div className="space-y-2 overflow-y-auto flex-1 pr-2">
                    {goals.map((g, i) => (
                      <div key={i} className="group flex items-center gap-2">
                        <button 
                            onClick={() => setSelectedGoalIndex(i)}
                            className={`flex-1 text-left px-4 py-3 rounded-lg text-xs font-bold border transition-all flex justify-between items-center ${selectedGoalIndex === i ? 'border-[#1a3826] bg-[#1a3826]/5 text-[#1a3826]' : 'border-slate-100 hover:border-slate-300 text-slate-600'}`}
                        >
                            <span className="truncate">{g.title || `Cilj ${i+1}`}</span>
                            {selectedGoalIndex === i && <ChevronRight size={14}/>}
                        </button>
                        <button 
                            onClick={() => {
                                const n = [...goals]; 
                                n.splice(i, 1); 
                                setGoals(n);
                                if(selectedGoalIndex >= n.length) setSelectedGoalIndex(Math.max(0, n.length - 1));
                            }} 
                            className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                            <Trash2 size={16}/>
                        </button>
                      </div>
                    ))}
                    {goals.length === 0 && <div className="text-center text-slate-400 text-xs py-10">Nema definisanih ciljeva.</div>}
                  </div>
                </div>

                {/* Edit Goal */}
                <div className="flex-1 pl-4 h-full overflow-y-auto">
                    {goals.length > 0 && goals[selectedGoalIndex] ? (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Naziv Cilja</label>
                                <input 
                                    value={goals[selectedGoalIndex].title} 
                                    onChange={(e) => updateGoal(selectedGoalIndex, 'title', e.target.value)}
                                    className="w-full text-lg font-bold text-slate-800 border-b-2 border-slate-100 focus:border-[#1a3826] outline-none py-2 transition-colors placeholder:text-slate-300"
                                    placeholder="Npr. Prodaja Kave"
                                />
                            </div>

                            <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                                <div className="flex justify-between items-end mb-4">
                                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide">Pravila Bodovanja</h4>
                                    <button onClick={() => addRule(selectedGoalIndex)} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">+ NOVO PRAVILO</button>
                                </div>
                                
                                <div className="space-y-3">
                                    {goals[selectedGoalIndex].scoringRules.length > 0 ? (
                                        <div className="grid grid-cols-12 gap-4 mb-2 px-2">
                                            <div className="col-span-4 text-[10px] font-bold text-slate-400">OD (Min)</div>
                                            <div className="col-span-4 text-[10px] font-bold text-slate-400">DO (Max)</div>
                                            <div className="col-span-3 text-[10px] font-bold text-slate-400 text-center">BODOVI</div>
                                            <div className="col-span-1"></div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-xs text-slate-400 italic">Nema definisanih pravila za ovaj cilj.</div>
                                    )}

                                    {goals[selectedGoalIndex].scoringRules.map((rule, ri) => (
                                        <div key={ri} className="grid grid-cols-12 gap-4 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                            <div className="col-span-4">
                                                <input 
                                                    type="number" 
                                                    value={rule.from} 
                                                    onChange={(e) => updateRule(selectedGoalIndex, ri, 'from', parseFloat(e.target.value))}
                                                    className="w-full bg-slate-50 border-transparent focus:bg-white focus:border-[#1a3826] border rounded px-3 py-2 text-sm font-bold text-slate-700 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="col-span-4">
                                                <input 
                                                    type="number" 
                                                    value={rule.to} 
                                                    onChange={(e) => updateRule(selectedGoalIndex, ri, 'to', parseFloat(e.target.value))}
                                                    className="w-full bg-slate-50 border-transparent focus:bg-white focus:border-[#1a3826] border rounded px-3 py-2 text-sm font-bold text-slate-700 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <input 
                                                    type="number" 
                                                    value={rule.pts} 
                                                    onChange={(e) => updateRule(selectedGoalIndex, ri, 'pts', parseFloat(e.target.value))}
                                                    className="w-full bg-[#FFC72C]/10 border-[#FFC72C] border rounded px-3 py-2 text-sm font-black text-[#1a3826] text-center outline-none"
                                                />
                                            </div>
                                            <div className="col-span-1 text-center">
                                                <button onClick={() => removeRule(selectedGoalIndex, ri)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm">Odaberite cilj s lijeve strane</div>
                    )}
                </div>
              </div>
            )}

            {/* SCALE TAB */}
            {activeTab === 'scale' && (
              <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Skala Uspješnosti</h3>
                        <p className="text-xs text-slate-500">Definirajte rangove na osnovu ukupnog broja bodova.</p>
                    </div>
                    <button onClick={addScaleLevel} className="bg-[#1a3826] text-white text-xs px-4 py-2 rounded-lg font-bold hover:bg-[#142e1e] transition-colors">+ DODAJ RANG</button>
                </div>

                <div className="space-y-4">
                    {scale.map((s, i) => (
                        <div key={i} className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Naziv Ranga</label>
                                <input 
                                    value={s.label}
                                    onChange={(e) => { const n = [...scale]; n[i].label = e.target.value; setScale(n); }}
                                    className="w-full font-bold text-slate-800 border-b border-transparent focus:border-slate-300 outline-none"
                                    style={{ color: s.colorHex }}
                                />
                            </div>
                            <div className="w-24">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Min Bodova</label>
                                <input 
                                    type="number"
                                    value={s.min}
                                    onChange={(e) => { const n = [...scale]; n[i].min = parseFloat(e.target.value); setScale(n); }}
                                    className="w-full bg-slate-50 rounded px-2 py-1 text-sm font-bold text-center outline-none border border-transparent focus:border-slate-300"
                                />
                            </div>
                            <div className="text-slate-300 font-bold">-</div>
                            <div className="w-24">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Max Bodova</label>
                                <input 
                                    type="number"
                                    value={s.max}
                                    onChange={(e) => { const n = [...scale]; n[i].max = parseFloat(e.target.value); setScale(n); }}
                                    className="w-full bg-slate-50 rounded px-2 py-1 text-sm font-bold text-center outline-none border border-transparent focus:border-slate-300"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Boja</label>
                                <input 
                                    type="color"
                                    value={s.colorHex}
                                    onChange={(e) => { const n = [...scale]; n[i].colorHex = e.target.value; setScale(n); }}
                                    className="h-8 w-8 rounded cursor-pointer border-none"
                                />
                            </div>
                            <button 
                                onClick={() => { const n = [...scale]; n.splice(i, 1); setScale(n); }}
                                className="p-2 text-slate-300 hover:text-red-500 ml-2"
                            >
                                <Trash2 size={18}/>
                            </button>
                        </div>
                    ))}
                    {scale.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">Nema definisane skale.</div>}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t px-8 py-5 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 uppercase transition-colors">Odustani</button>
          <button onClick={handleSave} disabled={isSaving} className="bg-[#1a3826] hover:bg-[#142e1e] text-[#FFC72C] px-8 py-2.5 rounded-xl text-xs font-black uppercase shadow-lg flex items-center gap-2 transition-transform active:scale-95">
            <Save size={16}/> {isSaving ? 'Spremanje...' : 'Spremi Promjene'}
          </button>
        </div>
      </div>
    </div>
  );
}