/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Send, CheckCircle, Save, FileText, AlertCircle, Award } from 'lucide-react';
import { updatePDSContent, changePDSStatus } from '../actions';
import { PDSGoal, PDSScaleLevel, PDSUpdateData, PDSScoringRule } from '../types';
import SignaturePad from '../components/SignaturePad';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Image from 'next/image';

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

  // FIX: Koristimo useMemo umjesto useEffect da izbjegnemo infinite loop i re-renders
  const totalScore = useMemo(() => {
    return goals.reduce((acc, g) => acc + (Number(g.points) || 0), 0);
  }, [goals]);

  const currentLevel = useMemo(() => {
    return scale.find(s => totalScore >= s.min && totalScore <= s.max);
  }, [totalScore, scale]);

  const isOpen = pds.status === 'OPEN';
  const isSubmitted = pds.status === 'SUBMITTED';
  const canEmployeeEdit = !isManager && isOpen;
  const canManagerEdit = isManager && isSubmitted;

  const handleResultChange = (index: number, val: string) => {
    const newGoals = [...goals];
    newGoals[index].result = val;

    const numVal = parseFloat(val);
    if (!isNaN(numVal)) {
        const rule = newGoals[index].scoringRules.find((r: PDSScoringRule) => numVal >= r.from && numVal <= r.to);
        newGoals[index].points = rule ? rule.pts : 0;
    } else {
        newGoals[index].points = 0;
    }
    setGoals(newGoals);
  };

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
    if (!silent) alert("Podaci uspješno spremljeni.");
  };

  const handleSendToManager = async () => {
    if (!signatures.employee) return alert("Potpis zaposlenika je obavezan prije slanja!");
    if (confirm("Da li ste sigurni? Nakon slanja nećete moći mijenjati podatke.")) {
      await handleSaveData(true);
      await changePDSStatus(pds.id, 'SUBMITTED' as any);
      router.refresh();
    }
  };

  const handleExportPDF = async () => {
    const element = printRef.current;
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`PDS_${pds.user.name}_${pds.year}.pdf`);
    } catch {
      alert("Greška pri generiranju PDF-a.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-20 font-sans">
      
      {/* Top Action Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/tools/PDS')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <ArrowLeft size={20}/>
          </button>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Dokument Evaluacije</span>
            <h1 className="text-sm font-bold text-slate-800 uppercase">{pds.user.name} / {pds.year}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
            <button onClick={handleExportPDF} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors">
                <Printer size={16}/> <span className="hidden sm:inline">Print / PDF</span>
            </button>
            
            {(canEmployeeEdit || canManagerEdit) && (
                <button onClick={() => handleSaveData()} disabled={isSaving} className="px-4 py-2 bg-white border border-[#1a3826] text-[#1a3826] hover:bg-[#1a3826] hover:text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-all">
                    <Save size={16}/> {isSaving ? "Spremanje..." : "Spremi"}
                </button>
            )}

            {canEmployeeEdit && (
                <button onClick={handleSendToManager} className="px-4 py-2 bg-[#FFC72C] hover:bg-[#e0af25] text-[#1a3826] rounded-lg text-xs font-black uppercase flex items-center gap-2 shadow-sm transition-all">
                    <Send size={16}/> Pošalji Manageru
                </button>
            )}

            {canManagerEdit && (
                <button onClick={async () => { await handleSaveData(true); await changePDSStatus(pds.id, 'COMPLETED' as any); router.refresh(); }} className="px-4 py-2 bg-[#1a3826] hover:bg-[#142e1e] text-white rounded-lg text-xs font-black uppercase flex items-center gap-2 shadow-sm transition-all">
                    <CheckCircle size={16}/> Zaključi i Odobri
                </button>
            )}
        </div>
      </div>

      {/* Main Document Area */}
      <div className="max-w-4xl mx-auto mt-8 p-8 bg-white shadow-xl rounded-xl min-h-[297mm]" ref={printRef}>
        
        {/* Document Header */}
        <div className="flex justify-between items-start border-b-4 border-[#1a3826] pb-8 mb-8">
            <div>
                <h1 className="text-4xl font-black text-[#1a3826] uppercase tracking-tighter mb-2">PDS EVALUACIJA</h1>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">{pds.year}. GODINA</p>
            </div>
            <div className="text-right">
                <div className="text-xs font-bold text-slate-400 uppercase mb-1">Status Dokumenta</div>
                <span className={`inline-block px-3 py-1 rounded text-xs font-black uppercase ${
                    pds.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                    pds.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-700' :
                    'bg-orange-100 text-orange-700'
                }`}>
                    {pds.status}
                </span>
            </div>
        </div>

        {/* Score & Rank Hero Section */}
        <div className="grid grid-cols-2 gap-8 mb-12">
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 flex items-center gap-6">
                <div className="h-16 w-16 bg-[#1a3826] rounded-full flex items-center justify-center text-[#FFC72C] shadow-lg">
                    <FileText size={32} />
                </div>
                <div>
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Ukupni Bodovi</div>
                    <div className="text-5xl font-black text-slate-800 tracking-tighter">{totalScore}</div>
                </div>
            </div>
            <div className="bg-[#1a3826] p-6 rounded-xl text-white flex items-center gap-6 shadow-md relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                    <Award size={120} />
                </div>
                <div className="h-16 w-16 bg-white/10 rounded-full flex items-center justify-center text-[#FFC72C] backdrop-blur-sm">
                    <Award size={32} />
                </div>
                <div className="relative z-10">
                    <div className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">Rang Uspješnosti</div>
                    <div className="text-3xl font-black text-[#FFC72C] uppercase tracking-tight truncate">
                        {currentLevel?.label || "Nije ocijenjeno"}
                    </div>
                </div>
            </div>
        </div>

        {/* Goals Section */}
        <div className="space-y-8 mb-12">
            <h3 className="text-lg font-black text-slate-800 uppercase border-b pb-2 flex items-center gap-2">
                <Target size={20} className="text-[#1a3826]"/> Ciljevi i Rezultati
            </h3>

            {goals.map((goal, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-6 hover:border-[#1a3826]/30 transition-colors">
                    <div className="flex flex-col md:flex-row gap-6 justify-between">
                        <div className="flex-1">
                            <h4 className="text-lg font-bold text-slate-800 mb-3">{goal.title}</h4>
                            <div className="bg-slate-50 rounded-lg p-3 inline-block">
                                <table className="text-xs">
                                    <thead>
                                        <tr className="text-slate-400 border-b border-slate-200">
                                            <th className="pb-1 pr-4 text-left font-bold">Rezultat od</th>
                                            <th className="pb-1 pr-4 text-left font-bold">Rezultat do</th>
                                            <th className="pb-1 text-right font-bold">Bodovi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-600">
                                        {goal.scoringRules.map((r, ri) => (
                                            <tr key={ri}>
                                                <td className="pt-1">{r.from}</td>
                                                <td className="pt-1">{r.to}</td>
                                                <td className="pt-1 text-right font-bold text-[#1a3826]">{r.pts}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="w-full md:w-48 bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-center">
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ostvareni Rezultat</label>
                            <input 
                                type="number"
                                value={goal.result || ''}
                                onChange={(e) => handleResultChange(idx, e.target.value)}
                                disabled={!canEmployeeEdit}
                                placeholder="0"
                                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-lg font-bold text-slate-800 focus:border-[#1a3826] focus:ring-1 focus:ring-[#1a3826] outline-none transition-all disabled:bg-slate-100 disabled:text-slate-400"
                            />
                            <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-500">Bodovi:</span>
                                <span className="text-xl font-black text-[#1a3826]">{goal.points || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}

            {goals.length === 0 && (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <AlertCircle className="mx-auto text-slate-300 mb-2" size={32}/>
                    <p className="text-slate-500 font-medium">Nema definisanih ciljeva za ovu evaluaciju.</p>
                </div>
            )}
        </div>

        {/* Comments & Signatures */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 page-break-inside-avoid">
            {/* Employee Side */}
            <div className="flex flex-col h-full">
                <h3 className="text-sm font-black text-slate-800 uppercase border-b pb-2 mb-4">Zaposlenik</h3>
                <div className="bg-slate-50 rounded-lg p-4 flex-1 mb-4 border border-slate-200">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Komentar</label>
                    <textarea 
                        value={comments.employee}
                        onChange={e => setComments({...comments, employee: e.target.value})}
                        disabled={!canEmployeeEdit}
                        className="w-full h-32 bg-transparent resize-none outline-none text-sm text-slate-700 disabled:text-slate-500"
                        placeholder="Unesite komentar..."
                    />
                </div>
                <div className="mt-auto">
                    <SignaturePad 
                        label="Potpis Zaposlenika" 
                        value={signatures.employee} 
                        onChange={v => setSignatures({...signatures, employee: v})} 
                        disabled={!canEmployeeEdit} 
                    />
                </div>
            </div>

            {/* Manager Side */}
            <div className="flex flex-col h-full">
                <h3 className="text-sm font-black text-slate-800 uppercase border-b pb-2 mb-4">Manager</h3>
                <div className="bg-slate-50 rounded-lg p-4 flex-1 mb-4 border border-slate-200">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Komentar / Zaključak</label>
                    <textarea 
                        value={comments.manager}
                        onChange={e => setComments({...comments, manager: e.target.value})}
                        disabled={!canManagerEdit}
                        className="w-full h-32 bg-transparent resize-none outline-none text-sm text-slate-700 disabled:text-slate-500"
                        placeholder="Unesite komentar..."
                    />
                </div>
                <div className="mt-auto">
                    <SignaturePad 
                        label="Potpis Managera" 
                        value={signatures.manager} 
                        onChange={v => setSignatures({...signatures, manager: v})} 
                        disabled={!canManagerEdit} 
                    />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

function Target({ size, className }: { size?: number, className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
    )
}