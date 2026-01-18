/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
// FIX: Ispravne putanje
import { updatePDSContent, changePDSStatus, returnPDS } from '../actions';
import SignaturePad from '../components/SignaturePad';
import { Save, Send, ChevronLeft, Check, X, Undo2, FileDown, Loader2 } from 'lucide-react';
import { PDSGoal, PDSScoringRule } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface Props {
  pds: any;
  isManager: boolean;
}

export default function PDSFormClient({ pds, isManager }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [goals, setGoals] = useState<PDSGoal[]>(pds.goals as PDSGoal[]);
  const [employeeComment, setEmployeeComment] = useState(pds.employeeComment || '');
  const [managerComment, setManagerComment] = useState(pds.managerComment || '');
  const [employeeSignature, setEmployeeSignature] = useState(pds.employeeSignature || '');
  const [managerSignature, setManagerSignature] = useState(pds.managerSignature || '');

  const totalScore = goals.reduce((acc, g) => acc + (g.points || 0), 0);

  // Logika statusa
  const isCompleted = pds.status === 'COMPLETED';
  const isSubmitted = pds.status === 'SUBMITTED';
  const isReturned = pds.status === 'RETURNED';
  const isDraft = pds.status === 'DRAFT' || pds.status === 'OPEN';
  
  const canEmployeeEdit = !isManager && (isDraft || isReturned);
  const canManagerEdit = isManager && isSubmitted;

  // --- PDF EXPORT LOGIKA ---
  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);

    try {
        // Čekamo malo da se UI smiri
        await new Promise(r => setTimeout(r, 500));

        const canvas = await html2canvas(reportRef.current, {
            scale: 2, // Visoka kvaliteta
            backgroundColor: '#ffffff', // HEX boja obavezna!
            useCORS: true,
            logging: false,
            // Mičemo elemente koji smetaju printu
            ignoreElements: (element) => element.classList.contains('no-print')
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = pdfWidth / imgWidth;
        const imgHeightScaled = imgHeight * ratio;

        let heightLeft = imgHeightScaled;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeightScaled);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position = heightLeft - imgHeightScaled;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeightScaled);
            heightLeft -= pdfHeight;
        }

        pdf.save(`PDS_${pds.user.name}_${pds.year}.pdf`);
    } catch (error) {
        console.error("Export Error:", error);
        alert("Greška pri exportu PDF-a.");
    } finally {
        setIsExporting(false);
    }
  };

  // --- OSTALI HANDLERI ---
  const handleGoalChange = (index: number, value: any) => {
    const newGoals = [...goals];
    const goal = newGoals[index];
    goal.result = value;

    if (goal.type === 'BOOLEAN') {
        goal.points = value === true ? (goal.yesPoints || 0) : (goal.noPoints || 0);
    } else {
        const numVal = parseFloat(value);
        if (!isNaN(numVal) && goal.scoringRules) {
            const rule = goal.scoringRules.find((r: PDSScoringRule) => numVal >= r.from && numVal <= r.to);
            goal.points = rule ? rule.pts : 0;
        } else {
            goal.points = 0;
        }
    }
    setGoals(newGoals);
  };

  const handleSave = async () => {
    setLoading(true);
    await updatePDSContent(pds.id, {
      goals, employeeComment, managerComment, employeeSignature, managerSignature
    });
    setLoading(false);
    router.refresh();
  };

  const handleSubmit = async () => {
    if (confirm('Jeste li sigurni?')) {
        setLoading(true);
        await updatePDSContent(pds.id, {
            goals, employeeComment, managerComment, employeeSignature, managerSignature
        });
        const nextStatus = isManager ? 'COMPLETED' : 'SUBMITTED';
        await changePDSStatus(pds.id, nextStatus as any);
        setLoading(false);
        router.push('/tools/PDS');
    }
  };

  const handleReturn = async () => {
      if(confirm("Vratiti radniku na doradu?")) {
          setLoading(true);
          await returnPDS(pds.id, managerComment);
          setLoading(false);
          router.push('/tools/PDS');
      }
  }

  // --- STILOVI ZA PDF (HEX only - Rješava "lab" grešku) ---
  const pdfStyles = {
      container: { fontFamily: 'Arial, sans-serif', color: '#000000', backgroundColor: '#ffffff', padding: '40px', border: '1px solid #e5e7eb', borderRadius: '8px' },
      header: { display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #f3f4f6', paddingBottom: '20px', marginBottom: '30px' },
      h1: { fontSize: '24px', fontWeight: 'bold', margin: '0 0 5px 0', textTransform: 'uppercase' as const, color: '#1a3826' },
      sub: { fontSize: '12px', color: '#6b7280', margin: 0 },
      scoreBox: { textAlign: 'right' as const, background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' },
      scoreVal: { fontSize: '32px', fontWeight: 'bold', color: '#1a3826', lineHeight: 1 },
      // FIX: breakInside umjesto pageBreakInside
      goalItem: { background: '#f9fafb', border: '1px solid #e5e7eb', padding: '15px', marginBottom: '15px', borderRadius: '8px', breakInside: 'avoid' as const },
      goalTop: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' },
      goalTitle: { fontSize: '14px', fontWeight: 'bold', width: '80%' },
      goalPts: { fontSize: '14px', fontWeight: 'bold', color: '#1a3826' },
      resultBox: { background: '#fff', border: '1px solid #e5e7eb', padding: '10px', borderRadius: '6px', fontSize: '12px' },
      commentSection: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '30px', borderTop: '2px solid #f3f4f6', paddingTop: '20px', breakInside: 'avoid' as const },
      commentBox: { background: '#f8fafc', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '6px', minHeight: '60px', fontSize: '11px', marginTop: '5px', marginBottom: '10px', whiteSpace: 'pre-wrap' as const },
      sigImg: { maxHeight: '60px', maxWidth: '100%', border: '1px solid #eee', borderRadius: '8px' }
  };

  return (
    <div className="max-w-5xl mx-auto pb-20">
      
      {/* UI HEADER (Tailwind OK) */}
      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col xl:flex-row justify-between items-center gap-4 sticky top-4 z-40">
        <div>
            <button onClick={() => router.back()} className="flex items-center text-slate-400 hover:text-slate-600 text-xs font-bold mb-2">
                <ChevronLeft size={14}/> NAZAD NA LISTU
            </button>
            <div className="flex items-center gap-3">
                <h1 className="text-xl md:text-2xl font-black text-[#1a3826] uppercase">{pds.user.name}</h1>
                <span className="px-2 py-1 rounded text-[10px] font-bold uppercase border bg-slate-50 text-slate-500 border-slate-200">
                    {pds.status === 'RETURNED' ? 'VRAĆENO' : pds.status}
                </span>
            </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
            <button 
                onClick={handleExportPDF} 
                disabled={isExporting}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-2 border border-slate-200"
            >
                {isExporting ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>}
                PDF IZVJEŠTAJ
            </button>

            {canEmployeeEdit && (
                <>
                    <button onClick={handleSave} disabled={loading} className="px-5 py-2.5 rounded-xl bg-white border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 text-xs flex items-center gap-2">
                        <Save size={16}/> SPREMI
                    </button>
                    <button onClick={handleSubmit} disabled={loading} className="px-5 py-2.5 rounded-xl bg-[#1a3826] text-white font-bold hover:bg-[#142e1e] text-xs flex items-center gap-2 shadow-lg">
                        <Send size={16}/> POŠALJI
                    </button>
                </>
            )}

            {isManager && (
                <>
                    {(isSubmitted || isCompleted) && (
                        <button onClick={handleReturn} disabled={loading} className="px-5 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100 font-bold hover:bg-red-100 text-xs flex items-center gap-2">
                            <Undo2 size={16}/> VRATI NA DORADU
                        </button>
                    )}
                    {isSubmitted && (
                        <button onClick={handleSubmit} disabled={loading} className="px-5 py-2.5 rounded-xl bg-[#FFC72C] text-[#1a3826] font-bold hover:bg-[#e6b225] text-xs flex items-center gap-2 shadow-lg">
                            <Check size={16}/> ODOBRI
                        </button>
                    )}
                </>
            )}
        </div>
      </div>

      {/* --- HIDDEN PDF TEMPLATE (Pure Inline CSS - No Tailwind) --- */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={reportRef} style={pdfStyles.container}>
            <div style={pdfStyles.header}>
                <div>
                    <div style={pdfStyles.sub}>PDS EVALUACIJA • {pds.year}</div>
                    <h1 style={pdfStyles.h1}>{pds.user.name}</h1>
                    <div style={pdfStyles.sub}>{pds.user.email} • {pds.user.role}</div>
                </div>
                <div style={pdfStyles.scoreBox}>
                    <div style={pdfStyles.sub}>UKUPNI BODOVI</div>
                    <div style={pdfStyles.scoreVal}>{totalScore}</div>
                </div>
            </div>

            <div>
                {goals.map((goal, i) => (
                    <div key={i} style={pdfStyles.goalItem}>
                        <div style={pdfStyles.goalTop}>
                            <div style={pdfStyles.goalTitle}>{goal.title}</div>
                            <div style={pdfStyles.goalPts}>{goal.points} pts</div>
                        </div>
                        <div style={pdfStyles.resultBox}>
                            {/* Prikaz rezultata u PDFu */}
                            Rezultat: <b>{goal.type === 'BOOLEAN' ? (goal.result ? 'DA' : 'NE') : goal.result || 0}</b>
                        </div>
                    </div>
                ))}
            </div>

            <div style={pdfStyles.commentSection}>
                <div>
                    <strong style={{ fontSize: '12px', textTransform: 'uppercase' }}>Zaposlenik</strong>
                    <div style={pdfStyles.commentBox}>{employeeComment || '/'}</div>
                    <div style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '10px', marginBottom: '5px' }}>POTPIS:</div>
                        {employeeSignature ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={employeeSignature} alt="Potpis" style={pdfStyles.sigImg} />
                        ) : <div style={{height: '40px', borderBottom: '1px dashed #ccc'}}></div>}
                    </div>
                </div>
                <div>
                    <strong style={{ fontSize: '12px', textTransform: 'uppercase' }}>Manager</strong>
                    <div style={pdfStyles.commentBox}>{managerComment || '/'}</div>
                    <div style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '10px', marginBottom: '5px' }}>POTPIS:</div>
                        {managerSignature ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={managerSignature} alt="Potpis" style={pdfStyles.sigImg} />
                        ) : <div style={{height: '40px', borderBottom: '1px dashed #ccc'}}></div>}
                    </div>
                </div>
            </div>
            
            <div style={{ textAlign: 'center', marginTop: '40px', fontSize: '10px', color: '#ccc' }}>
                Generirano: {new Date().toLocaleDateString()}
            </div>
        </div>
      </div>

      {/* --- FORM FOR USER INTERACTION (VIDLJIVA FORMA) --- */}
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
         <div className="flex justify-between items-start border-b-2 border-slate-100 pb-8 mb-8">
             <div>
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">PDS EVALUACIJA • {pds.year}</div>
                 <h2 className="text-3xl font-black text-[#1a3826] uppercase mb-1">{pds.user.name}</h2>
                 <p className="text-sm font-medium text-slate-500">{pds.user.email} • {pds.user.role}</p>
             </div>
             <div className="text-right bg-slate-50 p-4 rounded-2xl border border-slate-100">
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">UKUPNI BODOVI</div>
                 <div className="text-5xl font-black text-[#1a3826]">{totalScore}</div>
             </div>
         </div>

         <div className="space-y-6 mb-10">
            {goals.map((goal, i) => (
                <div key={i} className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-bold text-slate-800 w-3/4 leading-tight">{goal.title}</h3>
                        <div className="px-3 py-1 rounded-lg bg-white border border-slate-200 shadow-sm">
                            <span className="text-[10px] font-black text-slate-400 uppercase mr-2">OSTVARENO</span>
                            <span className="text-lg font-black text-[#1a3826]">{goal.points}</span>
                        </div>
                    </div>

                    {goal.type === 'BOOLEAN' ? (
                        <div className="flex gap-3">
                            <button 
                                onClick={() => canEmployeeEdit && handleGoalChange(i, true)}
                                disabled={!canEmployeeEdit}
                                className={`flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                                    goal.result === true 
                                    ? 'bg-[#1a3826] border-[#1a3826] text-white font-bold' 
                                    : 'bg-white border-slate-200 text-slate-300'
                                }`}
                            >
                                <Check size={18} strokeWidth={3} /> DA 
                                {/* SKRIVENO OD RADNIKA: Bodovi */}
                                {isManager && <span className="text-[10px] opacity-70 ml-1">({goal.yesPoints} pts)</span>}
                            </button>

                            <button 
                                onClick={() => canEmployeeEdit && handleGoalChange(i, false)}
                                disabled={!canEmployeeEdit}
                                className={`flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                                    goal.result === false 
                                    ? 'bg-red-500 border-red-500 text-white font-bold' 
                                    : 'bg-white border-slate-200 text-slate-300'
                                }`}
                            >
                                <X size={18} strokeWidth={3} /> NE
                                {/* SKRIVENO OD RADNIKA: Bodovi */}
                                {isManager && <span className="text-[10px] opacity-70 ml-1">({goal.noPoints} pts)</span>}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Uneseni Rezultat</label>
                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">Numerički</span>
                            </div>
                            <input 
                                type="number" 
                                disabled={!canEmployeeEdit}
                                value={goal.result as string}
                                onChange={(e) => handleGoalChange(i, e.target.value)}
                                className="w-full text-2xl font-black text-slate-800 bg-transparent border-b-2 border-slate-100 focus:border-[#1a3826] outline-none py-1 disabled:bg-transparent"
                                placeholder="0"
                            />
                            {/* SKRIVENO OD RADNIKA: Skala bodovanja */}
                            {isManager && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {goal.scoringRules?.map((r: PDSScoringRule, ri: number) => (
                                        <span key={ri} className={`text-[10px] px-2 py-1 rounded border ${
                                            parseFloat(goal.result as string) >= r.from && parseFloat(goal.result as string) <= r.to
                                            ? 'bg-[#1a3826] text-white border-[#1a3826]'
                                            : 'bg-slate-100 text-slate-400 border-slate-200'
                                        }`}>
                                            {r.from}-{r.to} = <b>{r.pts}</b>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t-2 border-slate-100 pt-8">
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">1</div>
                    <h3 className="text-sm font-black text-slate-800 uppercase">Zaposlenik</h3>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 min-h-[120px]">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Komentar</label>
                    <textarea 
                        disabled={!canEmployeeEdit}
                        value={employeeComment}
                        onChange={(e) => setEmployeeComment(e.target.value)}
                        className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none resize-none h-full disabled:cursor-not-allowed"
                        placeholder="Nema komentara..."
                    />
                </div>

                <SignaturePad 
                    label="Potpis Zaposlenika"
                    value={employeeSignature} 
                    onChange={setEmployeeSignature} 
                    disabled={!canEmployeeEdit}
                />
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-[#1a3826] flex items-center justify-center text-white font-bold text-xs">2</div>
                    <h3 className="text-sm font-black text-slate-800 uppercase">Manager</h3>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 min-h-[120px]">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Komentar</label>
                    <textarea 
                        disabled={!canManagerEdit}
                        value={managerComment}
                        onChange={(e) => setManagerComment(e.target.value)}
                        className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none resize-none h-full disabled:cursor-not-allowed"
                        placeholder="Nema komentara..."
                    />
                </div>

                <SignaturePad 
                    label="Potpis Managera"
                    value={managerSignature} 
                    onChange={setManagerSignature} 
                    disabled={!canManagerEdit}
                />
            </div>
         </div>
      </div>
    </div>
  );
}