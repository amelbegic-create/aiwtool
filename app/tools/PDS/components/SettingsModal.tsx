/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useState } from 'react';
import { X, Save, Target, BarChart4, ChevronRight, Hash, ToggleLeft, Trash2, Store } from 'lucide-react';
import { createTemplate } from '../../../actions/pdsActions';
import { PDSGoal, PDSScaleLevel, PDSScoringRule } from '../types';

interface RestaurantOption {
  id: string;
  name: string;
  code: string;
}

interface SettingsModalProps {
  year: number;
  initialGoals: PDSGoal[];
  initialScale: PDSScaleLevel[];
  restaurants: RestaurantOption[];
  currentUserId: string;
  onClose: () => void;
}

export default function SettingsModal({ year, initialGoals, initialScale, restaurants, currentUserId, onClose }: SettingsModalProps) {
  const [goals, setGoals] = useState<PDSGoal[]>(initialGoals || []);
  const [scale, setScale] = useState<PDSScaleLevel[]>(initialScale || []);
  const [activeTab, setActiveTab] = useState<'goals' | 'scale' | 'restaurants'>('goals');
  const [selectedGoalIndex, setSelectedGoalIndex] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [allRestaurants, setAllRestaurants] = useState(false);
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>([]);

  const handleSave = async () => {
    const restaurantIds = allRestaurants ? ['all'] : (selectedRestaurantIds.length > 0 ? selectedRestaurantIds : [restaurants[0]?.id].filter(Boolean));
    if (restaurantIds.length === 0) {
      alert('Odaberite barem jedan restoran.');
      return;
    }
    if (goals.length === 0) {
      alert('Dodajte barem jedan cilj.');
      return;
    }
    if (scale.length === 0) {
      alert('Dodajte barem jednu razinu skale.');
      return;
    }

    setIsSaving(true);
    const res = await createTemplate(year, restaurantIds, goals, scale, currentUserId);
    setIsSaving(false);
    if (res?.success) {
      onClose();
    } else {
      alert(res?.error ?? 'Greška pri spremanju.');
    }
  };

  const addGoal = () => {
    setGoals([...goals, { 
        title: "Novi cilj", 
        type: 'NUMERIC', 
        scoringRules: [], 
        yesPoints: 0,
        noPoints: 0,
        result: "", 
        points: 0 
    }]);
    setSelectedGoalIndex(goals.length);
  };

  const updateGoal = (index: number, field: keyof PDSGoal, value: any) => {
    const newGoals = [...goals];
    (newGoals[index] as any)[field] = value;
    
    if(field === 'type') {
        if (value === 'BOOLEAN') newGoals[index].scoringRules = [];
        if (value === 'NUMERIC') {
            newGoals[index].yesPoints = 0;
            newGoals[index].noPoints = 0;
        }
    }
    setGoals(newGoals);
  };

  const addRule = (goalIndex: number) => {
    const newGoals = [...goals];
    if (!newGoals[goalIndex].scoringRules) newGoals[goalIndex].scoringRules = [];
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
    // FIX: z-50 umjesto z-[100]
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
                <Store size={14} className="text-[#FFC72C]" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TEMPLATE CREATOR</span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">KONFIGURACIJA PDS-a</h2>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Godina: {year} (2025–2030)</p>
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
              <button onClick={() => setActiveTab('restaurants')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'restaurants' ? 'bg-[#1a3826] text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}>
                <Store size={18} /> RESTORANI
              </button>
              <button onClick={() => setActiveTab('goals')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'goals' ? 'bg-[#1a3826] text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}>
                <Target size={18} /> CILJEVI
              </button>
              <button onClick={() => setActiveTab('scale')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'scale' ? 'bg-[#1a3826] text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}>
                <BarChart4 size={18} /> SKALA
              </button>
            </div>
            
            {activeTab === 'goals' && (
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                    <button onClick={addGoal} className="w-full text-xs bg-slate-200 hover:bg-slate-300 py-2 rounded-lg font-bold text-[#1a3826] mb-3">+ DODAJ CILJ</button>
                    <div className="space-y-2">
                    {goals.map((g, i) => (
                        <div key={i} className="group flex items-center gap-2">
                            <button 
                                onClick={() => setSelectedGoalIndex(i)}
                                className={`flex-1 text-left px-3 py-2 rounded-lg text-xs font-bold border transition-all flex justify-between items-center ${selectedGoalIndex === i ? 'border-[#1a3826] bg-[#1a3826]/10 text-[#1a3826]' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
                            >
                                <span className="truncate">{g.title || `Cilj ${i+1}`}</span>
                                {selectedGoalIndex === i && <ChevronRight size={14}/>}
                            </button>
                            <button onClick={() => { const n = [...goals]; n.splice(i, 1); setGoals(n); if(selectedGoalIndex >= n.length) setSelectedGoalIndex(Math.max(0, n.length - 1)); }} className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                <Trash2 size={14}/>
                            </button>
                        </div>
                    ))}
                    </div>
                </div>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto bg-white p-8">
            
            {activeTab === 'restaurants' && (
              <div className="space-y-6 max-w-2xl mx-auto">
                <p className="text-sm text-slate-600">Odaberite na koji restoran(e) se template primjenjuje.</p>
                <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-slate-200 hover:border-[#1a3826]/50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={allRestaurants}
                    onChange={(e) => {
                      setAllRestaurants(e.target.checked);
                      if (e.target.checked) setSelectedRestaurantIds([]);
                    }}
                    className="rounded border-slate-300 text-[#1a3826] focus:ring-[#1a3826]"
                  />
                  <span className="font-bold text-slate-800">Svi restorani</span>
                </label>
                {!allRestaurants && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {restaurants.map((r) => (
                      <label key={r.id} className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRestaurantIds.includes(r.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedRestaurantIds((prev) => [...prev, r.id]);
                            else setSelectedRestaurantIds((prev) => prev.filter((id) => id !== r.id));
                          }}
                          className="rounded border-slate-300 text-[#1a3826] focus:ring-[#1a3826]"
                        />
                        <span className="text-sm font-medium text-slate-700 truncate">{r.name || r.code}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'goals' && goals[selectedGoalIndex] && (
              <div className="space-y-8 max-w-3xl mx-auto animate-in slide-in-from-right-4 duration-300">
                  
                  {/* Naziv */}
                  <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Naziv Cilja</label>
                      <input 
                          value={goals[selectedGoalIndex].title} 
                          onChange={(e) => updateGoal(selectedGoalIndex, 'title', e.target.value)}
                          className="w-full text-xl font-bold text-slate-800 border-b-2 border-slate-100 focus:border-[#1a3826] outline-none py-2"
                          placeholder="Npr. Prodaja Kave"
                      />
                  </div>

                  {/* Tip */}
                  <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Vrsta Bodovanja</label>
                      <div className="flex gap-4">
                          <button 
                              onClick={() => updateGoal(selectedGoalIndex, 'type', 'NUMERIC')}
                              className={`flex-1 py-4 px-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${goals[selectedGoalIndex].type === 'NUMERIC' ? 'border-[#1a3826] bg-[#1a3826]/5 text-[#1a3826]' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                          >
                              <Hash size={24}/>
                              <span className="text-xs font-bold uppercase">Raspon</span>
                          </button>
                          
                          <button 
                              onClick={() => updateGoal(selectedGoalIndex, 'type', 'BOOLEAN')}
                              className={`flex-1 py-4 px-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${goals[selectedGoalIndex].type === 'BOOLEAN' ? 'border-[#1a3826] bg-[#1a3826]/5 text-[#1a3826]' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                          >
                              <ToggleLeft size={24}/>
                              <span className="text-xs font-bold uppercase">DA / NE</span>
                          </button>
                      </div>
                  </div>

                  {/* LOGIKA ZA NUMERIC (Raspon) */}
                  {goals[selectedGoalIndex].type === 'NUMERIC' && (
                      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                          <div className="flex justify-between items-center mb-4">
                              <h4 className="text-xs font-black text-slate-700 uppercase">Pravila Bodovanja</h4>
                              <button onClick={() => addRule(selectedGoalIndex)} className="text-[10px] font-bold text-white bg-blue-500 hover:bg-blue-600 px-3 py-1.5 rounded-lg transition-colors">+ DODAJ PRAVILO</button>
                          </div>
                          <div className="space-y-2">
                              {goals[selectedGoalIndex].scoringRules?.map((rule, ri) => (
                                  <div key={ri} className="grid grid-cols-12 gap-3 items-center">
                                      <div className="col-span-4"><input type="number" placeholder="Min" value={rule.from} onChange={(e) => updateRule(selectedGoalIndex, ri, 'from', parseFloat(e.target.value))} className="w-full bg-white border rounded-lg px-3 py-2 text-sm font-bold outline-none"/></div>
                                      <div className="col-span-4"><input type="number" placeholder="Max" value={rule.to} onChange={(e) => updateRule(selectedGoalIndex, ri, 'to', parseFloat(e.target.value))} className="w-full bg-white border rounded-lg px-3 py-2 text-sm font-bold outline-none"/></div>
                                      <div className="col-span-3"><input type="number" placeholder="Pts" value={rule.pts} onChange={(e) => updateRule(selectedGoalIndex, ri, 'pts', parseFloat(e.target.value))} className="w-full bg-[#FFC72C]/10 border border-[#FFC72C] text-[#1a3826] rounded-lg px-3 py-2 text-sm font-black text-center outline-none"/></div>
                                      <div className="col-span-1 flex justify-center"><button onClick={() => removeRule(selectedGoalIndex, ri)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}

                  {/* LOGIKA ZA BOOLEAN (DA/NE) */}
                  {goals[selectedGoalIndex].type === 'BOOLEAN' && (
                      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                          <h4 className="text-xs font-black text-slate-700 uppercase mb-4">Konfiguracija Bodova</h4>
                          
                          <div className="flex items-center gap-6 mb-4">
                              <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                  <div className="flex items-center justify-between mb-2">
                                      {/* FIX: Escaped quotes */}
                                      <span className="text-sm font-bold text-slate-700">AKO JE ODGOVOR &quot;DA&quot;</span>
                                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <input 
                                          type="number" 
                                          value={goals[selectedGoalIndex].yesPoints || 0} 
                                          onChange={(e) => updateGoal(selectedGoalIndex, 'yesPoints', parseFloat(e.target.value))} 
                                          className="w-full text-2xl font-black text-green-600 border-b border-slate-200 focus:border-green-500 outline-none py-1"
                                      />
                                      <span className="text-xs font-bold text-slate-400 uppercase">Bodova</span>
                                  </div>
                              </div>
                              
                              <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                  <div className="flex items-center justify-between mb-2">
                                      {/* FIX: Escaped quotes */}
                                      <span className="text-sm font-bold text-slate-700">AKO JE ODGOVOR &quot;NE&quot;</span>
                                      <div className="h-2 w-2 rounded-full bg-red-500"></div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <input 
                                          type="number" 
                                          value={goals[selectedGoalIndex].noPoints || 0} 
                                          onChange={(e) => updateGoal(selectedGoalIndex, 'noPoints', parseFloat(e.target.value))} 
                                          className="w-full text-2xl font-black text-red-500 border-b border-slate-200 focus:border-red-500 outline-none py-1"
                                      />
                                      <span className="text-xs font-bold text-slate-400 uppercase">Bodova</span>
                                  </div>
                              </div>
                          </div>
                          
                          <p className="text-[10px] text-slate-400 text-center">
                              * Unesite negativan broj za oduzimanje bodova (npr. -5).
                          </p>
                      </div>
                  )}
              </div>
            )}

            {/* SCALE TAB */}
            {activeTab === 'scale' && (
                <div className="space-y-4 max-w-2xl mx-auto">
                    {scale.map((s, i) => (
                        <div key={i} className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Naziv</label><input value={s.label} onChange={(e) => {const n=[...scale]; n[i].label=e.target.value; setScale(n)}} className="w-full font-bold text-slate-800 border-b border-transparent focus:border-slate-300 outline-none" style={{color:s.colorHex}}/></div>
                            <div className="w-20"><label className="text-[10px] font-bold text-slate-400 uppercase">Min</label><input type="number" value={s.min} onChange={(e) => {const n=[...scale]; n[i].min=parseFloat(e.target.value); setScale(n)}} className="w-full bg-slate-50 rounded p-1 text-center font-bold"/></div>
                            <div className="w-20"><label className="text-[10px] font-bold text-slate-400 uppercase">Max</label><input type="number" value={s.max} onChange={(e) => {const n=[...scale]; n[i].max=parseFloat(e.target.value); setScale(n)}} className="w-full bg-slate-50 rounded p-1 text-center font-bold"/></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase">Boja</label><input type="color" value={s.colorHex} onChange={(e) => {const n=[...scale]; n[i].colorHex=e.target.value; setScale(n)}} className="h-8 w-8 cursor-pointer border-0 rounded"/></div>
                            <button onClick={() => {const n=[...scale]; n.splice(i,1); setScale(n)}} className="text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
                        </div>
                    ))}
                    <button onClick={addScaleLevel} className="w-full py-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100">+ DODAJ RANG</button>
                </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t px-8 py-5 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 uppercase transition-colors">Odustani</button>
          <button onClick={handleSave} disabled={isSaving} className="bg-[#1a3826] hover:bg-[#142e1e] text-[#FFC72C] px-8 py-2.5 rounded-xl text-xs font-black uppercase shadow-lg flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50">
            <Save size={16}/> {isSaving ? 'Spremanje...' : 'Spremi i Primjeni'}
          </button>
        </div>
      </div>
    </div>
  );
}