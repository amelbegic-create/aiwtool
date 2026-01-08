"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Users, 
  TrendingUp, 
  Activity, 
  Clock, 
  Calendar as CalendarIcon,
  ChevronRight,
  ArrowUpRight
} from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedRestName, setSelectedRestName] = useState("");

  useEffect(() => {
    // Ako nema sesije, šaljemo na login
    if (status === "unauthenticated") {
      router.push("/login");
    }
    // Dohvaćamo ime restorana iz memorije
    const restName = localStorage.getItem("selected_restaurant_name");
    if (restName) setSelectedRestName(restName);
  }, [status, router]);

  // Prikaz učitavanja dok sesija ne postane aktivna
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1a3826]">
        <div className="w-10 h-10 border-4 border-white/20 border-t-[#FFC72C] rounded-full animate-spin"></div>
      </div>
    );
  }

  // Ako je ulogovan, prikazujemo originalni dizajn
  if (status === "authenticated") {
    return (
      <div className="p-4 lg:p-8 space-y-8 max-w-[1600px] mx-auto">
        
        {/* Naslovna sekcija sa statusom sistema */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-widest mb-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Live Sistem Status
            </div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
              Dashboard <span className="text-slate-400">/</span> {selectedRestName || "MCD Tool"}
            </h1>
          </div>
          
          <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
            <button className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold uppercase hover:bg-slate-100 transition-colors">Danas</button>
            <button className="px-4 py-2 text-slate-400 rounded-xl text-xs font-bold uppercase hover:text-slate-600 transition-colors">Sedmica</button>
            <button className="px-4 py-2 text-slate-400 rounded-xl text-xs font-bold uppercase hover:text-slate-600 transition-colors">Mjesec</button>
          </div>
        </div>

        {/* Kartice sa statistikom */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Aktivno Osoblje", value: "14", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Produktivnost", value: "94.2%", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Radni Sati", value: "112h", icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Status", value: "Optimalno", icon: Activity, color: "text-purple-600", bg: "bg-purple-50" }
          ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className={`${stat.bg} ${stat.color} p-3 rounded-2xl`}>
                  <stat.icon size={24} />
                </div>
                <div className="flex items-center gap-1 text-emerald-500 font-bold text-xs">
                  +12% <ArrowUpRight size={14} />
                </div>
              </div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">{stat.label}</p>
              <h3 className="text-2xl font-black text-slate-900">{stat.value}</h3>
            </div>
          ))}
        </div>

        {/* Donja sekcija sa aktivnostima */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Zadnje Aktivnosti</h3>
              <button className="text-emerald-600 font-bold text-xs uppercase flex items-center gap-1">Prikaži sve <ChevronRight size={14}/></button>
            </div>
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                    <Users size={18} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-800">Nova prijava smjene</h4>
                    <p className="text-xs text-slate-400 font-medium tracking-tight">Prije 5 minuta</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase">Uspješno</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1a3826] rounded-[2.5rem] p-8 text-white">
             <h3 className="text-xl font-black uppercase tracking-tight mb-4">Raspored</h3>
             <p className="text-emerald-200/60 text-sm mb-8">Pregledajte planirane aktivnosti za odabrani restoran.</p>
             <button className="w-full bg-[#FFC72C] text-[#1a3826] font-black py-4 rounded-2xl uppercase text-sm shadow-xl">
                Otvori kalendar
             </button>
          </div>
        </div>

      </div>
    );
  }

  return null;
}