import { TOOL_CATEGORIES, APP_TOOLS } from "@/lib/tools/tools-config";
import { notFound } from "next/navigation";
import Link from "next/link";

export default function CategoryPage({ params }: { params: { id: string } }) {
  const category = TOOL_CATEGORIES.find((c) => c.id === params.id);
  
  if (!category) return notFound();

  const tools = APP_TOOLS.filter((t) => t.category === category.id);
  const Icon = category.icon; // Uzimamo ikonu iz configa

  return (
    <div className="p-10 bg-white min-h-full">
      <div className="mb-10">
        <h1 className="text-4xl font-black text-[#1a3826] uppercase flex items-center gap-4">
          {Icon && <Icon className="w-10 h-10 text-[#FFC72C]" />} {/* Sigurno renderiranje */}
          {category.label}
        </h1>
        <p className="text-slate-500 mt-2 text-lg">Pregled svih alata u kategoriji {category.label.toLowerCase()}.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <Link 
            key={tool.id} 
            href={tool.href} 
            className="group p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] hover:bg-white hover:shadow-2xl transition-all"
          >
            <div className="p-4 bg-white rounded-2xl w-fit mb-6 shadow-sm group-hover:bg-[#1a3826] group-hover:text-white transition-colors">
              <tool.icon size={28} />
            </div>
            <h3 className="text-xl font-black text-[#1a3826] uppercase tracking-tight">{tool.name}</h3>
            <p className="text-slate-400 text-xs font-bold uppercase mt-2 tracking-widest">Otvori Alat &rarr;</p>
          </Link>
        ))}
      </div>
    </div>
  );
}