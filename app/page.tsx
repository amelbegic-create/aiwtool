"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedRestName, setSelectedRestName] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    setSelectedRestName(localStorage.getItem("selected_restaurant_name") || "Restoran");
  }, [status, router]);

  if (status === "loading") return (
    <div className="flex h-screen items-center justify-center bg-[#1a3826]">
      <div className="w-10 h-10 border-4 border-white/20 border-t-[#FFC72C] rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header iz starog dizajna */}
      <div className="px-8 py-6 border-b border-slate-100 bg-white">
        <h1 className="text-2xl font-black text-[#1a3826] uppercase tracking-tight">Kontrolna Tabla</h1>
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Sistem pregleda za {selectedRestName}</p>
      </div>

      <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Kartice koje smo imali prije deploya */}
        {[
          { label: "Trenutno na smjeni", val: "12", color: "bg-[#FFC72C]" },
          { label: "Produktivnost", val: "92.4%", color: "bg-emerald-500" },
          { label: "Sistemski status", val: "OK", color: "bg-emerald-500" }
        ].map((c, i) => (
          <div key={i} className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 flex flex-col">
            <span className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] mb-4">{c.label}</span>
            <span className="text-4xl font-black text-[#1a3826]">{c.val}</span>
            <div className={`mt-6 h-1 w-10 ${c.color} rounded-full`}></div>
          </div>
        ))}
      </div>

      <div className="px-8 flex-1">
         <div className="h-full border-2 border-dashed border-slate-100 rounded-[3rem] flex items-center justify-center text-slate-300 font-bold uppercase text-xs tracking-widest">
            Sekcija za analitiku
         </div>
      </div>
    </div>
  );
}