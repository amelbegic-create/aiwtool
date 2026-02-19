/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
// FIX: Ispravne putanje
import { updatePDSContent, submitPDS, approvePDS, returnPDS, saveSignatureImage } from '../../../actions/pdsActions';
import { toast } from 'sonner';
import SignaturePad from '../components/SignaturePad';
import { Save, Send, ChevronLeft, Check, X, Undo2, FileDown, Loader2, CheckCircle2 } from 'lucide-react';
import { PDSGoal, PDSScoringRule } from '../types';
import jsPDF from 'jspdf';
import { formatDateDDMMGGGG } from '@/lib/dateUtils';

function isCanvasSignature(val: string | null): boolean {
  return typeof val === 'string' && val.startsWith('data:image');
}

interface Props {
  pds: any;
  isManager: boolean;
}

export default function PDSFormClient({ pds, isManager }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const [goals, setGoals] = useState<PDSGoal[]>(pds.goals as PDSGoal[]);
  const [employeeComment, setEmployeeComment] = useState(pds.employeeComment || '');
  const [managerComment, setManagerComment] = useState(pds.managerComment || '');
  const [employeeSignature, setEmployeeSignature] = useState(pds.employeeSignature || '');
  const [managerSignature, setManagerSignature] = useState(pds.managerSignature || '');

  const totalScore = goals.reduce((acc, g) => acc + (g.points || 0), 0);
  const finalGrade = pds.finalGrade ?? null;

  const isCompleted = pds.status === 'COMPLETED';
  const isSubmitted = pds.status === 'SUBMITTED';
  const isApproved = pds.status === 'APPROVED';
  const isReturned = pds.status === 'RETURNED';
  const isDraft = pds.status === 'DRAFT' || pds.status === 'OPEN' || pds.status === 'IN_PROGRESS';

  const canEmployeeEdit = !isManager && (isDraft || isReturned);
  const canManagerEdit = isManager && (isSubmitted || isApproved);
  const canEmployeeSign = !isManager && (isSubmitted || isApproved) && !isCanvasSignature(pds.employeeSignature);
  const canManagerSign = isManager && isApproved && !isCanvasSignature(pds.managerSignature);

  // --- PDF EXPORT (kompaktan: ocjena istaknuta, ciljevi mali, komentari wrap) ---
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const w = doc.internal.pageSize.getWidth();
      const margin = 14;
      const maxTextWidth = w - 2 * margin;
      let y = 18;

      const exportYear = pds.year - 1;
      const supervisorName = (pds.user as any)?.supervisor?.name ?? null;

      doc.setFillColor(26, 56, 38);
      doc.rect(0, 0, w, 28, 'F');
      doc.setTextColor(255, 199, 44);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('AIW Services', margin, 12);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text('PDS Beurteilung', margin, 20);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(255, 199, 44);
      doc.text(`Erstellt: ${formatDateDDMMGGGG(new Date())}`, margin, 26);

      // Godina desno u bijelom kvadratiću crnim slovima
      const yearBoxW = 22;
      const yearBoxH = 10;
      const yearBoxX = w - margin - yearBoxW;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(yearBoxX, 9, yearBoxW, yearBoxH, 1, 1, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(String(exportYear), yearBoxX + yearBoxW / 2, 9 + yearBoxH / 2 + 1.5, { align: 'center' });

      y = 36;
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(pds.user?.name ?? 'Mitarbeiter', margin, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`${pds.user?.email ?? ''} • ${pds.user?.role ?? ''}`, margin, y);
      y += 5;
      if (supervisorName) {
        doc.setFontSize(8);
        doc.text(`Vorgesetzte/r: ${supervisorName}`, margin, y);
        y += 5;
      }
      y += 5;

      // Ukupna ocjena u istom bloku kao ime (desno), da ne "pobjegne"
      const boxW = 42;
      const boxH = 28;
      const boxTop = Math.max(28, y - 18);
      doc.setFillColor(26, 56, 38);
      doc.roundedRect(w - margin - boxW, boxTop, boxW, boxH, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 199, 44);
      doc.text('BEWERTUNG', w - margin - boxW + 4, boxTop + 8);
      const boxCenterX = w - margin - boxW / 2;
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text(finalGrade ?? '–', boxCenterX, boxTop + 18, { align: 'center' });
      doc.setFontSize(8);
      doc.setTextColor(255, 199, 44);
      doc.text(`Punkte: ${totalScore}`, boxCenterX, boxTop + 24, { align: 'center' });

      y = Math.max(y, boxTop + boxH + 6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text('ZIELE UND ERGEBNISSE', margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('bodovanje', margin, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      const goalTextWidth = w - 2 * margin - 22;
      const goalLineHeight = 4.5;
      const scoreX = w - margin - 14;
      goals.forEach((goal: PDSGoal, i: number) => {
        if (y > 265) { doc.addPage(); y = 20; }
        const title = goal.title ?? `Ziel ${i + 1}`;
        const titleLines = doc.splitTextToSize(title, goalTextWidth);
        const res = goal.type === 'BOOLEAN' ? (goal.result ? 'Ja' : 'Nein') : String(goal.result ?? '');
        const blockTop = y;
        const titleHeight = titleLines.length * goalLineHeight;
        const resultY = blockTop + titleHeight + goalLineHeight;
        const rowH = titleHeight + goalLineHeight * 2 + 4;
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, blockTop - 2, w - 2 * margin, rowH, 'F');
        doc.setFont('helvetica', 'bold');
        titleLines.forEach((line: string, li: number) => {
          doc.text(line, margin + 2, blockTop + 2 + (li + 1) * goalLineHeight);
        });
        doc.setFont('helvetica', 'normal');
        doc.text(`Ergebnis: ${res}`, margin + 2, resultY + 2);
        doc.setTextColor(26, 56, 38);
        doc.setFont('helvetica', 'bold');
        doc.text(`${goal.points ?? 0} Pkt`, scoreX, blockTop + 2 + goalLineHeight);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        y = blockTop + rowH + 2;
      });

      y += 5;
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text('KOMMENTARE', margin, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const commentWidth = maxTextWidth - 4;
      const commentLineH = 5;
      doc.setFont('helvetica', 'bold');
      doc.text('Mitarbeiter:', margin, y);
      y += commentLineH;
      doc.setFont('helvetica', 'normal');
      const empText = (employeeComment || '–').trim() || '–';
      const empLines = doc.splitTextToSize(empText, commentWidth);
      empLines.forEach((line: string) => { doc.text(line, margin, y); y += commentLineH; });
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.text('Manager:', margin, y);
      y += commentLineH;
      doc.setFont('helvetica', 'normal');
      const mgrText = (managerComment || '–').trim() || '–';
      const mgrLines = doc.splitTextToSize(mgrText, commentWidth);
      mgrLines.forEach((line: string) => { doc.text(line, margin, y); y += commentLineH; });
      y += 10;

      if (y > 260) { doc.addPage(); y = 20; }

      // Potpisi: lijevo Mitarbeiter, desno Manager. Za System Architect korisnika ne prikazujemo blok potpisa.
      const isSystemArchitectUser = pds.user?.role === 'SYSTEM_ARCHITECT';
      const pageW = doc.internal.pageSize.getWidth();
      const sigImgW = 45;
      const sigImgH = 22;
      const leftX = margin;
      const rightX = pageW - margin - sigImgW;
      const empSigImg =
        typeof pds.employeeSignature === 'string' && pds.employeeSignature.startsWith('data:image')
          ? pds.employeeSignature
          : null;
      const mgrSigImg =
        typeof pds.managerSignature === 'string' && pds.managerSignature.startsWith('data:image')
          ? pds.managerSignature
          : null;

      if (!isSystemArchitectUser) {
        let sigY = y;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('UNTERSCHRIFTEN', margin, sigY);
        sigY += 7;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);

        // Mitarbeiter – lijevo
        doc.text('Unterschrift Mitarbeiter:', leftX, sigY);
        if (empSigImg) {
          try {
            doc.addImage(empSigImg, 'PNG', leftX, sigY + 2, sigImgW, sigImgH);
          } catch {
            doc.text('________________', leftX, sigY + 8);
          }
        } else {
          doc.text('________________', leftX, sigY + 5);
        }

        // Manager – desno
        doc.text('Unterschrift Manager:', rightX, sigY);
        if (mgrSigImg) {
          try {
            doc.addImage(mgrSigImg, 'PNG', rightX, sigY + 2, sigImgW, sigImgH);
          } catch {
            doc.text('________________', rightX, sigY + 8);
          }
        } else {
          doc.text('________________', rightX, sigY + 5);
        }

        sigY += sigImgH + 12;
        doc.setFontSize(7);
        doc.text('Erstellt: ' + formatDateDDMMGGGG(new Date()), margin, sigY + 5);
      } else {
        // System Architect – samo datum, bez potpisa
        doc.setFontSize(7);
        doc.text('Erstellt: ' + formatDateDDMMGGGG(new Date()), margin, y + 5);
      }

      doc.save(`PDS_Beurteilung_${(pds.user?.name ?? 'Mitarbeiter').replace(/\s+/g, '_').replace(/[^\w\-]/g, '')}_${pds.year}.pdf`);
    } catch (error) {
      console.error('Export PDF Error:', error);
      alert('Fehler beim PDF-Export.');
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
    setSavedFeedback(false);
    await updatePDSContent(pds.id, {
      goals, employeeComment, managerComment, employeeSignature, managerSignature
    });
    setLoading(false);
    setSavedFeedback(true);
    toast.success("Gespeichert.");
    setTimeout(() => setSavedFeedback(false), 3000);
    router.refresh();
  };

  const handleSubmit = async () => {
    if (!confirm('Sind Sie sicher?')) return;
    setLoading(true);
    await updatePDSContent(pds.id, {
      goals,
      employeeComment,
      managerComment,
      employeeSignature,
      managerSignature,
      scale: pds.scale
    });
    if (isManager) {
      await approvePDS(pds.id);
    } else {
      await submitPDS(pds.id);
    }
    setLoading(false);
    toast.success(isManager ? "PDS genehmigt." : "Antrag eingereicht.");
    router.refresh();
  };

  const handleReturn = async () => {
    if (!confirm('Zur Überarbeitung an den Mitarbeiter zurücksenden?')) return;
    setLoading(true);
    await returnPDS(pds.id, managerComment);
    setLoading(false);
    router.refresh();
  };

  const handleConfirmSignature = async (role: 'employee' | 'manager') => {
    const img = role === 'employee' ? employeeSignature : managerSignature;
    if (!img || !img.startsWith('data:image')) {
      alert('Bitte zeichnen Sie zuerst Ihre Unterschrift im Feld oben.');
      return;
    }
    setLoading(true);
    const res = await saveSignatureImage(pds.id, role, img);
    setLoading(false);
    if (res?.success) {
      toast.success("Unterschrift gespeichert.");
      router.refresh();
    } else alert(res?.error ?? 'Fehler beim Speichern der Unterschrift.');
  };

  return (
    <div className="max-w-5xl mx-auto pb-20">
      
      {/* UI HEADER (Tailwind OK) */}
      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col xl:flex-row justify-between items-center gap-4 sticky top-4 z-40">
        <div>
            <button onClick={() => router.back()} className="flex items-center text-slate-400 hover:text-slate-600 text-xs font-bold mb-2">
                <ChevronLeft size={14}/> ZURÜCK ZUR LISTE
            </button>
            <div className="flex items-center gap-3">
                <h1 className="text-xl md:text-2xl font-black text-[#1a3826] uppercase">{pds.user.name}</h1>
                <span className="px-2 py-1 rounded text-[10px] font-bold uppercase border bg-slate-50 text-slate-500 border-slate-200">
                    {pds.status === 'DRAFT' || pds.status === 'OPEN' || pds.status === 'IN_PROGRESS' ? 'Entwurf' : pds.status === 'SUBMITTED' || pds.status === 'PENDING' ? 'Eingereicht' : pds.status === 'APPROVED' ? 'Genehmigt' : pds.status === 'RETURNED' ? 'Zur Überarbeitung' : pds.status === 'ARCHIVED' ? 'Archiviert' : pds.status === 'COMPLETED' ? 'Abgeschlossen' : pds.status}
                </span>
            </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
            <button 
                onClick={handleExportPDF} 
                disabled={isExporting}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-2 border border-slate-200"
                title="PDF herunterladen"
            >
                {isExporting ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>}
                PDF HERUNTERLADEN
            </button>

            {canEmployeeEdit && (
                <>
                    <button onClick={handleSave} disabled={loading} className="px-5 py-2.5 rounded-xl bg-white border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 text-xs flex items-center gap-2" title="Als Entwurf speichern">
                        {savedFeedback ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <Save size={16}/>}
                        {savedFeedback ? "GESPEICHERT" : "SPEICHERN"}
                    </button>
                    <button onClick={handleSubmit} disabled={loading} className="px-5 py-2.5 rounded-xl bg-[#1a3826] text-white font-bold hover:bg-[#142e1e] text-xs flex items-center gap-2 shadow-lg" title="Abschließen und einreichen">
                        <Send size={16}/> ABSCHLIESSEN
                    </button>
                </>
            )}

            {isManager && (
                <>
                    {(isSubmitted || isApproved) && !isCompleted && (
                        <button onClick={handleReturn} disabled={loading} className="px-5 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100 font-bold hover:bg-red-100 text-xs flex items-center gap-2" title="Zur Überarbeitung zurücksenden">
                            <Undo2 size={16}/> ZURÜCK ZUR ÜBERARBEITUNG
                        </button>
                    )}
                    {isSubmitted && !isApproved && (
                        <button onClick={handleSubmit} disabled={loading} className="px-5 py-2.5 rounded-xl bg-[#FFC72C] text-[#1a3826] font-bold hover:bg-[#e6b225] text-xs flex items-center gap-2 shadow-lg" title="Beurteilung genehmigen">
                            <Check size={16}/> GENEHMIGEN
                        </button>
                    )}
                </>
            )}
        </div>
      </div>

      {/* --- FORM: jasna hijerarhija, svi elementi zadržani --- */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 max-w-4xl mx-auto">
         <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-200 pb-6 mb-6">
             <div className="min-w-0">
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">PDS Beurteilung • {pds.year - 1}</div>
                 <h2 className="text-2xl md:text-3xl font-black text-[#1a3826] uppercase tracking-tight leading-tight">{pds.user.name}</h2>
                 <p className="text-sm text-slate-600 mt-1">{pds.user.email} • <span className="font-medium text-slate-700">{pds.user.role}</span></p>
                 {(pds.user as any)?.supervisor?.name && (
                   <p className="text-xs text-slate-500 mt-0.5">Vorgesetzte/r: {(pds.user as any).supervisor.name}</p>
                 )}
             </div>
             <div className="text-right bg-[#1a3826] text-white p-4 rounded-xl min-w-[120px] shrink-0">
                 <div className="text-[10px] font-black text-[#FFC72C] uppercase tracking-widest mb-0.5">Bewertung</div>
                 <div className="text-xl font-black">{finalGrade ?? '–'}</div>
                 <div className="text-[10px] text-[#FFC72C] mt-1">Punkte: {totalScore}</div>
             </div>
         </div>

         <section className="mb-8">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Ziele und Ergebnisse</h3>
           <p className="text-[10px] text-slate-500 lowercase mb-4">bodovanje</p>
           <div className="space-y-4">
            {goals.map((goal, i) => (
                <div key={i} className="bg-slate-50/80 p-4 md:p-5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                    <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
                        <h4 className="text-sm font-bold text-slate-800 flex-1 min-w-0">{goal.title}</h4>
                        <span className="px-3 py-1 rounded-lg bg-[#1a3826] text-white text-xs font-bold shrink-0">
                            {goal.points} P
                        </span>
                    </div>

                    {goal.type === 'BOOLEAN' ? (
                        <div className="flex gap-3">
                            <button 
                                type="button"
                                onClick={() => canEmployeeEdit && handleGoalChange(i, true)}
                                disabled={!canEmployeeEdit}
                                className={`flex-1 py-3 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-bold transition-all ${
                                    goal.result === true 
                                    ? 'bg-[#1a3826] border-[#1a3826] text-white' 
                                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                }`}
                            >
                                <Check size={18} strokeWidth={3} /> Ja
                                {isManager && <span className="text-[9px] opacity-70">({goal.yesPoints} P)</span>}
                            </button>
                            <button 
                                type="button"
                                onClick={() => canEmployeeEdit && handleGoalChange(i, false)}
                                disabled={!canEmployeeEdit}
                                className={`flex-1 py-3 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-bold transition-all ${
                                    goal.result === false 
                                    ? 'bg-red-500 border-red-500 text-white' 
                                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                }`}
                            >
                                <X size={18} strokeWidth={3} /> Nein
                                {isManager && <span className="text-[9px] opacity-70">({goal.noPoints} P)</span>}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Ergebnis (Eingabe)</label>
                            <input 
                                type="number" 
                                disabled={!canEmployeeEdit}
                                value={goal.result as string}
                                onChange={(e) => handleGoalChange(i, e.target.value)}
                                className="w-full min-h-[48px] text-xl font-bold text-slate-800 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-[#1a3826] focus:ring-2 focus:ring-[#1a3826]/20 outline-none px-4 py-3 text-right disabled:bg-slate-100"
                                placeholder="0"
                            />
                            {goal.scoringRules?.length ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {goal.scoringRules.map((r: PDSScoringRule, ri: number) => (
                                        <span key={ri} className={`text-[9px] px-2 py-1 rounded border ${
                                            parseFloat(goal.result as string) >= r.from && parseFloat(goal.result as string) <= r.to
                                            ? 'bg-[#1a3826] text-white border-[#1a3826]'
                                            : 'bg-slate-100 text-slate-400 border-slate-200'
                                        }`}>
                                            {r.from}–{r.to} → {r.pts} P
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            ))}
           </div>
         </section>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t-2 border-slate-100 pt-8">
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">1</div>
                    <h3 className="text-sm font-black text-slate-800 uppercase">Mitarbeiter</h3>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 min-h-[120px]">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Kommentar</label>
                    <textarea 
                        disabled={!canEmployeeEdit}
                        value={employeeComment}
                        onChange={(e) => setEmployeeComment(e.target.value)}
                        className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none resize-none h-full disabled:cursor-not-allowed"
                        placeholder="Kein Kommentar…"
                    />
                </div>

                <SignaturePad 
                    label="Unterschrift Mitarbeiter"
                    value={typeof employeeSignature === 'string' && employeeSignature.startsWith('data:') ? employeeSignature : ''} 
                    onChange={setEmployeeSignature} 
                    disabled={!canEmployeeEdit && !canEmployeeSign}
                />
                {canEmployeeSign && (
                  <button type="button" onClick={() => handleConfirmSignature('employee')} disabled={loading || !employeeSignature?.startsWith('data:image')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a3826] text-white text-xs font-bold hover:bg-[#142e1e] disabled:opacity-50">
                    {loading ? <Loader2 size={14} className="animate-spin" /> : null} Unterschrift bestätigen
                  </button>
                )}
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-[#1a3826] flex items-center justify-center text-white font-bold text-xs">2</div>
                    <h3 className="text-sm font-black text-slate-800 uppercase">Manager</h3>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 min-h-[120px]">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Kommentar</label>
                    <textarea 
                        disabled={!canManagerEdit && !isApproved}
                        value={managerComment}
                        onChange={(e) => setManagerComment(e.target.value)}
                        className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none resize-none h-full disabled:cursor-not-allowed"
                        placeholder="Kein Kommentar…"
                    />
                </div>

                <SignaturePad 
                    label="Unterschrift Manager"
                    value={typeof managerSignature === 'string' && managerSignature.startsWith('data:') ? managerSignature : ''} 
                    onChange={setManagerSignature} 
                    disabled={!canManagerEdit && !canManagerSign}
                />
                {canManagerSign && (
                  <button type="button" onClick={() => handleConfirmSignature('manager')} disabled={loading || !managerSignature?.startsWith('data:image')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a3826] text-white text-xs font-bold hover:bg-[#142e1e] disabled:opacity-50">
                    {loading ? <Loader2 size={14} className="animate-spin" /> : null} Unterschrift bestätigen
                  </button>
                )}
            </div>
         </div>
      </div>
    </div>
  );
}