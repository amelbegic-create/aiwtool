/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createVacationRequest,
  updateVacationRequest,
  cancelVacationRequest,
  deleteVacationRequest,
} from "@/app/actions/vacationActions";
import { toast } from "sonner";
import {
  Calendar,
  Trash2,
  Info,
  Briefcase,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit,
  Undo2,
  Download,
  Loader2,
} from "lucide-react";
import { Role } from "@prisma/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDateDDMMGGGG } from "@/lib/dateUtils";

interface VacationRequest {
  id: string;
  start: string;
  end: string;
  days: number;
  status: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  vacationEntitlement: number;
  vacationCarryover: number;
  role: Role;
  usedThisYear: number;
  selectedYearTotal?: number;
  selectedYearRemaining?: number;
}

interface BlockedDay {
  id: string;
  date: string;
  reason: string | null;
}

interface UserViewProps {
  userData: UserData;
  myRequests: VacationRequest[];
  blockedDays: BlockedDay[];
  selectedYear: number;
}

const formatDate = (dateStr: string) => formatDateDDMMGGGG(dateStr);

// Normalizacija teksta za PDF (umlaut → ae/oe/ue za Helvetica)
function normalizeText(text: string): string {
  return text
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "dj")
    .replace(/Đ/g, "Dj");
}

