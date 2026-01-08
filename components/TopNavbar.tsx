"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_TOOLS, TOOL_CATEGORIES } from "@/lib/tools/tools-config";
import { ChevronDown, LayoutGrid, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

export default function TopNavbar() {
  const pathname = usePathname();
  const [restName, setRestName] = useState("Učitavanje...");

  useEffect(() => {
    const savedName = localStorage.getItem("selected_restaurant_name");
    // FIX: Provjera da ne vrtimo u krug ako je ime isto
    if (savedName && savedName !== restName) {
      setRestName(savedName);
    } else if (!savedName && restName !== "Nije odabrano") {
      setRestName("Nije odabrano");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]); // Uklonjen restName iz dependency-a

  if (pathname === "/login" || pathname === "/select-restaurant") return null;

  return (
    <header className="h-24 bg-[#1a3826] text-white shadow-md flex-shrink-0 relative z-50 transition-all duration-300">
      <div className="h-full max-w-[1920px] mx-auto px-6 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-4 w-72 hover:opacity-90 transition-opacity">
          <img src="/logo.png" alt="AIWTool" className="h-20 w-auto object-contain" />
          <div className="flex flex-col justify-center">
            <h1 className="font-black text-2xl tracking-tight leading-none text-white">AIWTool</h1>
            <p className="text-[11px] text-[#FFC72C] font-bold tracking-[0.2em] uppercase mt-1">Enterprise</p>
          </div>
        </Link>

        <nav className="hidden md:flex h-full items-center gap-2">
          {TOOL_CATEGORIES.map((category) => {
            const categoryTools = APP_TOOLS.filter(t => t.category === category.id);
            const isGeneral = category.id === 'general';
            const isActiveCategory = categoryTools.some(t => pathname.startsWith(t.href)) || (isGeneral && pathname === '/');
            const linkHref = isGeneral ? "/" : `/tools/categories/${category.id}`;

            return (
              <div key={category.id} className="relative group h-full flex items-center">
                <Link 
                  href={linkHref}
                  className={`h-14 px-6 rounded-xl flex items-center gap-3 text-sm font-bold uppercase transition-all ${isActiveCategory ? 'bg-white/10 text-white shadow-inner' : 'hover:bg-white/5 text-emerald-100/80 hover:text-white'}`}
                >
                  {isGeneral && <LayoutGrid size={18} />}
                  {category.label}
                  {!isGeneral && <ChevronDown size={16} className="opacity-50 group-hover:rotate-180 transition-transform duration-200" />}
                </Link>
                {!isGeneral && (
                  <div className="absolute top-[calc(100%-15px)] left-0 w-72 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-4 group-hover:translate-y-0">
                    <div className="p-2 space-y-1">
                      <div className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-50 mb-1 flex justify-between items-center">
                        <span>Brzi Pristup: {category.label}</span>
                      </div>
                      {categoryTools.map((tool) => {
                          const isToolActive = pathname === tool.href;
                          return (
                            <Link key={tool.id} href={tool.href} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${isToolActive ? 'bg-emerald-50 text-[#1a3826] font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                              <span className={`p-2 rounded-md ${isToolActive ? 'bg-[#1a3826] text-white' : 'bg-slate-100 text-slate-500'}`}><tool.icon size={18} /></span>
                              <div><span className="block">{tool.name}</span></div>
                            </Link>
                          );
                        })}
                      <Link href={linkHref} className="mt-2 block text-center py-3 text-xs font-bold text-[#1a3826] hover:bg-emerald-50 rounded bg-slate-50 transition-colors border-t border-slate-100">Prikaži sve alate &rarr;</Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-5">
          <div className="flex flex-col items-end mr-2">
            <span className="text-sm font-bold">Admin User</span>
            <span className="text-[11px] text-[#FFC72C] uppercase tracking-wider font-bold">{restName}</span>
          </div>
          <Link href="/select-restaurant" className="h-12 w-12 rounded-full bg-[#FFC72C] text-[#1a3826] flex items-center justify-center font-black text-lg border-4 border-[#1a3826]/30 cursor-pointer hover:scale-105 transition-transform shadow-lg">AD</Link>
        </div>
      </div>
    </header>
  );
}