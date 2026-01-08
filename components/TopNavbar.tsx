"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_TOOLS, TOOL_CATEGORIES } from "@/lib/tools/tools-config";
import { ChevronDown, LayoutGrid, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";

export default function TopNavbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [restName, setRestName] = useState("Učitavanje...");

  useEffect(() => {
    const savedName = localStorage.getItem("selected_restaurant_name");
    if (savedName) setRestName(savedName);
  }, [pathname]);

  if (pathname === "/login" || pathname === "/select-restaurant") return null;

  return (
    <header className="h-24 bg-[#1a3826] text-white shadow-md flex-shrink-0 relative z-50">
      <div className="h-full max-w-[1920px] mx-auto px-6 flex justify-between items-center">
        
        {/* LOGO SEKCIJA */}
        <Link href="/" className="flex items-center gap-4 w-72">
          <img src="/logo.png" alt="AIWTool" className="h-16 w-auto object-contain" />
          <div className="flex flex-col">
            <h1 className="font-black text-xl tracking-tight leading-none">AIWTool</h1>
            <p className="text-[10px] text-[#FFC72C] font-bold tracking-[0.2em] uppercase">Enterprise</p>
          </div>
        </Link>

        {/* DINAMIČKA NAVIGACIJA */}
        <nav className="hidden md:flex h-full items-center gap-1">
          {TOOL_CATEGORIES.map((category) => {
            const categoryTools = APP_TOOLS.filter(t => t.category === category.id);
            const isGeneral = category.id === 'general';
            const isActive = categoryTools.some(t => pathname === t.href) || (isGeneral && pathname === '/');

            return (
              <div key={category.id} className="relative group h-full flex items-center">
                <Link 
                  href={isGeneral ? "/" : `/tools/categories/${category.id}`}
                  className={`px-5 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-2 ${isActive ? 'bg-white/10 text-white' : 'text-emerald-100/60 hover:text-white hover:bg-white/5'}`}
                >
                  {isGeneral && <LayoutGrid size={16} />}
                  {category.label}
                  {!isGeneral && <ChevronDown size={14} className="opacity-50 group-hover:rotate-180 transition-transform" />}
                </Link>

                {/* DROPDOWN ZA BRZI PRISTUP */}
                {!isGeneral && categoryTools.length > 0 && (
                  <div className="absolute top-[80%] left-0 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform translate-y-2 group-hover:translate-y-0">
                    <div className="p-2 space-y-1">
                      {categoryTools.map((tool) => (
                        <Link key={tool.id} href={tool.href} className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-[#1a3826] transition-colors">
                          <span className="p-2 bg-slate-100 rounded-lg text-slate-400"><tool.icon size={16} /></span>
                          <span className="text-sm font-bold">{tool.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* KORISNIČKI INFO */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs font-bold">{session?.user?.name || "Korisnik"}</p>
            <p className="text-[10px] text-[#FFC72C] font-black uppercase tracking-widest">{restName}</p>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="w-10 h-10 bg-[#FFC72C] rounded-full flex items-center justify-center text-[#1a3826] font-black hover:scale-105 transition-transform">
            {session?.user?.name?.substring(0, 2).toUpperCase() || "AD"}
          </button>
        </div>

      </div>
    </header>
  );
}