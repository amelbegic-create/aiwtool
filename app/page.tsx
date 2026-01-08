"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Users, Activity, TrendingUp, ShieldCheck, 
  ArrowRight, PlaneTakeoff, History, Store, UserPlus 
} from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedRest, setSelectedRest] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    setSelectedRest(localStorage.getItem("selected_restaurant_name") || "Dashboard");
  }, [status, router]);

  const isAdmin = (session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'SUPER_ADMIN';

  if (status === "loading") return (
    <div className="flex h-screen items-center justify-center bg-[#1a3826]">
      <div className="w-8 h-8 border-4 border-white/20 border-t-[#FFC72C] rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      
      {/* HEADER SA SWITCHOM */}
      <div className="px-10 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
        <div>
          <h1 className="text-xl font-black text-[#1a3826] uppercase tracking-tight">Kontrolna Tabla</h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1.5 flex items-center gap-2">
             Sistem / <span className="text-[#1a3826]">{selectedRest}</span>
          </p>
        </div>
        
        {isAdmin && (
          <button 
            onClick={() => router.push('/select-restaurant')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-emerald-50 text-[#1a3826] rounded-xl text-[10px] font-black uppercase transition-all border border-slate-100 shadow-sm"
          >
            <Store size={14} /> Promijeni Lokaciju
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-10 max-w-[1600px] mx-auto w-full grid grid-cols-1 lg:grid-cols-4 gap-10">
        
        {/* LIJEVA STRANA (STATISTIKA I AKCIJE) */}
        <div className="lg:col-span-3 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shadow-sm"><Users size={20} /></div>
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Tim</span>
              </div>
              <p className="text-3xl font-black text-[#1a3826]">14 <span className="text-[10px] text-slate-300 ml-1">aktivnih</span></p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shadow-sm"><TrendingUp size={20} /></div>
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Produktivnost</span>
              </div>
              <p className="text-3xl font-black text-[#1a3826]">94.2%</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group cursor-pointer hover:border-amber-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shadow-sm"><PlaneTakeoff size={20} /></div>
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Godišnji</span>
              </div>
              <p className="text-3xl font-black text-[#1a3826]">2 <span className="text-[10px] text-slate-300 ml-1 tracking-tighter">u toku</span></p>
            </div>
          </div>

          {/* BRZE ADMIN AKCIJE */}
          {isAdmin && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button onClick={() => router.push('/admin/users')} className="p-6 bg-[#1a3826] text-white rounded-[2rem] hover:scale-[1.02] transition-all shadow-xl flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl text-yellow-400"><ShieldCheck size={24}/></div>
                  <div className="text-left"><p className="font-black uppercase text-sm">Lista Korisnika</p></div>
                </div>
                <ArrowRight size={20} className="opacity-40 group-hover:opacity-100" />
              </button>

              <button onClick={() => router.push('/admin/users/new')} className="p-6 bg-white border-2 border-dashed border-slate-200 text-[#1a3826] rounded-[2rem] hover:border-[#1a3826] transition-all flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:text-[#1a3826]"><UserPlus size={24}/></div>
                  <div className="text-left"><p className="font-black uppercase text-sm">Dodaj Radnika</p></div>
                </div>
                <ArrowRight size={20} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          )}
        </div>

        {/* DESNA STRANA (LOGA AKTIVNOSTI) */}
        <div className="bg-slate-50 rounded-[2.5rem] border border-slate-100 p-8 flex flex-col h-fit">
          <h3 className="text-[#1a3826] font-black uppercase text-[10px] tracking-widest mb-6 flex items-center gap-2">
            <History size={16} /> Zadnji Logovi
          </h3>
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="relative pl-6 border-l border-slate-200">
                <div className="absolute -left-[4.5px] top-0 w-2 h-2 bg-emerald-500 rounded-full"></div>
                <p className="text-[11px] font-black text-slate-800 uppercase leading-none">Ažuriran profil</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-tighter">Prije {i * 15} min</p>
              </div>
            ))}
          </div>
          <button className="mt-8 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-[#1a3826] transition-colors">Prikaži sve &rarr;</button>
        </div>
      </div>
    </div>
  );
}