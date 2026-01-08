import prisma from "@/lib/prisma";
import Link from "next/link";
import { BookOpen, Search, FileText, ChevronRight, ArrowLeft } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";

export default async function RulesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Ovdje ćemo kasnije vući pravila iz baze. Za sad Hardcoded da izgleda lijepo.
  const rules = [
    { id: 1, title: "Standardi Kvalitete (QSC)", category: "Operacije", date: "Jan 2025", desc: "Globalni standardi za pripremu hrane i uslugu." },
    { id: 2, title: "Pravilnik o Uniformama", category: "HR", date: "Dec 2024", desc: "Upute o izgledu i nošenju uniforme." },
    { id: 3, title: "Sigurnost Hrane (HACCP)", category: "Sigurnost", date: "Jan 2025", desc: "Procedure za osiguranje zdravstvene ispravnosti." },
    { id: 4, title: "Otvaranje i Zatvaranje", category: "Operacije", date: "Nov 2024", desc: "Checkliste za menadžere smjene." },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
            <div>
                 <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-500 text-sm font-medium hover:text-[#1a3826] mb-2 transition-colors">
                   <ArrowLeft className="w-4 h-4" /> Nazad na Dashboard
                </Link>
                <h1 className="text-2xl font-bold text-slate-900">Baza Znanja</h1>
                <p className="text-slate-500 mt-1">Službeni pravilnici, procedure i upute za rad.</p>
            </div>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Pretraži dokumente..." className="h-10 pl-10 pr-4 rounded-md border border-slate-200 w-64 text-sm focus:ring-1 focus:ring-[#1a3826] bg-white" />
            </div>
        </div>

        {/* Grid Kategorija/Pravila */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((rule) => (
                <div key={rule.id} className="bg-white p-6 rounded-lg border border-slate-200 hover:border-[#1a3826] hover:shadow-md transition-all group cursor-pointer">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded bg-orange-50 text-orange-600 flex items-center justify-center group-hover:bg-[#1a3826] group-hover:text-white transition-colors">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{rule.category}</span>
                                <h3 className="font-bold text-slate-900 group-hover:text-[#1a3826]">{rule.title}</h3>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#1a3826] transition-colors" />
                    </div>
                    <p className="text-sm text-slate-500 mb-3 pl-[52px]">{rule.desc}</p>
                    <div className="pl-[52px] text-xs font-mono text-slate-400">
                        Ažurirano: {rule.date}
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}