/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Send, CheckCircle, Save } from 'lucide-react';
import { updatePDSContent, changePDSStatus } from '../actions';
import { PDSGoal, PDSScaleLevel, PDSUpdateData } from '../types';
import SignaturePad from '../components/SignaturePad';
import SettingsModal from '../components/SettingsModal';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function PDSFormClient({ pds, isManager }: { pds: any, isManager: boolean }) {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [goals, setGoals] = useState<PDSGoal[]>(pds.goals || []);
  const [scale] = useState<PDSScaleLevel[]>(pds.scale || []);
  const [comments, setComments] = useState({ 
    employee: pds.employeeComment || '', 
    manager: pds.managerComment || '' 
  });
  const [signatures, setSignatures] = useState({ 
    employee: pds.employeeSignature || '', 
    manager: pds.managerSignature || '' 
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const totalScore = goals.reduce((acc, g) => acc + (g.points || 0), 0);
  const currentLevel = scale.find(s => totalScore >= s.min && totalScore <= s.max);

  const isOpen = pds.status === 'OPEN';
  const isSubmitted = pds.status === 'SUBMITTED';
  const canEmployeeEdit = !isManager && isOpen;
  const canManagerEdit = isManager && isSubmitted;

  const handleSaveData = async (silent = false) => {
    setIsSaving(true);
    const updateData: PDSUpdateData = {
      goals,
      scale,
      employeeComment: comments.employee,
      managerComment: comments.manager,
      employeeSignature: signatures.employee,
      managerSignature: signatures.manager
    };
    await updatePDSContent(pds.id, updateData);
    setIsSaving(false);
    if (!silent) alert("Podaci sačuvani!");
  };

  const handleSendToManager = async () => {
    if (!signatures.employee) return alert("Morate se potpisati prije slanja!");
    if (confirm("Nakon slanja nema više izmjena. Nastaviti?")) {
      await handleSaveData(true);
      await changePDSStatus(pds.id, 'SUBMITTED' as any);
      router.refresh();
    }
  };

  const handleExportPDF = async () => {
    const element = printRef.current;
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        windowWidth: 1200,
        backgroundColor: "#ffffff"
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`PDS_${pds.user.name}_${pds.year}.pdf`);
    } catch {
      alert("Greška pri PDF generisanju.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-[#1a3826] text-white p-4 sticky top-0 z-[100] flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/tools/PDS')} className="p-2 hover:bg-white/10 rounded-full transition-all"><ArrowLeft size={24}/></button>
          <h1 className="text-xl font-black uppercase tracking-tighter">PDS {pds.year} - <span className="text-[#FFC72C]">{pds.user.name}</span></h1>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportPDF} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl font-black text-xs uppercase border border-white/10 flex items-center gap-2 transition-all"><Printer size={16}/> PDF</button>
          
          {(canEmployeeEdit || canManagerEdit) && (
            <button onClick={() => handleSaveData()} disabled={isSaving} className="px-4 py-2 bg-white text-[#1a3826] rounded-xl font-black text-xs uppercase shadow-md flex items-center gap-2 hover:scale-105 transition-all">
              <Save size={16}/> {isSaving ? "Spremanje..." : "Spremi"}
            </button>
          )}

          {canEmployeeEdit && (
            <button onClick={handleSendToManager} className="px-6 py-2 bg-[#FFC72C] text-[#1a3826] rounded-xl font-black text-xs uppercase shadow-md flex items-center gap-2 hover:bg-yellow-400 transition-all">
              <Send size={16}/> Pošalji Managera
            </button>
          )}

          {canManagerEdit && (
            <button onClick={async () => { await handleSaveData(true); await changePDSStatus(pds.id, 'COMPLETED' as any); router.refresh(); }} className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase shadow-md flex items-center gap-2 hover:bg-emerald-600 transition-all">
              <CheckCircle size={16}/> Zaključi
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-8" ref={printRef}>
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-2 border-slate-50 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Ukupni bodovi</p>
            <h2 className="text-7xl font-[1000] text-[#1a3826] tracking-tighter">{totalScore}<span className="text-xl text-slate-200 ml-2">pts</span></h2>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Rang uspjeha</p>
            <div className="px-8 py-4 bg-[#1a3826] text-[#FFC72C] rounded-3xl font-[1000] text-2xl uppercase tracking-tighter shadow-xl">
              {currentLevel?.label || "N/A"}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-50 overflow-hidden">
          <div className="divide-y divide-slate-50">
            {goals.map((goal, idx) => (
              <div key={idx} className="p-8 hover:bg-slate-50/50 transition-all flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex-1">
                  <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">{goal.title}</h4>
                  <div className="flex flex-wrap gap-2">
                    {goal.scoringRules?.map((r, ri) => (
                      <span key={ri} className="px-3 py-1 bg-white border border-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase">
                        {r.from}-{r.to} = <span className="text-[#1a3826]">{r.pts} pts</span>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-6 bg-slate-100 p-4 rounded-[2rem] border-2 border-white shadow-inner">
                  <div className="text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Rezultat</p>
                    <input 
                      type="number"
                      value={goal.result || ''}
                      disabled={!canEmployeeEdit}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newGoals = [...goals];
                        newGoals[idx].result = val;
                        const num = parseFloat(val) || 0;
                        const rule = goal.scoringRules?.find(r => num >= r.from && num <= r.to);
                        newGoals[idx].points = rule ? rule.pts : 0;
                        setGoals(newGoals);
                      }}
                      className="w-20 text-3xl font-black text-slate-900 bg-transparent text-center outline-none"
                    />
                  </div>
                  <div className="h-14 w-14 bg-[#1a3826] rounded-2xl flex flex-col items-center justify-center text-white shadow-lg">
                    <span className="text-xl font-black">{goal.points}</span>
                    <span className="text-[7px] font-bold opacity-50 uppercase">PTS</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-slate-50">
            <h3 className="font-black text-slate-800 uppercase text-xs mb-6 tracking-widest">Komentar Zaposlenika</h3>
            <textarea 
              value={comments.employee}
              disabled={!canEmployeeEdit}
              onChange={e => setComments({...comments, employee: e.target.value})}
              className="w-full h-40 text-slate-900 bg-transparent outline-none font-medium text-sm leading-relaxed mb-6"
              placeholder="Unesite vaše komentare..."
            />
            <div className="border-t pt-8">
              <SignaturePad label="Potpis Zaposlenika" value={signatures.employee} onChange={v => setSignatures({...signatures, employee: v})} disabled={!canEmployeeEdit} />
            </div>
          </div>
          <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-slate-50">
            <h3 className="font-black text-slate-800 uppercase text-xs mb-6 tracking-widest">Komentar Managera</h3>
            <textarea 
              value={comments.manager}
              disabled={!canManagerEdit}
              onChange={e => setComments({...comments, manager: e.target.value})}
              className="w-full h-40 text-slate-900 bg-transparent outline-none font-medium text-sm leading-relaxed mb-6"
              placeholder="Zaključak nakon sastanka..."
            />
            <div className="border-t pt-8">
              <SignaturePad label="Potpis Managera" value={signatures.manager} onChange={v => setSignatures({...signatures, manager: v})} disabled={!canManagerEdit} />
            </div>
          </div>
        </div>
      </div>
      {showSettings && <SettingsModal year={pds.year} initialGoals={goals} initialScale={scale} onClose={() => setShowSettings(false)} />}
    </div>
  );
}