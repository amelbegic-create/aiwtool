"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_TOOLS, TOOL_CATEGORIES, ToolCategory, AppTool } from "@/lib/tools/tools-config";
import { ChevronDown, ChevronRight, LayoutGrid } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  
  // Stanje koje prati koje su kategorije otvorene
  // Po defaultu otvaramo 'general' (Općenito) i 'staff' (Osoblje)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    general: true,
    staff: true,
    operations: false,
    other: false
  });

  // Funkcija za otvaranje/zatvaranje kategorija
  const toggleSection = (id: string) => {
    setOpenSections(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Sakrij sidebar na loginu
  if (pathname === "/login") return null;

  return (
    <aside className="w-64 bg-[#1a3826] text-white flex flex-col shadow-2xl flex-shrink-0 z-50 h-screen transition-all duration-300">
      
      {/* --- LOGO SEKCIJA --- */}
      <div className="p-6 border-b border-white/10 flex items-center gap-3 bg-[#142d1f]">
        <div className="w-9 h-9 bg-[#FFC72C] rounded-lg flex items-center justify-center text-[#1a3826] font-black text-xl shadow-lg">M</div>
        <div>
          <h1 className="font-bold text-lg tracking-tight leading-none text-white">TOOLAT</h1>
          <p className="text-[10px] text-[#FFC72C] font-bold tracking-[0.2em] uppercase mt-1">Enterprise</p>
        </div>
      </div>

      {/* --- NAVIGACIJA (Scrollable) --- */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2 custom-scrollbar">
        
        {TOOL_CATEGORIES.map((category) => {
            // Filtriraj alate za ovu kategoriju
            const categoryTools = APP_TOOLS.filter(t => t.category === category.id);
            const isOpen = openSections[category.id];
            
            // Specijalno: Općenito uvijek ima Dashboard
            const isGeneral = category.id === 'general';

            return (
              <div key={category.id} className="mb-2">
                
                {/* DUGME KATEGORIJE (Naslov) */}
                <button 
                  onClick={() => toggleSection(category.id)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-all duration-200 group ${isOpen ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-emerald-100/70'}`}
                >
                  <div className="flex items-center gap-3">
                    <category.icon size={18} className={`${isOpen ? 'text-[#FFC72C]' : 'text-emerald-100/50 group-hover:text-white'}`} />
                    <span className="text-xs font-bold uppercase tracking-wider">{category.label}</span>
                  </div>
                  {isOpen ? <ChevronDown size={14} className="text-emerald-100/50"/> : <ChevronRight size={14} className="text-emerald-100/30"/>}
                </button>

                {/* LISTA ALATA (Sadržaj) */}
                {isOpen && (
                  <div className="mt-1 ml-4 pl-4 border-l border-white/10 space-y-1 animate-in slide-in-from-left-2 duration-200">
                    
                    {/* Hardcoded Dashboard za 'general' kategoriju */}
                    {isGeneral && (
                       <Link 
                       href="/" 
                       className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${pathname === '/' ? 'bg-[#FFC72C] text-[#1a3826] font-bold shadow-md' : 'text-emerald-100/80 hover:bg-white/5 hover:text-white'}`}
                     >
                       <LayoutGrid size={16} />
                       Dashboard
                     </Link>
                    )}

                    {/* Dinamički alati iz configa */}
                    {categoryTools.map((tool) => {
                      const isActive = pathname === tool.href;
                      return (
                        <Link 
                          key={tool.id} 
                          href={tool.href}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${isActive ? 'bg-[#FFC72C] text-[#1a3826] font-bold shadow-md' : 'text-emerald-100/80 hover:bg-white/5 hover:text-white'}`}
                        >
                          {/* Ikona alata */}
                          <tool.icon size={16} className={isActive ? 'text-[#1a3826]' : 'opacity-70'} />
                          {tool.name}
                        </Link>
                      );
                    })}

                    {/* Poruka ako nema alata u kategoriji (osim Općenito) */}
                    {!isGeneral && categoryTools.length === 0 && (
                      <div className="px-3 py-2 text-[10px] text-emerald-100/30 italic">
                        Uskoro...
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
        })}

      </nav>

      {/* --- USER FOOTER --- */}
      <div className="p-4 border-t border-white/10 bg-[#142d1f]">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
          <div className="w-10 h-10 rounded-full bg-emerald-800 flex items-center justify-center text-sm font-bold text-[#FFC72C] border-2 border-[#1a3826] shadow-sm">
            AB
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-white truncate">Amel Begić</p>
            <p className="text-[10px] text-emerald-400 truncate font-mono">Admin • R#1</p>
          </div>
        </div>
      </div>

    </aside>
  );
}