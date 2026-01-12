"use client";

import { useState } from "react";
import { updateVacationStatus, addBlockedDay, removeBlockedDay } from "@/app/actions/vacationActions";
import { Check, X, Trash2, Calendar, Download, Building2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// FIX: Strogi tipovi da TypeScript ne viče "Unexpected any"
interface BlockedDay {
    id: string;
    date: string;
    reason: string | null;
}

interface UserStat {
    id: string;
    name: string | null;
    restaurantNames: string[]; // Niz imena za pametan prikaz
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
        name: string | null; 
        email: string | null; 
        mainRestaurant: string; // Dodano polje
    };
}

interface AdminViewProps {
    allRequests: RequestWithUser[];
    blockedDays: BlockedDay[];
    usersStats: UserStat[];
}

export default function AdminView({ allRequests, blockedDays, usersStats }: AdminViewProps) {
    const [activeTab, setActiveTab] = useState<"REQUESTS" | "BLOCKED" | "STATS">("REQUESTS");
    const [newBlockedDate, setNewBlockedDate] = useState("");
    const [newBlockedReason, setNewBlockedReason] = useState("");

    const handleStatus = async (id: string, status: "APPROVED" | "REJECTED") => {
        if(confirm(`Promijeniti status u ${status}?`)) {
            await updateVacationStatus(id, status);
        }
    };

    const handleAddBlocked = async () => {
        if (!newBlockedDate) return alert("Odaberite datum");
        await addBlockedDay(newBlockedDate, newBlockedReason || "Praznik");
        setNewBlockedDate(""); setNewBlockedReason("");
    };

    const exportPDF = (filterRestName?: string) => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Izvjestaj: Godisnji Odmori", 14, 22);
        
        const dataToExport = filterRestName 
            ? usersStats.filter(u => u.restaurantNames.includes(filterRestName))
            : usersStats;

        const tableData = dataToExport.map(u => [
            u.name || "N/A",
            u.restaurantNames.join(", "),
            u.total, u.used, u.remaining
        ]);

        autoTable(doc, {
            head: [['Ime i Prezime', 'Restorani', 'Ukupno', 'Used', 'Preostalo']],
            body: tableData,
            startY: 40,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [26, 56, 38] } 
        });

        doc.save("izvjestaj_odmori.pdf");
    };

    const allUniqueRestaurants = Array.from(new Set(usersStats.flatMap(u => u.restaurantNames)));

    return (
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-[#F8FAFC]">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-black text-[#1a3826]">ADMIN <span className="text-orange-400">GODIŠNJI</span></h1>
                
                <div className="flex bg-white p-1 rounded-xl shadow-sm border">
                    <button onClick={() => setActiveTab("REQUESTS")} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeTab === 'REQUESTS' ? 'bg-[#1a3826] text-white' : 'text-slate-500'}`}>ZAHTJEVI</button>
                    <button onClick={() => setActiveTab("BLOCKED")} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeTab === 'BLOCKED' ? 'bg-[#1a3826] text-white' : 'text-slate-500'}`}>PRAZNICI</button>
                    <button onClick={() => setActiveTab("STATS")} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeTab === 'STATS' ? 'bg-[#1a3826] text-white' : 'text-slate-500'}`}>STATISTIKA</button>
                </div>
            </div>

            {/* TAB 1: ZAHTJEVI */}
            {activeTab === "REQUESTS" && (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase">
                            <tr>
                                <th className="p-4">Radnik</th>
                                <th className="p-4">Period</th>
                                <th className="p-4">Dana</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Akcije</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {allRequests.map((req) => (
                                <tr key={req.id} className="hover:bg-slate-50">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800">{req.user.name}</div>
                                        <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{req.user.mainRestaurant}</div>
                                    </td>
                                    <td className="p-4 font-mono text-slate-500">{req.start} - {req.end}</td>
                                    <td className="p-4 font-bold">{req.days}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${req.status === 'APPROVED' ? 'bg-green-100 text-green-700' : req.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{req.status}</span>
                                    </td>
                                    <td className="p-4 text-right flex justify-end gap-2">
                                        {req.status === 'PENDING' && (
                                            <>
                                                <button onClick={() => handleStatus(req.id, 'APPROVED')} className="bg-green-50 text-green-600 p-2 rounded hover:bg-green-100"><Check size={16}/></button>
                                                <button onClick={() => handleStatus(req.id, 'REJECTED')} className="bg-red-50 text-red-600 p-2 rounded hover:bg-red-100"><X size={16}/></button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB 2: BLOKIRANI DANI */}
            {activeTab === "BLOCKED" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-fit">
                        <h3 className="font-bold mb-4 flex gap-2"><Calendar/> Dodaj Praznik</h3>
                        <div className="space-y-3">
                            <input type="date" value={newBlockedDate} onChange={e => setNewBlockedDate(e.target.value)} className="w-full border p-3 rounded-xl"/>
                            <input type="text" placeholder="Naziv praznika" value={newBlockedReason} onChange={e => setNewBlockedReason(e.target.value)} className="w-full border p-3 rounded-xl"/>
                            <button onClick={handleAddBlocked} className="w-full bg-[#1a3826] text-white py-3 rounded-xl font-bold uppercase text-xs">DODAJ PRAZNIK</button>
                        </div>
                    </div>

                    <div className="md:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <h3 className="font-bold mb-4">Lista Praznika</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {blockedDays.map(day => (
                                <div key={day.id} className="flex justify-between items-center p-3 bg-red-50 border border-red-100 rounded-xl">
                                    <div>
                                        <div className="font-bold text-red-800">{day.reason || "Praznik"}</div>
                                        <div className="text-xs text-red-500 font-mono">{day.date}</div>
                                    </div>
                                    <button onClick={() => { if(confirm("Obrisati praznik?")) removeBlockedDay(day.id) }} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: STATISTIKA */}
            {activeTab === "STATS" && (
                <div className="space-y-6">
                    <div className="flex gap-4 flex-wrap">
                        <button onClick={() => exportPDF()} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-700">
                            <Download size={18}/> EXPORT SVE (PDF)
                        </button>
                        {allUniqueRestaurants.map((name) => (
                            <button key={name} onClick={() => exportPDF(name)} className="bg-white border border-slate-200 text-slate-600 px-4 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50">
                                <Building2 size={16}/> {name}
                            </button>
                        ))}
                    </div>

                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase">
                                <tr>
                                    <th className="p-4 w-1/4">Ime i Prezime</th>
                                    <th className="p-4 w-1/3">Restorani</th>
                                    <th className="p-4 text-center">Ukupno</th>
                                    <th className="p-4 text-center text-green-600">Used</th>
                                    <th className="p-4 text-center text-orange-500 font-black">Preostalo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {usersStats.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-50">
                                        <td className="p-4 font-bold text-slate-800">{u.name}</td>
                                        <td className="p-4">
                                            {/* FIX: Pametni prikaz (slice + VIŠE) rješava layout pucanje */}
                                            <div className="flex flex-wrap gap-1 max-w-[300px]">
                                                {u.restaurantNames.slice(0, 2).map(name => (
                                                    <span key={name} className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-black uppercase">
                                                        {name}
                                                    </span>
                                                ))}
                                                {u.restaurantNames.length > 2 && (
                                                    <span className="bg-[#1a3826] text-white px-2 py-1 rounded text-[10px] font-black uppercase">
                                                        + {u.restaurantNames.length - 2} VIŠE
                                                    </span>
                                                )}
                                                {u.restaurantNames.length === 0 && <span className="text-xs text-slate-300">Nema restorana</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center font-bold text-slate-400">{u.total}</td>
                                        <td className="p-4 text-center font-bold text-green-700">{u.used}</td>
                                        <td className="p-4 text-center font-black text-orange-500 text-lg">{u.remaining}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}