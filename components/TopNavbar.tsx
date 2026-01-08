"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  ChevronDown, 
  LogOut, 
  LayoutGrid,
  Bell
} from "lucide-react";

export default function TopNavbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [selectedRestName, setSelectedRestName] = useState("");

  // Sakrivamo navigaciju na Login i Select Restaurant stranicama
  if (pathname === "/login" || pathname === "/select-restaurant") return null;

  useEffect(() => {
    const restName = localStorage.getItem("selected_restaurant_name") || "RESTORAN 1";
    setSelectedRestName(restName);
  }, []);

  return (
    <nav className="bg-[#1a3826] text-white px-6 py-4 flex items-center justify-between shadow-lg relative z-50">
      
      {/* LOGO I BRAND */}
      <div className="flex items-center gap-10">
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded">
             <img src="/logo.png" alt="AIW" className="h-7 w-auto" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black leading-none tracking-tight">AIWTool</span>
            <span className="text-[9px] font-bold text-yellow-400 uppercase tracking-[0.2em]">Enterprise</span>
          </div>
        </div>

        {/* TVOJE KATEGORIJE - Tačno kako smo definisali */}
        <div className="hidden lg:flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg text-[11px] font-black uppercase tracking-wider">
            <LayoutGrid size={14} /> Općenito
          </button>
          
          <button className="flex items-center gap-1.5 px-4 py-2 text-white/70 hover:text-white transition-colors text-[11px] font-black uppercase tracking-wider group">
            Osoblje <ChevronDown size={14} className="opacity-50 group-hover:opacity-100" />
          </button>

          <button className="flex items-center gap-1.5 px-4 py-2 text-white/70 hover:text-white transition-colors text-[11px] font-black uppercase tracking-wider group">
            Operacije <ChevronDown size={14} className="opacity-50 group-hover:opacity-100" />
          </button>

          <button className="flex items-center gap-1.5 px-4 py-2 text-white/70 hover:text-white transition-colors text-[11px] font-black uppercase tracking-wider group">
            Ostalo <ChevronDown size={14} className="opacity-50 group-hover:opacity-100" />
          </button>
        </div>
      </div>

      {/* DESNA STRANA - Profil i Restoran */}
      <div className="flex items-center gap-5">
        <div className="flex flex-col items-end leading-none">
          <span className="text-xs font-black text-white uppercase">{session?.user?.name || "Admin User"}</span>
          <span className="text-[10px] font-bold text-yellow-400 uppercase mt-1">{selectedRestName}</span>
        </div>

        <div className="flex items-center gap-3 border-l border-white/10 pl-5">
          <div className="w-9 h-9 bg-yellow-400 rounded-full flex items-center justify-center text-[#1a3826] font-black text-xs shadow-lg">
            {session?.user?.name?.substring(0, 2).toUpperCase() || "AD"}
          </div>
          
          <button 
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-red-400"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </nav>
  );
}