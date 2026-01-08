"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Activity, TrendingUp, ShieldCheck, ArrowRight } from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedRest, setSelectedRest] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    setSelectedRest(localStorage.getItem("selected_restaurant_name") || "Glavni Dashboard");
  }, [status, router]);

  if (status === "loading") return (
    <div className="flex h-screen items-center justify-center bg-[#1a3826]">
      <div className="w-10 h-10 border-4 border-white/20 border-t-[#FFC72C] rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-full bg-white animate-in fade-in duration-700">
      
      {/* GLAVNI HEADER */}
      <div className="px-10 py-10 border-b border-slate-100 bg-white sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] uppercase tracking-tight leading-none">Kontrolna Tabla</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.3em] mt-3">Sistem / {selectedRest}</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> Sistem Aktivan
            </div>
          </div>
        </div>
      </div>

      <div className="p-10 max-w-[1600px] mx-auto w-full space-y-10">
        
        {/* STATISTIČKE KARTICE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 group hover:bg-white hover:shadow-2xl transition-all cursor-default">
            <div className="flex justify-between items-start mb-6">
               <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Aktivno Osoblje</span>
               <Users className="text-slate-300 group-hover:text-[#1a3826]" size={24} />
            </div>
            <p className="text-6xl font-black text-[#1a3826]">14</p>
            <div className="mt-8 h-1.5 w-16 bg-[#FFC72C] rounded-full"></div>
          </div>

          <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 group hover:bg-white hover:shadow-2xl transition-all cursor-default">
            <div className="flex justify-between items-start mb-6">
               <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Produktivnost</span>
               <TrendingUp className="text-slate-300 group-hover:text-emerald-500" size={24} />
            </div>
            <p className="text-6xl font-black text-[#1a3826]">94.2%</p>
            <div className="mt-8 h-1.5 w-16 bg-emerald-500 rounded-full"></div>
          </div>

          <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 group hover:bg-white hover:shadow-2xl transition-all cursor-default text-emerald-500">
            <div className="flex justify-between items-start mb-6">
               <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Sistem OK</span>
               <Activity className="text-slate-200 group-hover:text-emerald-400" size={24} />
            </div>
            <p className="text-6xl font-black uppercase tracking-tighter italic">ONLINE</p>
            <div className="mt-8 h-1.5 w-16 bg-emerald-500 rounded-full"></div>
          </div>
        </div>

        {/* ADMIN SEKCIJA - Samo ako postoji /admin/users stranica */}
        {(session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'SUPER_ADMIN' ? (
          <div className="bg-[#1a3826] rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden group">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tight mb-3">Upravljanje Sistemskim Korisnicima</h2>
                <p className="text-emerald-200/60 max-w-xl font-medium">Uređujte profile zaposlenika, dodjeljujte dozvole za restorane i pratite sigurnosne zapise.</p>
              </div>
              <button 
                onClick={() => router.push('/admin/users')}
                className="bg-white text-[#1a3826] px-10 py-5 rounded-2xl font-black uppercase text-xs hover:bg-[#FFC72C] transition-all hover:scale-105 shadow-xl flex items-center gap-3"
              >
                Otvori Korisničku Bazu <ShieldCheck size={20} />
              </button>
            </div>
            <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform pointer-events-none">
              <Users size={300} />
            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}