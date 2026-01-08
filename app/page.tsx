"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedRest, setSelectedRest] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    setSelectedRest(localStorage.getItem("selected_restaurant_name") || "Restoran 1");
  }, [status, router]);

  if (status === "loading") return (
    <div className="flex h-screen items-center justify-center bg-[#1a3826]">
      <div className="w-10 h-10 border-4 border-white/20 border-t-[#FFC72C] rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header sekcija - MCD Tool Original */}
      <div className="px-10 py-8 border-b border-slate-100 bg-white">
        <h1 className="text-2xl font-black text-[#1a3826] uppercase tracking-tight">Kontrolna Tabla</h1>
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Dashboard / {selectedRest}</p>
      </div>

      <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Kartice koje si imao na početku */}
        <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100">
          <span className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] block mb-4">Aktivno Osoblje</span>
          <span className="text-5xl font-black text-[#1a3826]">12</span>
          <div className="mt-6 h-1 w-12 bg-[#FFC72C] rounded-full"></div>
        </div>

        <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100">
          <span className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] block mb-4">Produktivnost</span>
          <span className="text-5xl font-black text-[#1a3826]">92.4%</span>
          <div className="mt-6 h-1 w-12 bg-emerald-500 rounded-full"></div>
        </div>

        <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100">
          <span className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] block mb-4">Sistem</span>
          <span className="text-5xl font-black text-emerald-500">OK</span>
          <div className="mt-6 h-1 w-12 bg-emerald-500 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}