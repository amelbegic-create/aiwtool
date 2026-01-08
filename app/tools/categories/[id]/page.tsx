"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { APP_TOOLS, TOOL_CATEGORIES } from "@/lib/tools/tools-config";
import { ArrowRight, LayoutGrid } from "lucide-react";

export default function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  // U Next.js 15 params su Promise, moramo ih "otpakovati"
  const { id } = use(params);

  // 1. Nađi koja je kategorija u pitanju (npr. "staff")
  const category = TOOL_CATEGORIES.find((c) => c.id === id);

  // Ako kategorija ne postoji (npr. neko ukuca glupost u URL), baci 404
  if (!category) {
    return notFound();
  }

  // 2. Filtriraj alate koji pripadaju ovoj kategoriji
  const tools = APP_TOOLS.filter((t) => t.category === id);

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER KATEGORIJE */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2 font-bold uppercase tracking-wider">
            <Link href="/" className="hover:text-[#1a3826]">Dashboard</Link>
            <span>/</span>
            <span className="text-[#1a3826]">{category.label}</span>
          </div>
          <h1 className="text-4xl font-black text-[#1a3826] uppercase flex items-center gap-4">
            <category.icon className="w-10 h-10 text-[#FFC72C]" />
            {category.label}
          </h1>
          <p className="text-slate-500 mt-2 text-lg">
            Pregled svih dostupnih alata u sekciji {category.label}.
          </p>
        </div>

        {/* GRID ALATA */}
        {tools.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map((tool) => (
              <Link 
                key={tool.id} 
                href={tool.href}
                className="group bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
              >
                {/* Dekorativna pozadina */}
                <div className={`absolute top-0 right-0 w-24 h-24 bg-${tool.color || 'slate'}-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>

                <div className="relative z-10">
                  <div className={`w-12 h-12 rounded-lg bg-${tool.color || 'slate'}-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <tool.icon className={`w-6 h-6 text-${tool.color || 'slate'}-600`} />
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-[#1a3826] transition-colors">
                    {tool.name}
                  </h3>
                  
                  <p className="text-slate-500 text-sm mb-6 line-clamp-2">
                    {tool.description || "Klikni za pristup alatu i upravljanje podacima."}
                  </p>

                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1a3826] opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all">
                    Otvori Alat <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          // Ako nema alata
          <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <LayoutGrid className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">Nema alata</h3>
            <p className="text-slate-500">U ovoj kategoriji trenutno nema aktivnih alata.</p>
          </div>
        )}

      </div>
    </div>
  );
}