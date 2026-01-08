"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Users, 
  Activity, 
  TrendingUp, 
  ShieldCheck, 
  ArrowRight, 
  PlaneTakeoff, 
  History,
  Store,
  UserPlus
} from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedRest, setSelectedRest] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    setSelectedRest(localStorage.getItem("selected_restaurant_name") || "Glavni Dashboard");
  }, [status, router]);

  const isAdmin = (session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'SUPER_ADMIN';

  if (status === "loading") return (
    <div className="flex h-screen items-center justify-center bg-[#1a3826]">
      <div className="w-8 h-8 border-4 border-white/20 border-t-[#FFC72C] rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-full bg-white animate-in fade-in duration-500">
      
      {/* HEADER SA OPCIJOM SWITCHA ZA ADMINA */}
      <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20">
        <div>
          <h1 className="text-xl font-black text-[#1a3826] uppercase tracking-tight">Kontrolna Tabla</h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Status: {selectedRest}</p>
        </div>
        
        {isAdmin && (
          <button 
            onClick={() => router.push('/select-restaurant')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-emerald-50 text-[#1a3826] rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-slate-100"
          >
            <Store size={14} /> Promijeni Restoran
          </button>
        )}
      </div>

      <div className="p-8 max-w-[1600px] mx-auto w-full grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* LIJEVA I SREDNJA KOLONA (GLAVNI SADRŽAJ) */}
        <div className="lg:col-span-3 space-y-8">
          
          {/* MALE, KULTURNE STATISTIČKE KARTICE */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><Users size={20} /></div>
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Osoblje</span>
              </div>
              <p className="text-3xl font-black text-[#1a3826]">14</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={20} /></div>
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Efikasnost</span>
              </div>
              <p className="text-3xl font-black text-[#1a3826]">94.2%</p>
            </div>

            {/* KARTICA ZA GODIŠNJE ODMORE */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl"><PlaneTakeoff size={20} /></div>
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Godišnji</span>
              </div>
              <p className="text-3xl font-black text-[#1a3826]">2 <span className="text-sm font-bold text-slate-300">aktivna</span></p>
            </div>
          </div>

          {/* BRZE AKCIJE / ADMINISTRACIJA */}
          {isAdmin && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button 
                onClick={() => router.push('/admin/users')}
                className="flex items-center justify-between p-6 bg-[#1a3826] text-white rounded-[2rem] hover:scale-[1.02] transition-transform shadow-xl group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl text-yellow-400"><ShieldCheck size={24}/></div>
                  <div className="text-left">
                    <p className="font-black uppercase text-sm tracking-tight">Upravljanje Korisnicima</p>
                    <p className="text-[10px] text-emerald-200/50 font-bold uppercase">Administracija sistema</p>
                  </div>
                </div>
                <ArrowRight size={20} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              <button 
                onClick={() => router.push('/admin/users/new')}
                className="flex items-center justify-between p-6 bg-white border-2 border-dashed border-slate-200 text-[#1a3826] rounded-[2rem] hover:border-[#1a3826] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:text-[#1a3826]"><UserPlus size={24}/></div>
                  <div className="text-left">
                    <p className="font-black uppercase text-sm tracking-tight">Dodaj Korisnika</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Novi nalog</p>
                  </div>
                </div>
                <ArrowRight size={20} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          )}
        </div>

        {/* DESNA KOLONA: AKTIVNOSTI / LOGOVI */}
        <div className="bg-slate-50 rounded-[2.5rem] border border-slate-100 p-8 flex flex-col h-full">
          <h3 className="text-[#1a3826] font-black uppercase text-xs mb-6 flex items-center gap-2">
            <History size={16} /> Zadnje Aktivnosti
          </h3>
          
          <div className="space-y-6 flex-1 overflow-y-auto">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="relative pl-6 border-l-2 border-slate-200 pb-2">
                <div className="absolute -left-[9px] top-0 w-4 h-4 bg-white border-2 border-emerald-500 rounded-full"></div>
                <p className="text-xs font-bold text-slate-800 leading-tight">Uređen profil radnika</p>
                <p className="text-[9px] text-slate-400 font-black uppercase mt-1">Prije {i * 10} min</p>
              </div>
            ))}
          </div>

          <button className="mt-8 w-full py-3 bg-white text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100 hover:text-[#1a3826] transition-colors">
            Prikaži sve logove
          </button>
        </div>

      </div>
    </div>
  );
}