"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRestaurantStaff } from "@/app/actions/userActions";
import { 
  Users, TrendingUp, PlaneTakeoff, Shield, 
  ShieldCheck, ArrowRight, UserPlus, History, Store 
} from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedRestName, setSelectedRestName] = useState("");

  // Provjera online statusa (aktivnost u zadnjih 5 minuta)
  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    const diffInMinutes = (new Date().getTime() - new Date(lastSeen).getTime()) / 60000;
    return diffInMinutes < 5;
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    
    const restId = localStorage.getItem("selected_restaurant_id");
    const restName = localStorage.getItem("selected_restaurant_name");
    
    if (restName) setSelectedRestName(restName);
    
    if (restId) {
      getRestaurantStaff(restId).then(data => setStaff(data));
    }
  }, [status, router]);

  const isAdmin = (session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'SUPER_ADMIN';

  if (status === "loading") return (
    <div className="flex h-screen items-center justify-center bg-[#1a3826]">
      <div className="w-8 h-8 border-4 border-white/20 border-t-[#FFC72C] rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-full bg-white animate-in fade-in duration-500">
      
      {/* HEADER SA SWITCHOM */}
      <div className="px-10 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20">
        <div>
          <h1 className="text-xl font-black text-[#1a3826] uppercase tracking-tight">Kontrolna Tabla</h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Status: {selectedRestName}</p>
        </div>
        {isAdmin && (
          <button onClick={() => router.push('/select-restaurant')} className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-emerald-50 text-[#1a3826] rounded-xl text-[10px] font-black uppercase transition-all border border-slate-100">
            <Store size={14} /> Promijeni Restoran
          </button>
        )}
      </div>

      <div className="p-10 max-w-[1600px] mx-auto w-full grid grid-cols-1 lg:grid-cols-4 gap-10">
        
        {/* LIJEVA I SREDNJA KOLONA */}
        <div className="lg:col-span-3 space-y-10">
          
          {/* STATISTIČKE KARTICE - SADA SA STVARNIM BROJEM OSOBLJA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><Users size={20} /></div>
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Aktivno Osoblje</span>
              </div>
              <p className="text-4xl font-black text-[#1a3826]">{staff.length}</p>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={20} /></div>
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Efikasnost</span>
              </div>
              <p className="text-4xl font-black text-[#1a3826]">94.2%</p>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl"><PlaneTakeoff size={20} /></div>
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Godišnji</span>
              </div>
              <p className="text-4xl font-black text-[#1a3826]">2</p>
            </div>
          </div>

          {/* LISTA LJUDI SA PERMISIJAMA I ONLINE STATUSOM */}
          <div className="bg-white rounded-[3rem] border border-slate-100 p-10 shadow-sm">
            <h3 className="text-[#1a3826] font-black uppercase text-xs tracking-widest mb-8 flex items-center gap-2">
              <Shield size={16} className="text-amber-500" /> Osoblje sa pristupom
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {staff.map((person) => {
                const online = isOnline(person.lastSeen);
                return (
                  <div key={person.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-[2rem] hover:bg-slate-100 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center text-[#1a3826] font-black text-xs shadow-sm">
                          {person.name?.substring(0, 2).toUpperCase()}
                        </div>
                        {online && <span className="absolute bottom-0 right-0 block h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-white animate-pulse" />}
                      </div>
                      <div>
                        <p className="text-xs font-black text-[#1a3826] uppercase leading-none">{person.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1.5">{person.role} • {person.email}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${online ? 'text-green-600' : 'text-slate-300'}`}>
                      {online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ADMIN AKCIJE */}
          {isAdmin && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button onClick={() => router.push('/admin/users')} className="flex items-center justify-between p-8 bg-[#1a3826] text-white rounded-[2.5rem] hover:scale-[1.02] transition-all shadow-xl group">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl text-yellow-400"><ShieldCheck size={24}/></div>
                  <div className="text-left">
                    <p className="font-black uppercase text-sm tracking-tight">Administracija</p>
                    <p className="text-[10px] text-emerald-200/50 font-bold uppercase">Upravljanje bazom</p>
                  </div>
                </div>
                <ArrowRight size={20} className="opacity-40 group-hover:opacity-100" />
              </button>
              <button onClick={() => router.push('/admin/users/new')} className="flex items-center justify-between p-8 bg-white border-2 border-dashed border-slate-200 text-[#1a3826] rounded-[2.5rem] hover:border-[#1a3826] transition-all group">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:text-[#1a3826]"><UserPlus size={24}/></div>
                  <div className="text-left">
                    <p className="font-black uppercase text-sm tracking-tight">Novi Korisnik</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Kreiraj nalog</p>
                  </div>
                </div>
                <ArrowRight size={20} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          )}
        </div>

        {/* DESNA KOLONA: LOGOVI */}
        <div className="bg-slate-50 rounded-[3rem] border border-slate-100 p-8 flex flex-col h-full">
          <h3 className="text-[#1a3826] font-black uppercase text-[10px] mb-8 flex items-center gap-2">
            <History size={16} /> Zadnje Aktivnosti
          </h3>
          <div className="space-y-8 flex-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="relative pl-6 border-l border-slate-200 pb-2">
                <div className="absolute -left-[4.5px] top-0 w-2 h-2 bg-emerald-500 rounded-full"></div>
                <p className="text-[11px] font-black text-slate-800 uppercase leading-none">Uređen profil</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Prije {i * 15} min</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}