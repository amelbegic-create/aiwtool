import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
  LayoutDashboard,
  Store,
  BookOpen,
  Settings,
  Search,
  Bell,
  LogOut,
  ChevronRight,
  ArrowLeft,
  Printer,
  ShieldCheck,
  FileBarChart,
  Clock,
  CheckCircle2,
  FileText
} from "lucide-react";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ ruleId: string }>;
};

// ==========================================
// BAZA GENERALNIH PRAVILA (SADRŽAJ)
// ==========================================
const GLOBAL_RULES: Record<string, { title: string; category: string; updated: string; content: string }> = {
  "code-of-conduct": {
    title: "Etički Kodeks",
    category: "HR Policy",
    updated: "01.01.2025",
    content: `<h3>Naša Misija</h3><p>Očekuje se da se svi zaposlenici ponašaju s integritetom, poštovanjem i profesionalnošću.</p><ul><li>Poštivanje kolega i gostiju.</li><li>Zabrana diskriminacije.</li><li>Profesionalno predstavljanje brenda.</li></ul>`
  },
  "dress-code": {
    title: "Standardi Uniforme",
    category: "Operations",
    updated: "15.02.2025",
    content: `<h3>Izgled Zaposlenika</h3><p>Uniforma mora biti čista, ispeglana i kompletna.</p><ul><li>Crne cipele (protuklizne).</li><li>Kapa/Vizir obavezni u kuhinji.</li><li>Pločica s imenom na lijevoj strani.</li></ul>`
  },
  // ... (Ovdje se mogu dodati ostala pravila po potrebi) ...
  "default": {
    title: "Dokument u izradi",
    category: "General",
    updated: "Danas",
    content: `<p>Sadržaj ovog pravila je trenutno u pripremi od strane HR odjela.</p>`
  }
};

export default async function GlobalRuleDetailsPage(props: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const params = await props.params;
  const ruleId = params.ruleId;
  const userName = (session.user as any)?.name || "User";

  // Dohvati pravilo ili default ako ne postoji (da ne pukne aplikacija dok ne uneseš svih 10)
  const rule = GLOBAL_RULES[ruleId] || { ...GLOBAL_RULES["default"], title: `Pravilo: ${ruleId}` };

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-[#1F2937] font-sans flex">
      {/* SIDEBAR (ISTI) */}
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
      </aside>

      {/* CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-20 shadow-sm">
            <div className="flex items-center gap-4">
                <Link href="/rules/global" className="text-slate-400 hover:text-slate-900 flex items-center gap-1 transition">
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm font-medium">Nazad</span>
                </Link>
                <div className="h-6 w-px bg-slate-200"></div>
                <h1 className="text-sm font-bold text-slate-800">Globalna Politika</h1>
            </div>
            <div className="flex items-center gap-3">
                <button className="p-2 text-slate-400 hover:bg-slate-100 rounded transition" title="Print"><Printer className="w-5 h-5" /></button>
            </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto bg-[#F1F5F9]">
            <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm p-10 min-h-[600px]">
                <div className="mb-6 pb-6 border-b border-slate-100 flex justify-between items-start">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-1 rounded mb-2 inline-block">{rule.category}</span>
                        <h1 className="text-3xl font-bold text-slate-900">{rule.title}</h1>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                        <p>ID: {ruleId.toUpperCase()}</p>
                        <p>Ažurirano: {rule.updated}</p>
                    </div>
                </div>

                <div 
                    className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-600 prose-li:text-slate-600"
                    dangerouslySetInnerHTML={{ __html: rule.content }}
                />
            </div>
        </main>
      </div>
    </div>
  );
}

// Sub-components
function NavHeader({ label }: { label: string }) { return <div className="px-3 mb-2 mt-6 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>; }
function SideLink({ href, icon: Icon, label, active }: any) { return <Link href={href} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium mb-0.5 ${active ? 'bg-[#FFC72C] text-[#0F172A] shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Icon className={`w-4 h-4 ${active ? 'text-[#0F172A]' : 'text-slate-400'}`} /> {label}</Link> }