"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1a3826]">
        <div className="w-10 h-10 border-4 border-white/20 border-t-[#FFC72C] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (status === "authenticated") {
    return (
      <div className="p-8">
        {/* OVDJE IDE TVOJ STVARNI SADRŽAJ DASHBOARDA */}
        <div className="max-w-7xl mx-auto">
          <header className="mb-8">
            <h1 className="text-2xl font-bold text-slate-800">
              Dobrodošli nazad, {session?.user?.name}
            </h1>
            <p className="text-slate-500">Pregled aktivnosti za vaš restoran.</p>
          </header>

          {/* Primjer Dashboard kartica */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Aktivni radnici</h3>
              <p className="text-3xl font-black text-[#1a3826]">12</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Produktivnost</h3>
              <p className="text-3xl font-black text-[#1a3826]">94%</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Današnji status</h3>
              <p className="text-3xl font-black text-emerald-500">Aktivno</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}