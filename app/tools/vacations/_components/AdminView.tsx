/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo } from "react";
import {
  updateVacationStatus,
  addBlockedDay,
  removeBlockedDay,
  getGlobalVacationStats // IMPORT ZA SERVER ACTION
} from "@/app/actions/vacationActions";
import {
  Check,
  X,
  Trash2,
  Calendar,
  Search,
  RotateCcw,
  AlertOctagon,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  Globe // Dodana ikona
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
  email?: string | null;
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

// Helper funkcija za formatiranje datuma (dd.MM.yyyy)
const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("bs-BA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

export default function AdminView({
  allRequests,
  blockedDays,
  usersStats,
  selectedYear,
}: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("STATS");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  
  // State za praznike
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [newBlockedReason, setNewBlockedReason] = useState("");

  // Provjera ima li zahtjeva na čekanju (za crvenu notifikaciju)
  const hasPendingRequests = useMemo(() => {
    return allRequests.some(r => r.status === 'PENDING' || r.status === 'CANCEL_PENDING');
  }, [allRequests]);

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
  const handleStatus = async (id: string, status: "APPROVED" | "REJECTED" | "RETURNED" | "CANCELLED") => {
    const messages: any = {
        APPROVED: "Odobriti ovaj zahtjev?",
        REJECTED: "Odbiti ovaj zahtjev?",
        RETURNED: "Vratiti zahtjev radniku na doradu?",
        CANCELLED: "Odobriti poništenje godišnjeg odmora? Ovo će osloboditi dane radniku."
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
    const userRequests = allRequests.filter(r => r.user.id === user.id);

    doc.setFillColor(26, 56, 38); doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 199, 44); doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("AIWServices", 14, 12); 
    doc.setTextColor(255, 255, 255); doc.setFontSize(22);
    doc.text("IZVJEŠTAJ O GODIŠNJEM ODMORU", 14, 24); 
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(255, 199, 44); 
    doc.text(`Generirano: ${formatDate(new Date().toISOString())}`, 14, 32);

    doc.setTextColor(0, 0, 0); doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text(`Zaposlenik: ${user.name || "N/A"}`, 14, 55);
    doc.setFont("helvetica", "normal");
    doc.text(`Email: ${user.email || "N/A"}`, 14, 61);
    doc.text(`Godina: ${selectedYear}`, 14, 67);

    const startY = 80;
    const boxWidth = 55;
    const boxHeight = 25;
    
    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240);
    doc.rect(14, startY, boxWidth, boxHeight, 'FD');
    doc.setFontSize(8); doc.setTextColor(100); doc.text("UKUPNO DANA", 19, startY + 8);
    doc.setFontSize(16); doc.setTextColor(30); doc.setFont("helvetica", "bold"); doc.text(`${user.total}`, 19, startY + 18);

    doc.rect(79, startY, 55, 25, 'FD');
    doc.setFontSize(8); doc.setTextColor(22, 163, 74); doc.text("ISKORIŠTENO", 84, startY + 8);
    doc.setFontSize(16); doc.setTextColor(21, 128, 61); doc.text(`${user.used}`, 84, startY + 18);

    doc.setFillColor(26, 56, 38); doc.rect(144, startY, 55, 25, 'F');
    doc.setFontSize(8); doc.setTextColor(255, 199, 44); doc.text("PREOSTALO", 149, startY + 8);
    doc.setFontSize(16); doc.text(`${user.remaining}`, 149, startY + 18);

    const tableBody = userRequests.map(req => [
        `${formatDate(req.start)} - ${formatDate(req.end)}`,
        req.days,
        req.status === 'APPROVED' ? 'ODOBRENO' : 
        req.status === 'REJECTED' ? 'ODBIJENO' : 
        req.status === 'PENDING' ? 'NA CEKANJU' : 
        req.status === 'RETURNED' ? 'VRACENO' : 
        req.status === 'CANCEL_PENDING' ? 'CEKA PONISTENJE' : 'PONISTENO'
    ]);

    autoTable(doc, {
        startY: startY + 35,
        head: [['Period', 'Dana', 'Status']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [26, 56, 38], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 10, cellPadding: 4, halign: 'center' },
        columnStyles: { 0: { halign: 'left' } },
        alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`Izvjestaj_${user.name}_${selectedYear}.pdf`);
  };

  // 2. TABLIČNI PDF
  const exportTablePDF = (overrideStats?: UserStat[]) => {
      const statsToUse = overrideStats || filteredStats;
      const doc = new jsPDF();
      
      doc.setFillColor(26, 56, 38); doc.rect(0, 0, 210, 30, 'F');
      doc.setTextColor(255, 199, 44); doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text("AIWServices", 14, 12);
      doc.setTextColor(255); doc.setFontSize(18);
      doc.text(`Status Godišnjih Odmora (${selectedYear})`, 14, 22);

      const data = statsToUse.map(u => [u.name, u.restaurantNames.join(', '), u.total, u.used, u.remaining]);
      
      autoTable(doc, {
          startY: 40,
          head: [['Ime i Prezime', 'Restoran', 'Ukupno', 'Iskorišteno', 'Preostalo']],
          body: data,
          theme: 'grid',
          headStyles: { fillColor: [26, 56, 38], halign: 'center' },
          bodyStyles: { halign: 'center' },
          columnStyles: { 0: { halign: 'left', fontStyle: 'bold' }, 1: { halign: 'left' } },
          alternateRowStyles: { fillColor: [248, 250, 252] }
      });
      doc.save(`Tabela_Godisnjih_${selectedYear}.pdf`);
  }

  // 3. VIZUALNI TIMELINE
  const exportTimelinePDF = (overrideStats?: UserStat[], overrideRequests?: RequestWithUser[]) => {
    const statsToUse = overrideStats || filteredStats;
    const requestsToUse = overrideRequests || allRequests;

    const doc = new jsPDF('l', 'mm', 'a3'); 
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const marginLeft = 60;
    const marginRight = 15;
    const marginTop = 40; 
    const gridWidth = width - marginLeft - marginRight;
    const monthWidth = gridWidth / 12; 
    const rowHeight = 10; 

    doc.setFillColor(26, 56, 38); doc.rect(0, 0, width, 25, 'F');
    doc.setTextColor(255, 199, 44); doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("AIWServices", 15, 10);
    doc.setTextColor(255); doc.setFontSize(22);
    doc.text(`GLOBALNI PLAN I RASPORED - ${selectedYear}`, 15, 20);

    doc.setFontSize(8);
    doc.setFillColor(26, 56, 38); doc.rect(width - 60, 8, 4, 4, 'F'); 
    doc.setTextColor(255); doc.text("Odobreno", width - 54, 11);

    const months = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
    doc.setFillColor(245, 245, 245); doc.rect(marginLeft, marginTop - 10, gridWidth, 10, 'F');
    doc.setTextColor(50); doc.setFontSize(10); doc.setLineWidth(0.2); doc.setDrawColor(200);

    months.forEach((m, i) => {
        const x = marginLeft + (i * monthWidth);
        doc.text(m, x + (monthWidth/2), marginTop - 4, { align: 'center' });
        doc.setDrawColor(200); doc.line(x, marginTop - 10, x, height - 15);
    });
    doc.line(width - marginRight, marginTop - 10, width - marginRight, height - 15);

    let currentY = marginTop;

    statsToUse.forEach((user, index) => {
        if (currentY > height - 20) { doc.addPage(); currentY = 20; }
        
        if (index % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(10, currentY, width - 20, rowHeight, 'F'); }

        doc.setFontSize(9); doc.setTextColor(0); doc.setFont("helvetica", "bold");
        doc.text(user.name || "N/A", 12, currentY + 6);
        doc.setDrawColor(230); doc.line(10, currentY + rowHeight, width - 10, currentY + rowHeight);

        // --- GODIŠNJI BAROVI ---
        const userRequests = requestsToUse.filter(r => r.user.id === user.id && r.status === 'APPROVED');
        userRequests.forEach(req => {
            const start = new Date(req.start); const end = new Date(req.end);
            if (start.getFullYear() === selectedYear) {
                const startX = marginLeft + (start.getMonth() * monthWidth) + ((start.getDate() / 31) * monthWidth);
                let widthBar = 0;
                if (start.getMonth() === end.getMonth()) widthBar = ((end.getDate() - start.getDate()) / 31) * monthWidth;
                else widthBar = (marginLeft + (end.getMonth() * monthWidth) + ((end.getDate() / 31) * monthWidth)) - startX;
                
                // Crtaj zeleni bar
                doc.setFillColor(26, 56, 38); 
                doc.roundedRect(startX, currentY + 2, Math.max(widthBar, 2), rowHeight - 4, 1, 1, 'F');
                
                // --- ISPRAVAK: CRVENA LINIJA SAMO UNUTAR BARA/REDA AKO SE POKLAPA ---
                blockedDays.forEach(blocked => {
                    const bDate = new Date(blocked.date);
                    // Ako praznik pada UNUTAR perioda godišnjeg odmora
                    if (bDate >= start && bDate <= end && bDate.getFullYear() === selectedYear) {
                        const holidayMIndex = bDate.getMonth();
                        const holidayDayOffset = (bDate.getDate() / 31) * monthWidth;
                        const holidayX = marginLeft + (holidayMIndex * monthWidth) + holidayDayOffset;
                        
                        doc.setDrawColor(200, 0, 0); // Crvena
                        doc.setLineWidth(0.8);
                        // Crtamo liniju SAMO visine zelenog bara (unutar njega)
                        doc.line(holidayX, currentY + 2, holidayX, currentY + rowHeight - 2);
                    }
                });
            }
        });
        currentY += rowHeight;
    });
    doc.save(`Globalni_Plan_${selectedYear}.pdf`);
  };

  const handleGlobalExport = async () => {
      setLoadingGlobal(true);
      try {
          const globalData = await getGlobalVacationStats(selectedYear);
          // Koristimo istu funkciju, ali sa override podacima
          exportTimelinePDF(globalData.usersStats, globalData.allRequests as any);
      } catch (error) {
          alert("Greška pri dohvatu globalnih podataka.");
      } finally {
          setLoadingGlobal(false);
      }
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
             <button 
                onClick={() => setActiveTab("STATS")} 
                className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === "STATS" ? "bg-[#1a3826] text-white" : "text-slate-500 hover:bg-slate-50"}`}
             >
                STATISTIKA
             </button>
             
             {/* DUGME ZAHTJEVI SA NOTIFIKACIJOM */}
             <button 
                onClick={() => setActiveTab("REQUESTS")} 
                className={`relative px-5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "REQUESTS" ? "bg-[#1a3826] text-white" : "text-slate-500 hover:bg-slate-50"}`}
             >
                ZAHTJEVI
                {hasPendingRequests && (
                    <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                )}
             </button>

             <button 
                onClick={() => setActiveTab("BLOCKED")} 
                className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === "BLOCKED" ? "bg-[#1a3826] text-white" : "text-slate-500 hover:bg-slate-50"}`}
             >
                PRAZNICI
             </button>
          </div>
        </div>

        {/* TOOLBAR */}
        {activeTab !== "BLOCKED" && (
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Search size={16} className="text-slate-400" />
                    <input type="text" placeholder="Traži radnika..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-transparent outline-none text-sm font-bold text-slate-700 w-full md:w-64" />
                </div>
                {activeTab === "STATS" && (
                    <div className="flex gap-2">
                        <button onClick={() => exportTablePDF()} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"><FileSpreadsheet size={16}/> TABELA</button>
                        <button onClick={() => exportTimelinePDF()} className="flex items-center gap-2 px-4 py-2 bg-[#FFC72C] hover:bg-[#e0af25] rounded-lg text-xs font-black text-[#1a3826] transition-all"><FileBarChart size={16}/> PLAN (TRENUTNI)</button>
                        {/* GLOBALNI EXPORT DUGME */}
                        <button onClick={handleGlobalExport} disabled={loadingGlobal} className="flex items-center gap-2 px-4 py-2 bg-[#1a3826] text-white rounded-lg text-xs font-black transition-all hover:bg-[#142e1e] disabled:opacity-70">
                            <Globe size={16}/> {loadingGlobal ? "UČITAVANJE..." : "GLOBALNI EXPORT"}
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* STATS TABLE */}
        {activeTab === "STATS" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase">
              <div className="col-span-3">Zaposlenik</div>
              <div className="col-span-3">Restorani</div>
              <div className="col-span-4 grid grid-cols-3 text-center"><span>Ukupno</span><span>Iskorišteno</span><span>Preostalo</span></div>
              <div className="col-span-2 text-right">Izvještaj</div>
            </div>
            <div className="divide-y divide-slate-100">
              {filteredStats.map((u) => (
                <div key={u.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#1a3826] text-white flex items-center justify-center text-xs font-bold">{u.name?.charAt(0)}</div>
                      <div><div className="font-bold text-sm text-slate-800">{u.name}</div><div className="text-[10px] text-slate-400 uppercase">{u.department}</div></div>
                  </div>
                  <div className="col-span-3 flex flex-wrap gap-1">
                      {u.restaurantNames.map((r, i) => <span key={i} className="text-[9px] bg-slate-100 px-2 py-1 rounded border border-slate-200">{r}</span>)}
                  </div>
                  <div className="col-span-4 grid grid-cols-3 text-center font-bold text-sm">
                      <span className="text-slate-400">{u.total}</span><span className="text-green-600">{u.used}</span><span className="text-orange-500">{u.remaining}</span>
                  </div>
                  <div className="col-span-2 text-right"><button onClick={() => exportIndividualReport(u)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-2 text-[10px] font-bold uppercase"><FileText size={14} /> PDF</button></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REQUESTS TABLE */}
        {activeTab === "REQUESTS" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase">
                        <tr><th className="p-4 pl-6">Radnik</th><th className="p-4">Period</th><th className="p-4 text-center">Dana</th><th className="p-4">Status</th><th className="p-4 text-right pr-6">Akcija</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredRequests.map(req => (
                            <tr key={req.id} className={`transition-colors ${req.status === 'CANCELLED' ? 'bg-gray-50 opacity-75' : 'hover:bg-slate-50'}`}>
                                <td className="p-4 pl-6">
                                    <div className="font-bold text-sm text-slate-800">{req.user.name}</div>
                                    <div className="text-[10px] text-slate-400 uppercase">{req.user.mainRestaurant}</div>
                                </td>
                                <td className="p-4 text-sm font-mono text-slate-600">
                                    {formatDate(req.start)} <span className="text-slate-300">➜</span> {formatDate(req.end)}
                                </td>
                                <td className="p-4 text-center font-bold text-slate-700">{req.days}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold border ${
                                        req.status === 'APPROVED' ? 'bg-green-50 text-green-600 border-green-100' :
                                        req.status === 'CANCEL_PENDING' ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' :
                                        req.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-100' :
                                        'bg-blue-50 text-blue-600 border-blue-100'
                                    }`}>
                                        {req.status === 'CANCEL_PENDING' ? 'TRAŽI PONIŠTENJE' : req.status === 'CANCELLED' ? 'PONIŠTENO' : req.status === 'RETURNED' ? 'VRAĆENO' : req.status}
                                    </span>
                                </td>
                                <td className="p-4 pr-6 text-right">
                                    <div className="flex justify-end gap-2">
                                        {req.status === 'PENDING' && (
                                            <>
                                                <button onClick={() => handleStatus(req.id, "APPROVED")} className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded transition-colors"><Check size={16}/></button>
                                                <button onClick={() => handleStatus(req.id, "RETURNED")} className="p-2 bg-orange-50 hover:bg-orange-100 text-orange-500 rounded transition-colors"><RotateCcw size={16}/></button>
                                                <button onClick={() => handleStatus(req.id, "REJECTED")} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors"><X size={16}/></button>
                                            </>
                                        )}
                                        {req.status === 'CANCEL_PENDING' && (
                                            <button onClick={() => handleStatus(req.id, "CANCELLED")} className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-red-700 shadow-md active:scale-95"><Trash2 size={14}/> ODOBRI PONIŠTENJE</button>
                                        )}
                                        {req.status === 'CANCELLED' && <span className="text-[10px] font-bold text-slate-400">PONIŠTENO</span>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {/* BLOCKED DAYS */}
        {activeTab === "BLOCKED" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Calendar className="text-[#1a3826]" size={20}/> Novi Praznik</h3>
                    <div className="space-y-4">
                        <input type="date" className="w-full border border-slate-200 p-3 rounded-xl outline-none text-sm font-bold text-slate-700" value={newBlockedDate} onChange={e => setNewBlockedDate(e.target.value)} />
                        <input type="text" placeholder="Naziv Praznika" className="w-full border border-slate-200 p-3 rounded-xl outline-none text-sm font-bold text-slate-700" value={newBlockedReason} onChange={e => setNewBlockedReason(e.target.value)} />
                        <button onClick={handleAddBlocked} className="w-full bg-[#1a3826] hover:bg-[#142e1e] text-white py-3 rounded-xl font-bold uppercase text-xs shadow-md active:scale-95">Dodaj</button>
                    </div>
                </div>
                <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-4 uppercase tracking-tighter">Kalendar Neradnih Dana ({selectedYear})</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {blockedDays.filter(d => new Date(d.date).getFullYear() === selectedYear).map(d => (
                            <div key={d.id} className="flex justify-between items-center p-4 bg-red-50 border border-red-100 rounded-xl group">
                                <div><div className="font-bold text-red-900 text-sm">{d.reason}</div><div className="text-xs text-red-500 font-mono mt-1">{formatDate(d.date)}</div></div>
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