export default function UserView({
  userData,
  myRequests,
  blockedDays,
  selectedYear,
}: UserViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const years = [2025, 2026, 2027, 2028, 2029, 2030];

  const handleYearChange = (y: number) => {
    if (y === selectedYear) return;
    startTransition(() => {
      router.push(`/tools/vacations?year=${y}`);
    });
  };

  const tomorrow = (() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return t.toISOString().split("T")[0];
  })();

  // Koristimo vrijednosti iz page.tsx koje pravilno računaju vacationAllowances po godini
  const used = userData.usedThisYear;
  const total = userData.selectedYearTotal ?? (userData.vacationEntitlement || 0) + (userData.vacationCarryover || 0);
  const remaining = userData.selectedYearRemaining ?? total - used;

  const generateUserPDF = async () => {
    setIsExporting(true);
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        const doc = new jsPDF();
        
        // ZAGLAVLJE
        doc.setFillColor(26, 56, 38);
        doc.rect(0, 0, 210, 40, 'F');

        // AIWServices Logo Tekst
        doc.setTextColor(255, 199, 44);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(normalizeText("AIWServices"), 14, 12); 

        // Glavni Naslov
        doc.setTextColor(255, 255, 255); 
        doc.setFontSize(22);
        doc.text(normalizeText("URLAUBSBERICHT"), 14, 24); 
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(255, 199, 44); 
        doc.text(normalizeText(`Erstellt: ${formatDate(new Date().toISOString())}`), 14, 32);

        // PODACI O KORISNIKU
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(normalizeText(`Mitarbeiter: ${userData.name}`), 14, 55);
        doc.setFont("helvetica", "normal");
        doc.text(normalizeText(`E-Mail: ${userData.email}`), 14, 61);
        doc.text(normalizeText(`Jahr: ${selectedYear}`), 14, 67);

        // KARTICE STATISTIKE – sve zelene s bijelim slovima, centrirane na stranici
        const startY = 80;
        const boxWidth = 44;
        const boxGap = 8;
        const boxHeight = 20;
        const pageW = doc.internal.pageSize.getWidth();
        const boxesTotalWidth = boxWidth * 3 + boxGap * 2;
        const boxStartX = (pageW - boxesTotalWidth) / 2;
        const green = [26, 56, 38] as [number, number, number];
        const white = [255, 255, 255] as [number, number, number];

        const drawGreenBox = (x: number, label: string, value: string) => {
          doc.setFillColor(...green);
          doc.rect(x, startY, boxWidth, boxHeight, "F");
          doc.setFontSize(7);
          doc.setTextColor(...white);
          doc.setFont("helvetica", "normal");
          doc.text(normalizeText(label), x + boxWidth / 2, startY + 6, { align: "center" });
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.text(value, x + boxWidth / 2, startY + 15, { align: "center" });
        };

        drawGreenBox(boxStartX, "GESAMT TAGE", `${total}`);
        drawGreenBox(boxStartX + boxWidth + boxGap, "VERBRAUCHT", `${used}`);
        drawGreenBox(boxStartX + (boxWidth + boxGap) * 2, "RESTURLAUB", `${remaining}`);

        // TABLICA: Von, Bis, Tage, Status
        const statusToLabel: Record<string, string> = {
          APPROVED: "Genehmigt",
          REJECTED: "Abgelehnt",
          PENDING: "Ausstehend",
          RETURNED: "Zur Ueberarbeitung",
          CANCEL_PENDING: "Stornierung ausstehend",
          CANCELLED: "Storniert",
        };
        const tableBody = myRequests.map(req => {
          const statusText = statusToLabel[req.status] ?? req.status;
          return [formatDate(req.start), formatDate(req.end), req.days, normalizeText(statusText)];
        });

        autoTable(doc, {
          startY: startY + 40,
          head: [[normalizeText("Von"), normalizeText("Bis"), normalizeText("Tage"), normalizeText("Status")]],
          body: tableBody,
          theme: "grid",
          headStyles: { fillColor: [26, 56, 38], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
          styles: { fontSize: 10, cellPadding: 4, halign: "center" },
          columnStyles: {
            0: { cellWidth: 45, halign: "center" },
            1: { cellWidth: 45, halign: "center" },
            2: { cellWidth: 25, halign: "center" },
            3: { cellWidth: 55, halign: "center" },
          },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });

        const pageCount = (doc as any).internal.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(normalizeText("Erstellt ueber AIWServices Tools"), 105, 290, { align: "center" });
        }

        doc.save(`Urlaubsbericht_${selectedYear}_${userData.name.replace(/\s+/g, "_").replace(/[^\w\-]/g, "")}.pdf`);
    } catch (error) {
        console.error(error);
        alert("Fehler beim Erstellen der PDF.");
    } finally {
        setIsExporting(false);
    }
  };

  const handleSubmit = async () => {
    if (!start || !end) return alert("Bitte wählen Sie Start- und Enddatum.");

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    tomorrowDate.setHours(0, 0, 0, 0);
    if (startDate < tomorrowDate) {
      return alert("Das Startdatum muss morgen oder später liegen. Anträge für vergangene Tage sind nicht möglich.");
    }
    
    if (new Date(start).getFullYear() !== selectedYear) {
        if(!confirm(`Hinweis: Die gewählten Daten liegen nicht im angezeigten Jahr (${selectedYear}). Trotzdem fortfahren?`)) return;
    }

    setLoading(true);
    try {
      if (editingId) {
          await updateVacationRequest(editingId, { start, end });
          toast.success("Antrag aktualisiert.");
          setEditingId(null);
      } else {
          await createVacationRequest({ start, end });
          toast.success("Antrag erfolgreich erstellt.");
      }
      setStart("");
      setEnd("");
      router.refresh();
    } catch (e: any) {
      alert(e.message || "Ein Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (req: VacationRequest) => {
      setStart(req.start);
      setEnd(req.end);
      setEditingId(req.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = async (id: string) => {
      if (confirm("Möchten Sie diesen genehmigten Urlaub wirklich stornieren? Ein Administrator muss die Stornierung genehmigen.")) {
          try {
              await cancelVacationRequest(id);
              toast.success("Urlaubsantrag storniert.");
              router.refresh();
          } catch (e: any) {
              alert(e.message);
          }
      }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-5 sm:p-6 md:p-10 font-sans text-foreground">
      <div className={`max-w-6xl mx-auto space-y-6 sm:space-y-8 transition-opacity duration-150 ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-black text-[#1a3826] uppercase tracking-tighter mb-2">
                    MEIN <span className="text-[#FFC72C]">URLAUB</span>
                </h1>
                <p className="text-muted-foreground text-sm font-medium">
                    Übersicht der Tage und Anträge für <span className="font-bold text-foreground">{selectedYear}</span>
                </p>
            </div>
            
            <div className="flex flex-col items-end gap-2">
                <button
                    onClick={generateUserPDF}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-4 py-2 bg-[#FFC72C] hover:bg-[#e6b225] text-[#1a3826] rounded-xl text-xs font-black uppercase shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                    {isExporting ? <Loader2 size={16} className="animate-spin"/> : <Download size={16} />}
                    PDF-BERICHT
                </button>

                <div className="flex items-center gap-2">
                    {isPending && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <Loader2 size={14} className="animate-spin shrink-0" />
                            Laden…
                        </span>
                    )}
                    <div className="flex bg-card p-1 rounded-xl shadow-sm border border-border overflow-x-auto max-w-full gap-0.5">
                        {years.map(y => (
                            <button
                                key={y}
                                onClick={() => handleYearChange(y)}
                                disabled={isPending}
                                className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap touch-manipulation ${
                                    selectedYear === y 
                                    ? "bg-[#1a3826] text-white shadow-md" 
                                    : "text-muted-foreground hover:bg-accent"
                                } disabled:opacity-70`}
                            >
                                {y}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-6">
            
            {/* KARTICE STATISTIKE */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-card p-6 rounded-2xl shadow-sm border border-border flex flex-col items-center justify-center">
                <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                  GESAMT ({selectedYear})
                </div>
                <div className="text-3xl font-black text-foreground">
                  {total}
                </div>
              </div>
              <div className="bg-card p-6 rounded-2xl shadow-sm border border-border flex flex-col items-center justify-center">
                <div className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">
                  VERBRAUCHT
                </div>
                <div className="text-3xl font-black text-green-700">
                  {used}
                </div>
              </div>
              <div className="bg-[#1a3826] p-6 rounded-2xl shadow-md border border-[#1a3826] flex flex-col items-center justify-center text-white">
                <div className="text-[10px] font-black text-[#FFC72C] uppercase tracking-widest mb-1">
                  RESTURLAUB
                </div>
                <div className="text-3xl font-black text-[#FFC72C]">
                  {remaining}
                </div>
              </div>
            </div>

            {/* FORMA ZA SLANJE */}
            <div className={`bg-card p-8 rounded-3xl shadow-sm border transition-all ${editingId ? 'border-orange-300 dark:border-orange-600 ring-4 ring-orange-50 dark:ring-orange-950/50' : 'border-border'}`}>
              <h3 className="font-bold text-card-foreground mb-6 flex items-center gap-2 text-lg">
                {editingId ? (
                    <span className="text-orange-600 flex items-center gap-2"><Edit size={20}/> Antrag bearbeiten</span>
                ) : (
                    <span className="flex items-center gap-2"><Calendar className="text-[#1a3826]" /> Neuer Urlaubsantrag</span>
                )}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase mb-2 block">
                    Von (ab morgen)
                  </label>
                  <input
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    min={tomorrow}
                    className="w-full border border-border p-3 sm:p-4 min-h-[44px] rounded-xl focus:border-[#1a3826] outline-none font-bold text-foreground bg-muted/50 focus:bg-card transition-colors text-base touch-manipulation"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase mb-2 block">
                    Bis
                  </label>
                  <input
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    min={start || undefined}
                    className="w-full border border-border p-3 sm:p-4 min-h-[44px] rounded-xl focus:border-[#1a3826] outline-none font-bold text-foreground bg-muted/50 focus:bg-card transition-colors text-base touch-manipulation"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                  {editingId && (
                      <button 
                        onClick={() => { setEditingId(null); setStart(""); setEnd(""); }}
                        className="min-h-[44px] px-6 py-3 rounded-xl font-bold uppercase text-sm bg-muted text-muted-foreground hover:bg-accent transition-colors touch-manipulation"
                      >
                          Abbrechen
                      </button>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className={`flex-1 min-h-[44px] text-white py-3 rounded-xl font-black uppercase text-sm shadow-md active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed touch-manipulation ${
                        editingId ? "bg-orange-500 hover:bg-orange-600" : "bg-[#1a3826] hover:bg-[#142e1e]"
                    }`}
                  >
                    {loading ? "Wird gesendet…" : editingId ? "AKTUALISIEREN UND SENDEN" : "ANTRAG STELLEN"}
                  </button>
              </div>
              
              <div className="mt-4 flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/50 p-3 rounded-lg border border-border">
                <Info size={14} className="shrink-0 mt-0.5" />
                <p>
                  Das System zieht Wochenenden und Feiertage automatisch ab. Bitte planen Sie Ihre Abwesenheit rechtzeitig.
                </p>
              </div>
            </div>

            {/* PRAZNICI */}
            <div className="bg-red-50 dark:bg-red-950/30 p-6 rounded-3xl border border-red-100 dark:border-red-900/50">
              <h3 className="font-bold text-red-900 dark:text-red-200 mb-4 flex items-center gap-2">
                <Info size={18} /> Feiertage ({selectedYear})
              </h3>
              <div className="flex flex-wrap gap-2">
                {blockedDays.filter(d => new Date(d.date).getFullYear() === selectedYear).map((day) => (
                  <div
                    key={day.id}
                    className="bg-card dark:bg-red-950/20 px-3 py-2 rounded-lg border border-red-100 dark:border-red-900/50 shadow-sm flex items-center gap-2"
                  >
                    <span className="text-xs font-bold text-foreground">
                      {day.reason}
                    </span>
                    <span className="text-[10px] font-mono text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1.5 rounded">
                      {formatDate(day.date)}
                    </span>
                  </div>
                ))}
                {blockedDays.filter(d => new Date(d.date).getFullYear() === selectedYear).length === 0 && (
                  <span className="text-xs text-muted-foreground italic">
                    Keine Feiertage für dieses Jahr eingetragen.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* MOJA HISTORIJA (DESNO) */}
          <div className="bg-card p-6 rounded-3xl shadow-sm border border-border h-fit">
            <h3 className="font-bold text-card-foreground mb-6 flex items-center gap-2">
              <Clock className="text-[#1a3826] dark:text-[#FFC72C]" /> Verlauf
            </h3>
            
            <div className="space-y-4">
              {myRequests.map((req) => (
                <div
                  key={req.id}
                  className={`p-4 rounded-2xl border transition-colors group relative ${
                      req.status === 'RETURNED' ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800' : 
                      req.status === 'CANCEL_PENDING' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 animate-pulse' :
                      req.status === 'CANCELLED' ? 'bg-muted/50 border-border opacity-75' :
                      'bg-muted/50 border-border hover:border-border'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span
                      className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wide border ${
                        req.status === "APPROVED"
                          ? "bg-green-100 text-green-700 border-green-200"
                          : req.status === "REJECTED"
                          ? "bg-red-100 text-red-700 border-red-200"
                          : req.status === "RETURNED"
                          ? "bg-orange-100 text-orange-700 border-orange-200"
                          : req.status === "CANCEL_PENDING"
                          ? "bg-red-100 text-red-700 border-red-200"
                          : req.status === "CANCELLED"
                          ? "bg-gray-200 text-gray-600 border-gray-300"
                          : "bg-blue-100 text-blue-700 border-blue-200"
                      }`}
                    >
                      {req.status === "APPROVED" ? "GENEHMIGT" :
                       req.status === "REJECTED" ? "ABGELEHNT" :
                       req.status === "PENDING" ? "AUSSTEHEND" :
                       req.status === "RETURNED" ? "ZUR ÜBERARBEITUNG" : 
                       req.status === "CANCEL_PENDING" ? "STORNIERUNG AUSSTEHEND" :
                       req.status === "CANCELLED" ? "STORNIERT" : req.status}
                    </span>
                    
                    <div className="flex gap-1">
                        {req.status === "PENDING" && (
                        <button
                            onClick={() => {
                            if (confirm("Obrisati zahtjev trajno?"))
                                deleteVacationRequest(req.id);
                            }}
                            className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                            title="Löschen"
                        >
                            <Trash2 size={14} />
                        </button>
                        )}

                        {req.status === "RETURNED" && (
                            <button
                                onClick={() => handleEdit(req)}
                                className="text-orange-400 hover:text-orange-600 transition-colors p-1"
                                title="Antrag bearbeiten"
                            >
                                <Edit size={14} />
                            </button>
                        )}

                        {req.status === "APPROVED" && (
                            <button
                                onClick={() => handleCancel(req.id)}
                                className="text-red-300 hover:text-red-600 transition-colors p-1"
                                title="Genehmigten Urlaub stornieren"
                            >
                                <Undo2 size={14} />
                            </button>
                        )}
                    </div>
                  </div>
                  
                  <div className="text-xs font-mono text-muted-foreground mb-2 flex items-center gap-1">
                    <Calendar size={12} />
                    {formatDate(req.start)} <span className="text-muted-foreground/70">➜</span> {formatDate(req.end)}
                  </div>
                  
                  <div className="flex items-center gap-1 text-sm font-bold text-foreground">
                    <Briefcase size={14} className="text-muted-foreground" />
                    {req.days} {req.days === 1 ? "Tag" : "Tage"}
                  </div>

                  {req.status === "APPROVED" && (
                    <div className="absolute bottom-4 right-4 text-green-200 opacity-50 group-hover:opacity-100 transition-opacity">
                      <CheckCircle2 size={24} />
                    </div>
                  )}
                  {req.status === "RETURNED" && (
                    <div className="absolute bottom-4 right-4 text-orange-200 opacity-50 group-hover:opacity-100 transition-opacity">
                      <AlertCircle size={24} />
                    </div>
                  )}
                  {req.status === "CANCELLED" && (
                    <div className="absolute bottom-4 right-4 text-gray-200 opacity-50 transition-opacity">
                      <XCircle size={24} />
                    </div>
                  )}
                </div>
              ))}
              
              {myRequests.length === 0 && (
                <div className="text-center py-10 text-muted-foreground italic text-sm">
                  Sie haben keine Anträge für das Jahr {selectedYear}.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}