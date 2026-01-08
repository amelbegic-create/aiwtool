import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
  LayoutDashboard,
  Store,
  BookOpen,
  Clock,
  ShieldCheck,
  Settings,
  FileBarChart,
  Users,
  Search,
  Bell,
  LogOut,
  ChevronRight,
  ArrowLeft,
  FileText,
  Shield,
  Shirt,
  Smartphone,
  Lock,
  Clock3,
  Scale,
  Briefcase,
  Megaphone,
  HeartHandshake
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GlobalRulesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userName = (session.user as any)?.name || "User";

  // 10 Generalnih Pravila (Mock Data)
  const globalRules = [
    { id: "code-of-conduct", title: "Etički Kodeks", icon: Scale, color: "text-blue-600", bg: "bg-blue-50" },
    { id: "dress-code", title: "Standardi Uniforme", icon: Shirt, color: "text-purple-600", bg: "bg-purple-50" },
    { id: "zero-tolerance", title: "Nulta Tolerancija", icon: Shield, color: "text-red-600", bg: "bg-red-50" },
    { id: "social-media", title: "Društvene Mreže", icon: Smartphone, color: "text-pink-600", bg: "bg-pink-50" },
    { id: "data-privacy", title: "Zaštita Podataka", icon: Lock, color: "text-emerald-600", bg: "bg-emerald-50" },
    { id: "attendance", title: "Radno Vrijeme", icon: Clock3, color: "text-orange-600", bg: "bg-orange-50" },
    { id: "conflict-interest", title: "Sukob Interesa", icon: HeartHandshake, color: "text-indigo-600", bg: "bg-indigo-50" },
    { id: "company-assets", title: "Imovina Kompanije", icon: Briefcase, color: "text-slate-600", bg: "bg-slate-50" },
    { id: "whistleblowing", title: "Prijavi Nepravilnost", icon: Megaphone, color: "text-yellow-600", bg: "bg-yellow-50" },
    { id: "health-safety", title: "Zdravlje i Sigurnost", icon: ShieldCheck, color: "text-teal-600", bg: "bg-teal-50" },
  ];

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-[#1F2937] font-sans flex overflow-hidden">
      
      {/* SIDEBAR (Standard Enterprise) */}
      <aside className="hidden md:flex flex-col w-64 bg-[#1E293B] text-slate-300 h-screen sticky top-0 border-r border-slate-700 shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-700 bg-[#0F172A]">
           <div className="flex items-center gap-3">
             <div className="h-8 w-8 bg-[#FFC72C] rounded flex items-center justify-center text-[#1E293B] font-black text-lg">M</div>
             <div>
                <h1 className="font-bold text-white leading-none tracking-tight">MCD TOOL</h1>
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Enterprise</span>
             </div>
           </div>
        </div>
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
            <NavHeader label="Main" />
            <SideLink href="/dashboard" icon={LayoutDashboard} label="Dashboard" />
            <SideLink href="/restaurants" icon={Store} label="Mreža Restorana" />
            <SideLink href="/rules" icon={BookOpen} label="Pravila & Procedure" active />
            <NavHeader label="System" />
            <SideLink href="#" icon={Settings} label="Konfiguracija" />
        </nav>
        <div className="p-4 border-t border-slate-700 bg-[#0F172A]">
            <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-slate-600 flex items-center justify-center text-white font-semibold">{userName.charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{userName}</p>
                    <p className="text-xs text-slate-400 truncate">Administrator</p>
                </div>
            </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-20 shadow-sm">
            <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Pretraži globalna pravila..." className="h-10 w-full pl-10 pr-4 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFC72C] focus:border-transparent transition-all placeholder:text-slate-400" />
            </div>
            <div className="flex items-center gap-4">
                <button className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition"><Bell className="w-5 h-5" /></button>
            </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto bg-[#F1F5F9]">
            
            {/* Breadcrumb & Title */}
            <div className="mb-8">
                <nav className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                    <Link href="/rules" className="hover:text-slate-900 flex items-center gap-1 transition-colors">
                        <ArrowLeft className="w-3 h-3" /> Baza Znanja
                    </Link>
                    <ChevronRight className="w-3 h-3" />
                    <span className="font-semibold text-slate-800">Globalna Pravila</span>
                </nav>
                
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                            <BookOpen className="w-6 h-6 text-[#1E293B]" />
                            Generalna Pravila & Politike
                        </h2>
                        <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                            Korporativni standardi koji se primjenjuju na sve zaposlenike i lokacije unutar mreže.
                        </p>
                    </div>
                </div>
            </div>

            {/* RULES GRID (10 CARDS) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {globalRules.map((rule) => (
                    <Link 
                        key={rule.id}
                        href={`/rules/global/${rule.id}`}
                        className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-[#FFC72C] hover:shadow-lg transition-all duration-300 flex flex-col h-48 relative overflow-hidden"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={`h-12 w-12 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${rule.bg} ${rule.color}`}>
                                <rule.icon className="w-6 h-6" />
                            </div>
                            <span className="px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[10px] font-bold uppercase text-slate-400">Global</span>
                        </div>
                        
                        <div className="mt-auto">
                            <h3 className="font-bold text-slate-900 text-sm mb-1 group-hover:text-[#1E293B]">{rule.title}</h3>
                            <p className="text-xs text-slate-500">Klikni za pregled detalja i dokumentacije.</p>
                        </div>

                        {/* Hover Indicator */}
                        <div className="absolute bottom-0 left-0 h-1 w-0 bg-[#FFC72C] group-hover:w-full transition-all duration-500"></div>
                    </Link>
                ))}
            </div>

        </main>
      </div>
    </div>
  );
}

// Sub-components
function NavHeader({ label }: { label: string }) { return <div className="px-3 mb-2 mt-6 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>; }
function SideLink({ href, icon: Icon, label, active }: any) { return <Link href={href} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium mb-0.5 ${active ? 'bg-[#FFC72C] text-[#0F172A] shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Icon className={`w-4 h-4 ${active ? 'text-[#0F172A]' : 'text-slate-400'}`} /> {label}</Link> }