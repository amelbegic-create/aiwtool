/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo } from "react";
import {
  updateVacationStatus,
  addBlockedDay,
  removeBlockedDay,
} from "@/app/actions/vacationActions";
import {
  Check,
  X,
  Trash2,
  Calendar,
  Search,
  Users,
  Clock,
  RotateCcw,
  AlertOctagon,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Download
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// --- TIPOVI ---
type TabType = "STATS" | "REQUESTS" | "BLOCKED";

interface BlockedDay {
  id: string;
  date: string;
  reason: string | null;
}

interface UserStat {
  id: string;
  name: string | null;
  email?: string | null; // Dodano polje za email
  restaurantNames: string[];
  department: string | null;
  total: number;
  used: number;
  remaining: number;
}

interface RequestWithUser {
  id: string;
  start: string;
  end: string;
  days: number;
  status: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    mainRestaurant: string;
  };
}

interface AdminViewProps {
  allRequests: RequestWithUser[];
  blockedDays: BlockedDay[];
  usersStats: UserStat[];
  selectedYear: number;
}

export default function AdminView({
  allRequests,
  blockedDays,
  usersStats,
  selectedYear,
}: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("STATS");
  const [searchQuery, setSearchQuery] = useState("");
  
  // State za praznike
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [newBlockedReason, setNewBlockedReason] = useState("");

  // --- FILTERI ---
  const filteredStats = useMemo(() => {
    return usersStats.filter((u) => {
      const matchesSearch = u.name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [usersStats, searchQuery]);

  const filteredRequests = useMemo(() => {
    return allRequests.filter((req) => {
      const matchesSearch = req.user.name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [allRequests, searchQuery]);

  // --- AKCIJE ---
  const handleStatus = async (id: string, status: "APPROVED" | "REJECTED" | "RETURNED") => {
    const messages = {
        APPROVED: "Odobriti ovaj zahtjev?",
        REJECTED: "Odbiti ovaj zahtjev?",
        RETURNED: "Vratiti zahtjev radniku na doradu?"
    };
    if (confirm(messages[status])) {
      await updateVacationStatus(id, status);
    }
  };

  const handleAddBlocked = async () => {
    if (!newBlockedDate) return alert("Odaberite datum");
    await addBlockedDay(newBlockedDate, newBlockedReason || "Praznik");
    setNewBlockedDate("");
    setNewBlockedReason("");
  };

  // =====================================================================
  // 1. POJEDINAČNI IZVJEŠTAJ (ZA JEDNOG RADNIKA)
  // =====================================================================
  const exportIndividualReport = (user: UserStat) => {
    const doc = new jsPDF();
    
    // Filtriraj zahtjeve samo za ovog usera
    const userRequests = allRequests.filter(r => r.user.id === user.id);

    // ZAGLAVLJE
    doc.setFillColor(26, 56, 38); // AIW Green
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 199, 44); // Yellow
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("AIWServices", 14, 12); 

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
    doc.text(`Zaposlenik: ${user.name || "N/A"}`, 14, 55);
    doc.setFont("helvetica", "normal");
    doc.text(`Email: ${user.email || "N/A"}`, 14, 61);
    doc.text(`Godina: ${selectedYear}`, 14, 67);

    // KARTICE STATISTIKE
    const startY = 80;
    const boxWidth = 55;
    const boxHeight = 25;
    
    // Ukupno
    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240);
    doc.rect(14, startY, boxWidth, boxHeight, 'FD');
    doc.setFontSize(8); doc.setTextColor(100); doc.text("UKUPNO DANA", 19, startY + 8);
    doc.setFontSize(16); doc.setTextColor(30); doc.setFont("helvetica", "bold");
    doc.text(`${user.total}`, 19, startY + 18);

    // Iskorišteno
    doc.rect(14 + boxWidth + 10, startY, boxWidth, boxHeight, 'FD');
    doc.setFontSize(8); doc.setTextColor(22, 163, 74); doc.text("ISKORIŠTENO", 14 + boxWidth + 15, startY + 8);
    doc.setFontSize(16); doc.setTextColor(21, 128, 61);
    doc.text(`${user.used}`, 14 + boxWidth + 15, startY + 18);

    // Preostalo
    doc.setFillColor(26, 56, 38);
    doc.rect(14 + (boxWidth + 10) * 2, startY, boxWidth, boxHeight, 'F');
    doc.setFontSize(8); doc.setTextColor(255, 199, 44); doc.text("PREOSTALO", 14 + (boxWidth + 10) * 2 + 5, startY + 8);
    doc.setFontSize(16); doc.text(`${user.remaining}`, 14 + (boxWidth + 10) * 2 + 5, startY + 18);

    // TABLICA
    const tableBody = userRequests.map(req => [
        `${new Date(req.start).toLocaleDateString("bs-BA")} - ${new Date(req.end).toLocaleDateString("bs-BA")}`,
        req.days,
        req.status === 'APPROVED' ? 'ODOBRENO' : 
        req.status === 'REJECTED' ? 'ODBIJENO' : 
        req.status === 'PENDING' ? 'NA CEKANJU' : 
        req.status === 'RETURNED' ? 'VRACENO' : 'PONISTENO'
    ]);

    autoTable(doc, {
        startY: startY + 35,
        head: [['Period', 'Dana', 'Status']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [26, 56, 38], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 4 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        // noData property removed to fix TS error
    });

    doc.save(`Izvjestaj_${user.name}_${selectedYear}.pdf`);
  };

  // =====================================================================
  // 2. TABLIČNI PDF (SVI RADNICI)
  // =====================================================================
  const exportTablePDF = () => {
      const doc = new jsPDF();
      
      // Header
      doc.setFillColor(26, 56, 38); doc.rect(0, 0, 210, 30, 'F');
      doc.setTextColor(255, 199, 44); doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text("AIWServices", 14, 12);
      doc.setTextColor(255); doc.setFontSize(18);
      doc.text(`Status Godišnjih Odmora (${selectedYear})`, 14, 22);

      const data = filteredStats.map(u => [u.name, u.restaurantNames.join(', '), u.total, u.used, u.remaining]);
      
      autoTable(doc, {
          startY: 40,
          head: [['Ime', 'Restoran', 'Ukupno', 'Iskorišteno', 'Preostalo']],
          body: data,
          theme: 'grid',
          headStyles: { fillColor: [26, 56, 38] },
          alternateRowStyles: { fillColor: [248, 250, 252] }
      });
      doc.save(`Tabela_Godisnjih_${selectedYear}.pdf`);
  }

  // =====================================================================
  // 3. VIZUALNI TIMELINE (Gantt - Clean Look)
  // =====================================================================
  const exportTimelinePDF = () => {
    const doc = new jsPDF('l', 'mm', 'a3'); 
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    // Config
    const marginLeft = 60;
    const marginRight = 15;
    const marginTop = 40; 
    const gridWidth = width - marginLeft - marginRight;
    const monthWidth = gridWidth / 12; 
    const rowHeight = 10; 

    // Header
    doc.setFillColor(26, 56, 38);
    doc.rect(0, 0, width, 25, 'F');
    doc.setTextColor(255, 199, 44);
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("AIWServices", 15, 10);
    doc.setTextColor(255); doc.setFontSize(22);
    doc.text(`GODIŠNJI PLAN I RASPORED - ${selectedYear}`, 15, 20);

    // Legenda
    doc.setFontSize(8);
    doc.setFillColor(26, 56, 38); doc.rect(width - 60, 8, 4, 4, 'F'); 
    doc.setTextColor(255); doc.text("Odobreno", width - 54, 11);

    // Crtaj Mjesece (Grid Header)
    const months = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
    
    // Sivi header bar
    doc.setFillColor(245, 245, 245);
    doc.rect(marginLeft, marginTop - 10, gridWidth, 10, 'F');
    doc.setTextColor(50); doc.setFontSize(10); doc.setLineWidth(0.2); doc.setDrawColor(200);

    // Vertikalne linije mjeseci
    months.forEach((m, i) => {
        const x = marginLeft + (i * monthWidth);
        doc.text(m, x + (monthWidth/2), marginTop - 4, { align: 'center' });
        doc.line(x, marginTop - 10, x, height - 15);
    });
    doc.line(width - marginRight, marginTop - 10, width - marginRight, height - 15); // Zadnja

    let currentY = marginTop;

    filteredStats.forEach((user, index) => {
        // Nova stranica ako nema mjesta
        if (currentY > height - 20) {
            doc.addPage();
            currentY = 20;
            // Crtaj grid linije opet
            months.forEach((m, i) => {
                const x = marginLeft + (i * monthWidth);
                doc.setDrawColor(200);
                doc.line(x, 10, x, height - 15);
            });
            doc.line(width - marginRight, 10, width - marginRight, height - 15);
        }

        // Zebra red
        if (index % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(10, currentY, width - 20, rowHeight, 'F');
        }

        // Ime
        doc.setFontSize(9); doc.setTextColor(0); doc.setFont("helvetica", "bold");
        doc.text(user.name || "N/A", 12, currentY + 6);
        
        // Linija ispod
        doc.setDrawColor(230);
        doc.line(10, currentY + rowHeight, width - 10, currentY + rowHeight);

        // Barovi (Godišnji)
        const userRequests = allRequests.filter(r => r.user.id === user.id && r.status === 'APPROVED');
        
        userRequests.forEach(req => {
            const start = new Date(req.start);
            const end = new Date(req.end);
            
            if (start.getFullYear() === selectedYear) {
                // Pojednostavljena logika pozicije (Mjesec + postotak mjeseca)
                const startX = marginLeft + (start.getMonth() * monthWidth) + ((start.getDate() / 31) * monthWidth);
                
                // Krajnja točka
                let widthBar = 0;
                if (start.getMonth() === end.getMonth()) {
                    widthBar = ((end.getDate() - start.getDate()) / 31) * monthWidth;
                } else {
                    // Ako prelazi mjesec
                    const endX = marginLeft + (end.getMonth() * monthWidth) + ((end.getDate() / 31) * monthWidth);
                    widthBar = endX - startX;
                }
                
                widthBar = Math.max(widthBar, 2); 

                doc.setFillColor(26, 56, 38); // Green
                // Malo manji od reda
                doc.roundedRect(startX, currentY + 2, widthBar, rowHeight - 4, 1, 1, 'F');
            }
        });

        currentY += rowHeight;
    });

    doc.save(`Godisnji_Plan_${selectedYear}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* HEADER */}
        <div className="flex justify-between items-end border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] uppercase tracking-tighter mb-2">
              ADMIN <span className="text-[#FFC72C]">GODIŠNJI</span>
            </h1>
            <p className="text-slate-500 text-sm font-medium">Upravljanje odsustvima ({selectedYear})</p>
          </div>
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
             <button onClick={() => setActiveTab("STATS")} className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === "STATS" ? "bg-[#1a3826] text-white" : "text-slate-500 hover:bg-slate-50"}`}>STATISTIKA</button>
             <button onClick={() => setActiveTab("REQUESTS")} className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === "REQUESTS" ? "bg-[#1a3826] text-white" : "text-slate-500 hover:bg-slate-50"}`}>ZAHTJEVI</button>
             <button onClick={() => setActiveTab("BLOCKED")} className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === "BLOCKED" ? "bg-[#1a3826] text-white" : "text-slate-500 hover:bg-slate-50"}`}>PRAZNICI</button>
          </div>
        </div>

        {/* TOOLBAR */}
        {activeTab !== "BLOCKED" && (
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Search size={16} className="text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Traži radnika..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)}
                        className="bg-transparent outline-none text-sm font-bold text-slate-700 w-full md:w-64"
                    />
                </div>
                {activeTab === "STATS" && (
                    <div className="flex gap-2">
                        <button onClick={exportTablePDF} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all">
                            <FileSpreadsheet size={16}/> TABELA
                        </button>
                        <button onClick={exportTimelinePDF} className="flex items-center gap-2 px-4 py-2 bg-[#FFC72C] hover:bg-[#e0af25] rounded-lg text-xs font-black text-[#1a3826] transition-all">
                            <FileBarChart size={16}/> PLAN (TIMELINE)
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* --- CONTENT: STATISTIKA --- */}
        {activeTab === "STATS" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase">
              <div className="col-span-3">Zaposlenik</div>
              <div className="col-span-3">Restorani</div>
              <div className="col-span-4 grid grid-cols-3 text-center">
                <span>Ukupno</span><span>Iskorišteno</span><span>Preostalo</span>
              </div>
              <div className="col-span-2 text-right">Izvještaj</div>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredStats.length > 0 ? (
                  filteredStats.map((u) => (
                    <div key={u.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                      <div className="col-span-3 flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-[#1a3826] text-white flex items-center justify-center text-xs font-bold">
                              {u.name?.charAt(0)}
                          </div>
                          <div>
                              <div className="font-bold text-sm text-slate-800">{u.name}</div>
                              <div className="text-[10px] text-slate-400">{u.department || 'Nema odjela'}</div>
                          </div>
                      </div>
                      <div className="col-span-3 flex flex-wrap gap-1">
                          {u.restaurantNames.slice(0, 2).map((r, i) => <span key={i} className="text-[9px] bg-slate-100 px-2 py-1 rounded border border-slate-200">{r}</span>)}
                          {u.restaurantNames.length > 2 && <span className="text-[9px] bg-slate-100 px-2 py-1 rounded border border-slate-200">+{u.restaurantNames.length - 2}</span>}
                      </div>
                      <div className="col-span-4 grid grid-cols-3 text-center font-bold text-sm">
                          <span className="text-slate-400">{u.total}</span>
                          <span className="text-green-600">{u.used}</span>
                          <span className="text-orange-500">{u.remaining}</span>
                      </div>
                      <div className="col-span-2 text-right">
                          <button 
                            onClick={() => exportIndividualReport(u)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-2 text-[10px] font-bold uppercase"
                          >
                              <FileText size={14} /> PDF
                          </button>
                      </div>
                    </div>
                  ))
              ) : (
                  <div className="p-8 text-center text-slate-400 italic">Nema rezultata pretrage.</div>
              )}
            </div>
          </div>
        )}

        {/* --- CONTENT: ZAHTJEVI --- */}
        {activeTab === "REQUESTS" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase">
                        <tr>
                            <th className="p-4 pl-6">Radnik</th>
                            <th className="p-4">Period</th>
                            <th className="p-4 text-center">Dana</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right pr-6">Akcija</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredRequests.map(req => (
                            <tr key={req.id} className={`transition-colors ${req.status === 'CANCELLED' ? 'bg-gray-50 opacity-75' : 'hover:bg-slate-50'}`}>
                                <td className="p-4 pl-6">
                                    <div className="font-bold text-sm text-slate-800">{req.user.name}</div>
                                    <div className="text-[10px] text-slate-400 uppercase">{req.user.mainRestaurant}</div>
                                </td>
                                <td className="p-4 text-sm font-mono text-slate-600">{req.start} <span className="text-slate-300">➜</span> {req.end}</td>
                                <td className="p-4 text-center font-bold text-slate-700">{req.days}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold border ${
                                        req.status === 'APPROVED' ? 'bg-green-50 text-green-600 border-green-100' :
                                        req.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-100' :
                                        req.status === 'RETURNED' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                        req.status === 'CANCELLED' ? 'bg-gray-200 text-gray-600 border-gray-300' :
                                        'bg-blue-50 text-blue-600 border-blue-100'
                                    }`}>
                                        {req.status === 'CANCELLED' ? 'PONIŠTENO' : req.status === 'RETURNED' ? 'VRAĆENO' : req.status}
                                    </span>
                                </td>
                                <td className="p-4 pr-6 text-right">
                                    {req.status === 'PENDING' && (
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleStatus(req.id, "APPROVED")} className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded transition-colors"><Check size={16}/></button>
                                            <button onClick={() => handleStatus(req.id, "RETURNED")} className="p-2 bg-orange-50 hover:bg-orange-100 text-orange-500 rounded transition-colors"><RotateCcw size={16}/></button>
                                            <button onClick={() => handleStatus(req.id, "REJECTED")} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors"><X size={16}/></button>
                                        </div>
                                    )}
                                    {req.status === 'CANCELLED' && <div className="text-xs text-gray-400 font-bold flex items-center justify-end gap-1"><AlertOctagon size={14}/> Otkazano</div>}
                                </td>
                            </tr>
                        ))}
                        {filteredRequests.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Nema zahtjeva.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        )}

        {/* --- CONTENT: PRAZNICI --- */}
        {activeTab === "BLOCKED" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Calendar className="text-[#1a3826]" size={20}/> Novi Praznik</h3>
                    <div className="space-y-4">
                        <input type="date" className="w-full border border-slate-200 p-3 rounded-xl outline-none text-sm font-bold text-slate-700" value={newBlockedDate} onChange={e => setNewBlockedDate(e.target.value)} />
                        <input type="text" placeholder="Naziv Praznika" className="w-full border border-slate-200 p-3 rounded-xl outline-none text-sm font-bold text-slate-700" value={newBlockedReason} onChange={e => setNewBlockedReason(e.target.value)} />
                        <button onClick={handleAddBlocked} className="w-full bg-[#1a3826] hover:bg-[#142e1e] text-white py-3 rounded-xl font-bold uppercase text-xs transition-colors shadow-md active:scale-95">Dodaj</button>
                    </div>
                </div>
                <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-4">Kalendar Neradnih Dana ({selectedYear})</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {blockedDays.filter(d => new Date(d.date).getFullYear() === selectedYear).map(d => (
                            <div key={d.id} className="flex justify-between items-center p-4 bg-red-50 border border-red-100 rounded-xl group">
                                <div><div className="font-bold text-red-900 text-sm">{d.reason}</div><div className="text-xs text-red-500 font-mono mt-1">{new Date(d.date).toLocaleDateString("bs-BA")}</div></div>
                                <button onClick={() => { if(confirm("Obrisati?")) removeBlockedDay(d.id); }} className="text-red-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                            </div>
                        ))}
                        {blockedDays.filter(d => new Date(d.date).getFullYear() === selectedYear).length === 0 && <div className="col-span-full text-center py-10 text-slate-400 italic">Nema definisanih praznika.</div>}
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}