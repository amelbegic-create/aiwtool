"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_TOOLS, TOOL_CATEGORIES, Category, Tool } from "@/lib/tools/tools-config";
import { ChevronDown, LayoutGrid, LogOut, Bell } from "lucide-react";
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
      <div className="h-full max-w-[1920px] mx-auto px-8 flex justify-between items-center">
        
        {/* LOGO */}
        <Link href="/" className="flex items-center gap-4 w-72 hover:opacity-90 transition-all">
          <div className="bg-white p-1 rounded-lg">
            <img src="/logo.png" alt="AIWTool" className="h-16 w-auto object-contain" />
          </div>
          <div className="flex flex-col">
            <h1 className="font-black text-2xl tracking-tighter leading-none">AIWTool</h1>
            <p className="text-[11px] text-[#FFC72C] font-bold tracking-[0.2em] uppercase mt-1">Enterprise</p>
          </div>
        </Link>

        {/* GORNJI MENI (UMJESTO SIDEBARA) */}
        <nav className="hidden md:flex h-full items-center gap-2">
          {TOOL_CATEGORIES.map((category) => {
            const categoryTools = APP_TOOLS.filter(t => t.category === category.id);
            const isGeneral = category.id === 'general';
            const isActiveCategory = categoryTools.some(t => pathname.startsWith(t.href)) || (isGeneral && pathname === '/');

            return (
              <div key={category.id} className="relative group h-full flex items-center">
                <Link 
                  href={isGeneral ? "/" : `/tools/categories/${category.id}`}
                  className={`h-14 px-6 rounded-xl flex items-center gap-3 text-sm font-bold uppercase transition-all ${isActiveCategory ? 'bg-white/10 text-white shadow-inner' : 'hover:bg-white/5 text-emerald-100/80 hover:text-white'}`}
                >
                  {isGeneral && <LayoutGrid size={18} />}
                  {category.label}
                  {!isGeneral && <ChevronDown size={16} className="opacity-50 group-hover:rotate-180 transition-transform duration-200" />}
                </Link>

                {/* PADUĆI MENI ZA ALATE */}
                {!isGeneral && categoryTools.length > 0 && (
                  <div className="absolute top-[calc(100%-15px)] left-0 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-4 group-hover:translate-y-0">
                    <div className="p-3 space-y-1 text-slate-900">
                      <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-2">
                        Alati: {category.label}
                      </div>
                      {categoryTools.map((tool) => (
                        <Link key={tool.id} href={tool.href} className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors group/tool">
                          <span className="p-2 bg-slate-100 rounded-lg text-slate-400 group-hover/tool:bg-[#1a3826] group-hover/tool:text-white transition-colors">
                            <tool.icon size={18} />
                          </span>
                          <span className="text-sm font-bold text-slate-700">{tool.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* PROFIL */}
        <div className="flex items-center gap-6">
          <div className="hidden xl:flex flex-col items-end leading-none">
            <span className="text-sm font-black text-white">{session?.user?.name || "Admin User"}</span>
            <span className="text-[10px] font-bold text-[#FFC72C] uppercase tracking-widest mt-1">{restName}</span>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="p-2 text-white/30 hover:text-red-400 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}