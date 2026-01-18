/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createVacationRequest,
  updateVacationRequest,
  cancelVacationRequest,
  deleteVacationRequest,
} from "@/app/actions/vacationActions";
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

export default function UserView({
  userData,
  myRequests,
  blockedDays,
  selectedYear,
}: UserViewProps) {
  const router = useRouter();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const years = Array.from({ length: 7 }, (_, i) => 2024 + i);

  const used = userData.usedThisYear;
  const total = (userData.vacationEntitlement || 0) + (userData.vacationCarryover || 0);
  const remaining = total - used;

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
        doc.text("AIWServices", 14, 12); 

        // Glavni Naslov
        doc.setTextColor(255, 255, 255); 
        doc.setFontSize(22);
        doc.text("IZVJEŠTAJ O GODIŠNJEM ODMORU", 14, 24); 
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(255, 199, 44); 
        doc.text(`Generirano: ${new Date().toLocaleDateString("bs-BA")}`, 14, 32);

        // PODACI O KORISNIKU
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`Zaposlenik: ${userData.name}`, 14, 55);
        doc.setFont("helvetica", "normal");
        doc.text(`Email: ${userData.email}`, 14, 61);
        doc.text(`Godina: ${selectedYear}`, 14, 67);

        // KARTICE STATISTIKE
        const startY = 80;
        const boxWidth = 55;
        const boxHeight = 25;
        
        // Ukupno
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.rect(14, startY, boxWidth, boxHeight, 'FD');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("UKUPNO DANA", 19, startY + 8);
        doc.setFontSize(16);
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.text(`${total}`, 19, startY + 18);

        // Iskorišteno
        doc.rect(14 + boxWidth + 10, startY, boxWidth, boxHeight, 'FD');
        doc.setFontSize(8);
        doc.setTextColor(22, 163, 74);
        doc.text("ISKORIŠTENO", 14 + boxWidth + 15, startY + 8);
        doc.setFontSize(16);
        doc.setTextColor(21, 128, 61);
        doc.text(`${used}`, 14 + boxWidth + 15, startY + 18);

        // Preostalo
        doc.setFillColor(26, 56, 38);
        doc.rect(14 + (boxWidth + 10) * 2, startY, boxWidth, boxHeight, 'F');
        doc.setFontSize(8);
        doc.setTextColor(255, 199, 44);
        doc.text("PREOSTALO", 14 + (boxWidth + 10) * 2 + 5, startY + 8);
        doc.setFontSize(16);
        doc.text(`${remaining}`, 14 + (boxWidth + 10) * 2 + 5, startY + 18);

        // TABLICA
        const tableBody = myRequests.map(req => [
            `${new Date(req.start).toLocaleDateString("bs-BA")} - ${new Date(req.end).toLocaleDateString("bs-BA")}`,
            req.days,
            req.status === 'APPROVED' ? 'ODOBRENO' : 
            req.status === 'REJECTED' ? 'ODBIJENO' : 
            req.status === 'PENDING' ? 'NA CEKANJU' : 
            req.status === 'RETURNED' ? 'VRACENO' : 'PONISTENO'
        ]);

        autoTable(doc, {
            startY: startY + 40,
            head: [['Period', 'Dana', 'Status']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [26, 56, 38], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 10, cellPadding: 4 },
            columnStyles: {
                0: { cellWidth: 90 },
                1: { cellWidth: 30, halign: 'center' },
                2: { cellWidth: 60, halign: 'center' }
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            // FIX: Removed 'noData' property which caused error
        });

        const pageCount = (doc as any).internal.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text('Generirano putem AIWServices Tools', 105, 290, { align: 'center' });
        }

        doc.save(`Godisnji_Izvjestaj_${selectedYear}_${userData.name.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
        console.error(error);
        alert("Greška pri generiranju PDF-a.");
    } finally {
        setIsExporting(false);
    }
  };

  const handleSubmit = async () => {
    if (!start || !end) return alert("Molimo odaberite početni i krajnji datum.");
    
    if (new Date(start).getFullYear() !== selectedYear) {
        if(!confirm(`Upozorenje: Odabrali ste datume koji nisu u trenutno prikazanoj godini (${selectedYear}). Želite li nastaviti?`)) return;
    }

    setLoading(true);
    try {
      if (editingId) {
          await updateVacationRequest(editingId, { start, end });
          alert("Zahtjev ažuriran i ponovno poslan!");
          setEditingId(null);
      } else {
          await createVacationRequest({ start, end });
          alert("Zahtjev uspješno poslan!");
      }
      setStart("");
      setEnd("");
      router.refresh();
    } catch (e: any) {
      alert(e.message || "Došlo je do greške.");
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
      if (confirm("Jeste li sigurni da želite poništiti ovaj odobreni godišnji odmor?")) {
          try {
              await cancelVacationRequest(id);
              router.refresh();
          } catch (e: any) {
              alert(e.message);
          }
      }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-black text-[#1a3826] uppercase tracking-tighter mb-2">
                    MOJ <span className="text-[#FFC72C]">GODIŠNJI</span>
                </h1>
                <p className="text-slate-500 text-sm font-medium">
                    Pregled dana i slanje zahtjeva za <span className="font-bold text-slate-800">{selectedYear}.</span> godinu
                </p>
            </div>
            
            <div className="flex flex-col items-end gap-2">
                <button
                    onClick={generateUserPDF}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-4 py-2 bg-[#FFC72C] hover:bg-[#e6b225] text-[#1a3826] rounded-xl text-xs font-black uppercase shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                    {isExporting ? <Loader2 size={16} className="animate-spin"/> : <Download size={16} />}
                    PDF IZVJEŠTAJ
                </button>

                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto max-w-full">
                    {years.map(y => (
                        <button
                            key={y}
                            onClick={() => router.push(`/tools/vacations?year=${y}`)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                selectedYear === y 
                                ? "bg-[#1a3826] text-white shadow-md" 
                                : "text-slate-500 hover:bg-slate-50"
                            }`}
                        >
                            {y}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-6">
            
            {/* KARTICE */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  UKUPNO ({selectedYear})
                </div>
                <div className="text-3xl font-black text-slate-800">
                  {total}
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                <div className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">
                  ISKORIŠTENO
                </div>
                <div className="text-3xl font-black text-green-700">
                  {used}
                </div>
              </div>
              <div className="bg-[#1a3826] p-6 rounded-2xl shadow-md border border-[#1a3826] flex flex-col items-center justify-center text-white">
                <div className="text-[10px] font-black text-[#FFC72C] uppercase tracking-widest mb-1">
                  PREOSTALO
                </div>
                <div className="text-3xl font-black text-[#FFC72C]">
                  {remaining}
                </div>
              </div>
            </div>

            {/* FORMA */}
            <div className={`bg-white p-8 rounded-3xl shadow-sm border transition-all ${editingId ? 'border-orange-300 ring-4 ring-orange-50' : 'border-slate-200'}`}>
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-lg">
                {editingId ? (
                    <span className="text-orange-600 flex items-center gap-2"><Edit size={20}/> Uređivanje Zahtjeva</span>
                ) : (
                    <span className="flex items-center gap-2"><Calendar className="text-[#1a3826]" /> Novi Zahtjev</span>
                )}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">
                    Datum Od
                  </label>
                  <input
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="w-full border border-slate-200 p-4 rounded-xl focus:border-[#1a3826] outline-none font-bold text-slate-700 bg-slate-50 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">
                    Datum Do
                  </label>
                  <input
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="w-full border border-slate-200 p-4 rounded-xl focus:border-[#1a3826] outline-none font-bold text-slate-700 bg-slate-50 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                  {editingId && (
                      <button 
                        onClick={() => { setEditingId(null); setStart(""); setEnd(""); }}
                        className="px-6 py-4 rounded-xl font-bold uppercase text-sm bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                      >
                          Odustani
                      </button>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className={`flex-1 text-white py-4 rounded-xl font-black uppercase text-sm shadow-md active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed ${
                        editingId ? "bg-orange-500 hover:bg-orange-600" : "bg-[#1a3826] hover:bg-[#142e1e]"
                    }`}
                  >
                    {loading ? "Slanje..." : editingId ? "AŽURIRAJ I POŠALJI" : "POŠALJI ZAHTJEV"}
                  </button>
              </div>
              
              <div className="mt-4 flex items-start gap-2 text-[11px] text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <Info size={14} className="shrink-0 mt-0.5" />
                <p>
                  Sistem automatski izuzima vikende i praznike iz proračuna dana.
                  Molimo vas da planirate svoje odsustvo na vrijeme.
                </p>
              </div>
            </div>

            {/* PRAZNICI */}
            <div className="bg-red-50 p-6 rounded-3xl border border-red-100">
              <h3 className="font-bold text-red-900 mb-4 flex items-center gap-2">
                <Info size={18} /> Neradni Dani ({selectedYear})
              </h3>
              <div className="flex flex-wrap gap-2">
                {blockedDays.filter(d => new Date(d.date).getFullYear() === selectedYear).map((day) => (
                  <div
                    key={day.id}
                    className="bg-white px-3 py-2 rounded-lg border border-red-100 shadow-sm flex items-center gap-2"
                  >
                    <span className="text-xs font-bold text-slate-700">
                      {day.reason}
                    </span>
                    <span className="text-[10px] font-mono text-red-500 bg-red-50 px-1.5 rounded">
                      {new Date(day.date).toLocaleDateString("bs-BA")}
                    </span>
                  </div>
                ))}
                {blockedDays.filter(d => new Date(d.date).getFullYear() === selectedYear).length === 0 && (
                  <span className="text-xs text-slate-400 italic">
                    Nema unesenih praznika za ovu godinu.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* HISTORIJA */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-fit">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Clock className="text-[#1a3826]" /> Moja Historija
            </h3>
            
            <div className="space-y-4">
              {myRequests.map((req) => (
                <div
                  key={req.id}
                  className={`p-4 rounded-2xl border transition-colors group relative ${
                      req.status === 'RETURNED' ? 'bg-orange-50 border-orange-200' : 
                      req.status === 'CANCELLED' ? 'bg-gray-50 border-gray-200 opacity-75' :
                      'bg-slate-50 border-slate-100 hover:border-slate-200'
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
                          : req.status === "CANCELLED"
                          ? "bg-gray-200 text-gray-600 border-gray-300"
                          : "bg-blue-100 text-blue-700 border-blue-200"
                      }`}
                    >
                      {req.status === "RETURNED" ? "VRAĆENO NA DORADU" : 
                       req.status === "CANCELLED" ? "PONIŠTENO" : req.status}
                    </span>
                    
                    <div className="flex gap-1">
                        {req.status === "PENDING" && (
                        <button
                            onClick={() => {
                            if (confirm("Obrisati zahtjev trajno?"))
                                deleteVacationRequest(req.id);
                            }}
                            className="text-slate-300 hover:text-red-500 transition-colors p-1"
                            title="Obriši"
                        >
                            <Trash2 size={14} />
                        </button>
                        )}

                        {req.status === "RETURNED" && (
                            <button
                                onClick={() => handleEdit(req)}
                                className="text-orange-400 hover:text-orange-600 transition-colors p-1"
                                title="Uredi zahtjev"
                            >
                                <Edit size={14} />
                            </button>
                        )}

                        {req.status === "APPROVED" && (
                            <button
                                onClick={() => handleCancel(req.id)}
                                className="text-red-300 hover:text-red-600 transition-colors p-1"
                                title="Poništi odobreni zahtjev"
                            >
                                <Undo2 size={14} />
                            </button>
                        )}
                    </div>
                  </div>
                  
                  <div className="text-xs font-mono text-slate-500 mb-2 flex items-center gap-1">
                    <Calendar size={12} />
                    {req.start} <span className="text-slate-300">➜</span> {req.end}
                  </div>
                  
                  <div className="flex items-center gap-1 text-sm font-bold text-slate-800">
                    <Briefcase size={14} className="text-slate-400" />
                    {req.days} {req.days === 1 ? "dan" : "dana"}
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
                <div className="text-center py-10 text-slate-400 italic text-sm">
                  Nemate zahtjeva za {selectedYear}. godinu.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}