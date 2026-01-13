"use client";

import { useState } from "react";
import {
  createVacationRequest,
  deleteVacationRequest,
} from "@/app/actions/vacationActions";
import {
  Calendar,
  Trash2,
  Info,
  Briefcase,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Role } from "@prisma/client";

// --- TIPOVI ---
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
  blockedDays: BlockedDay[];
}

export default function UserView({
  userData,
  myRequests,
  blockedDays,
}: UserViewProps) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);

  // Statistika
  const used = myRequests
    .filter((r) => r.status === "APPROVED")
    .reduce((sum, r) => sum + r.days, 0);

  const total =
    (userData.vacationEntitlement || 0) + (userData.vacationCarryover || 0);
  const remaining = total - used;

  const handleSubmit = async () => {
    if (!start || !end) return alert("Molimo odaberite početni i krajnji datum.");
    setLoading(true);
    try {
      await createVacationRequest({ start, end });
      alert("Zahtjev uspješno poslan!");
      setStart("");
      setEnd("");
    } catch (e: unknown) {
      if (e instanceof Error) alert(e.message);
      else alert("Došlo je do greške.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div>
          <h1 className="text-3xl font-black text-[#1a3826] uppercase tracking-tighter mb-2">
            MOJ <span className="text-[#FFC72C]">GODIŠNJI</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            Pregled vaših dana i slanje zahtjeva
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LIJEVO: Glavni panel */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* STATISTIKE KARTICE */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  UKUPNO
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

            {/* FORMA ZA ZAHTJEV */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-lg">
                <Calendar className="text-[#1a3826]" /> Novi Zahtjev
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

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-[#1a3826] hover:bg-[#142e1e] text-white py-4 rounded-xl font-black uppercase text-sm shadow-md active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? "Slanje..." : "POŠALJI ZAHTJEV"}
              </button>
              
              <div className="mt-4 flex items-start gap-2 text-[11px] text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <Info size={14} className="shrink-0 mt-0.5" />
                <p>
                  Sistem automatski izuzima vikende i praznike iz proračuna dana.
                  Molimo vas da planirate svoje odsustvo na vrijeme.
                </p>
              </div>
            </div>

            {/* INFO O PRAZNICIMA */}
            <div className="bg-red-50 p-6 rounded-3xl border border-red-100">
              <h3 className="font-bold text-red-900 mb-4 flex items-center gap-2">
                <Info size={18} /> Neradni Dani
              </h3>
              <div className="flex flex-wrap gap-2">
                {blockedDays.map((day) => (
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
                {blockedDays.length === 0 && (
                  <span className="text-xs text-slate-400 italic">
                    Nema unesenih praznika.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* DESNO: Istorija */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-fit">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Clock className="text-[#1a3826]" /> Moja Historija
            </h3>
            
            <div className="space-y-4">
              {myRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors group relative"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span
                      className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wide border ${
                        req.status === "APPROVED"
                          ? "bg-green-100 text-green-700 border-green-200"
                          : req.status === "REJECTED"
                          ? "bg-red-100 text-red-700 border-red-200"
                          : "bg-orange-100 text-orange-700 border-orange-200"
                      }`}
                    >
                      {req.status}
                    </span>
                    {req.status === "PENDING" && (
                      <button
                        onClick={() => {
                          if (confirm("Obrisati zahtjev?"))
                            deleteVacationRequest(req.id);
                        }}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                        title="Otkaži"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
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
                </div>
              ))}
              
              {myRequests.length === 0 && (
                <div className="text-center py-10 text-slate-400 italic text-sm">
                  Nemate prethodnih zahtjeva.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}