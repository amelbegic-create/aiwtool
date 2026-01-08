"use client";

import { useParams } from "next/navigation";
import { TOOL_CATEGORIES, APP_TOOLS } from "@/lib/tools/tools-config";
import Link from "next/link";
import { notFound } from "next/navigation";

export default function CategoryPage() {
  const params = useParams();
  const categoryId = params.id as string;

  const category = TOOL_CATEGORIES.find((c) => c.id === categoryId);
  
  if (!category) return notFound();

  const tools = APP_TOOLS.filter((t) => t.category === categoryId);
  const CategoryIcon = category.icon;

  return (
    <div className="p-10 bg-white min-h-full animate-in fade-in duration-500">
      {/* Smanjen i prefinjen Header */}
      <div className="mb-10 border-b border-slate-50 pb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-slate-50 text-[#1a3826] rounded-xl border border-slate-100">
            {/* Smanjena ikona kategorije sa 40 na 24 */}
            <CategoryIcon size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1a3826] uppercase tracking-tight leading-none">
              {category.label}
            </h1>
            <p className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.2em] mt-2">
              Sistemski moduli / {category.id}
            </p>
          </div>
        </div>
      </div>

      {/* Grid sa kompaktnijim karticama */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {tools.length > 0 ? (
          tools.map((tool) => (
            <Link 
              key={tool.id} 
              href={tool.href} 
              className="group bg-white p-6 rounded-[2rem] border border-slate-100 hover:border-[#1a3826]/20 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="p-3 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-[#1a3826] group-hover:text-white transition-all duration-300 shadow-sm">
                  {/* Smanjena ikona alata sa 32 na 20 */}
                  <tool.icon size={20} />
                </div>
                <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest group-hover:text-[#1a3826] transition-colors">
                  Aktivno
                </div>
              </div>
              
              <h3 className="text-sm font-black text-[#1a3826] uppercase tracking-tight mb-1">
                {tool.name}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                Pokretanje modula za {tool.name.toLowerCase()} u restoranu.
              </p>
              
              <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#1a3826] opacity-0 group-hover:opacity-100 transition-opacity">
                  Otvori alat
                </span>
                <div className="h-6 w-6 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-[#FFC72C] group-hover:text-[#1a3826] transition-all">
                  <span className="text-xs">→</span>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem]">
            <p className="text-slate-300 font-bold uppercase tracking-widest text-[10px]">
              Nema modula u ovoj sekciji
            </p>
          </div>
        )}
      </div>
    </div>
  );
}