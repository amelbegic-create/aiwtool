"use client";

import { useState } from "react";
import { createVacationRequest, deleteVacationRequest } from "@/app/actions/vacationActions";
import { Calendar, Trash2, Info } from "lucide-react";
import { Role } from "@prisma/client";

// Interfejsi
interface VacationRequest {
    id: string;
    start: string;
    end: string;
    days: number;
    status: string;
}

interface UserData {
    id: string;
    vacationEntitlement: number;
    vacationCarryover: number;
    role: Role;
}

interface BlockedDay {
    id: string;
    date: string;
    reason: string | null;
}

interface UserViewProps {
    userData: UserData;
    myRequests: VacationRequest[];
    blockedDays: BlockedDay[]; // Dodali smo praznike ovdje
}

export default function UserView({ userData, myRequests, blockedDays }: UserViewProps) {
    const [start, setStart] = useState("");
    const [end, setEnd] = useState("");

    // Statistika
    const used = myRequests
        .filter((r) => r.status === "APPROVED")
        .reduce((sum, r) => sum + r.days, 0);
        
    const total = userData.vacationEntitlement + userData.vacationCarryover;
    const remaining = total - used;

    const handleSubmit = async () => {
        if (!start || !end) return alert("Unesite datume.");
        
        try {
            // Ne šaljemo više 'days', backend to računa
            await createVacationRequest({ start, end });
            alert("Zahtjev poslan!");
            setStart(""); setEnd("");
        } catch (e: unknown) {
             if (e instanceof Error) alert(e.message);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <h1 className="text-3xl font-black text-[#1a3826] mb-8">MOJ GODIŠNJI</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* LIJEVO: Formular i Info */}
                <div className="md:col-span-2 space-y-6">
                    {/* KARTICE STATISTIKE */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex justify-between">
                        <div className="text-center"><div className="text-xs font-bold text-slate-400">UKUPNO</div><div className="text-2xl font-black text-slate-800">{total}</div></div>
                        <div className="text-center"><div className="text-xs font-bold text-slate-400">ISKORIŠTENO</div><div className="text-2xl font-black text-[#1a3826]">{used}</div></div>
                        <div className="text-center"><div className="text-xs font-bold text-orange-500">OSTALO</div><div className="text-2xl font-black text-orange-500">{remaining}</div></div>
                    </div>

                    {/* FORMA */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <h3 className="font-bold mb-4 flex gap-2"><Calendar/> Novi Zahtjev</h3>
                        <div className="flex gap-4 mb-4">
                            <div className="w-full">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Od</label>
                                <input type="date" value={start} onChange={e => setStart(e.target.value)} className="border p-3 rounded-xl w-full"/>
                            </div>
                            <div className="w-full">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Do</label>
                                <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="border p-3 rounded-xl w-full"/>
                            </div>
                        </div>
                        <button onClick={handleSubmit} className="w-full bg-[#1a3826] text-white py-3 rounded-xl font-bold hover:bg-[#142d1f] transition-colors">POŠALJI ZAHTJEV</button>
                        <p className="text-[10px] text-slate-400 mt-3 text-center">* Sistem automatski odbija vikende i praznike iz proračuna.</p>
                    </div>

                    {/* LISTA PRAZNIKA (NOVO) */}
                    <div className="bg-red-50 p-6 rounded-3xl border border-red-100">
                        <h3 className="font-bold mb-4 flex gap-2 text-red-800"><Info size={20}/> Neradni Dani (Praznici)</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {blockedDays.map(day => (
                                <div key={day.id} className="bg-white p-2 rounded-lg border border-red-100 text-xs flex justify-between">
                                    <span className="font-bold text-slate-700">{day.reason}</span>
                                    <span className="font-mono text-slate-500">{day.date}</span>
                                </div>
                            ))}
                            {blockedDays.length === 0 && <span className="text-xs text-slate-400 italic">Nema unesenih praznika.</span>}
                        </div>
                    </div>
                </div>

                {/* DESNO: Istorija */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-fit">
                    <h3 className="font-bold mb-4">Moji Zahtjevi</h3>
                    <div className="space-y-3">
                        {myRequests.map((req) => (
                            <div key={req.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                                <div>
                                    <div className="text-xs font-bold text-slate-500">{req.start} / {req.end}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="text-[10px] font-bold px-2 py-0.5 rounded w-fit uppercase" style={{
                                            backgroundColor: req.status === 'APPROVED' ? '#dcfce7' : req.status === 'REJECTED' ? '#fee2e2' : '#ffedd5',
                                            color: req.status === 'APPROVED' ? '#166534' : req.status === 'REJECTED' ? '#991b1b' : '#9a3412'
                                        }}>{req.status}</div>
                                        <span className="text-[10px] font-bold text-slate-400">{req.days} dana</span>
                                    </div>
                                </div>
                                {req.status === 'PENDING' && (
                                    <button onClick={() => deleteVacationRequest(req.id)} className="text-slate-400 hover:text-red-500 p-2"><Trash2 size={16}/></button>
                                )}
                            </div>
                        ))}
                        {myRequests.length === 0 && <p className="text-slate-400 text-sm italic">Nema zahtjeva.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}