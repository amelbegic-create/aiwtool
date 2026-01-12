import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import Link from "next/link";
import {
  Search,
  Bell,
  ArrowRight,
  ClipboardCheck,
  Palmtree,
  ShieldCheck,
  UserCog,
  LayoutDashboard
} from "lucide-react";

// Definišemo interfejs za našeg korisnika
interface ExtendedUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
  permissions?: Record<string, string[]>;
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/login");
  }

  // --- 1. PODACI KORISNIKA ---
  const user = session.user as ExtendedUser;
  const userName = user?.name || "Korisnik";
  const userRole = user?.role || "CREW";
  const userPermissions = user?.permissions || {};

  // --- PERMISIJE ---
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ARCHITECT', 'MANAGER'].includes(userRole);

  // Helper za provjeru permisija
  const can = (module: string, action: string) => {
    if (isAdmin) return true; 
    if (!userPermissions) return false;
    if (!userPermissions[module]) return false;
    return userPermissions[module].includes(action);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-3">
              <div className="bg-[#1a3826] p-2 rounded-lg text-white">
                <LayoutDashboard size={20} />
              </div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">Pregled Sistema</h2>
          </div>
          
          <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                      type="text" 
                      placeholder="Pretraži alate..." 
                      className="h-10 w-72 pl-10 pr-4 rounded-xl bg-slate-100 border-none text-sm focus:ring-2 focus:ring-[#1a3826]/20 transition-all outline-none" 
                  />
              </div>
              <button className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              </button>
          </div>
      </header>

      <main className="flex-1 p-8">
          <div className="mx-auto w-full max-w-[1600px]">
              
              {/* WELCOME SECTION */}
              <div className="mb-10">
                  <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    Dobrodošli nazad, <span className="text-[#1a3826]">{userName}</span>.
                  </h1>
                  <p className="text-slate-500 mt-2 text-lg">Odaberite modul za početak rada na platformi.</p>
              </div>

              {/* GRID ALATA */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  
                  {/* 1. Modul: PDS (Performance Development System) */}
                  {can('evaluations', 'view') && (
                      <Link href="/tools/PDS" className="group bg-white p-7 rounded-2xl border border-slate-200 hover:border-[#1a3826] hover:shadow-xl transition-all duration-300 flex flex-col justify-between h-48 shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                             <ClipboardCheck size={80} />
                          </div>
                          <div className="flex justify-between items-start">
                              <div className="h-12 w-12 rounded-xl bg-emerald-50 text-[#1a3826] flex items-center justify-center shadow-inner">
                                  <ClipboardCheck className="w-6 h-6" />
                              </div>
                              <div className="bg-slate-100 p-2 rounded-lg group-hover:bg-[#1a3826] group-hover:text-white transition-colors">
                                <ArrowRight className="w-4 h-4" />
                              </div>
                          </div>
                          <div>
                              <h3 className="font-bold text-slate-900 text-xl tracking-tight text-emerald-900">PDS</h3>
                              <p className="text-sm text-slate-500 mt-2 leading-relaxed">Sistem za praćenje i razvoj performansi zaposlenika.</p>
                          </div>
                      </Link>
                  )}

                  {/* 2. Modul: Odmori */}
                  {can('vacations', 'view_own') && (
                      <Link href="/tools/vacations" className="group bg-white p-7 rounded-2xl border border-slate-200 hover:border-blue-500 hover:shadow-xl transition-all duration-300 flex flex-col justify-between h-48 shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                             <Palmtree size={80} />
                          </div>
                          <div className="flex justify-between items-start">
                              <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
                                  <Palmtree className="w-6 h-6" />
                              </div>
                              <div className="bg-slate-100 p-2 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <ArrowRight className="w-4 h-4" />
                              </div>
                          </div>
                          <div>
                              <h3 className="font-bold text-slate-900 text-xl tracking-tight">Godišnji Odmori</h3>
                              <p className="text-sm text-slate-500 mt-2 leading-relaxed">Kalendar i automatizacija zahtjeva za odsustvo.</p>
                          </div>
                      </Link>
                  )}

                  {/* 3. Modul: ADMIN PANEL ili PROFIL */}
                  {isAdmin ? (
                      <Link href="/admin/users" className="group bg-[#1a3826] p-7 rounded-2xl border border-[#1a3826] hover:shadow-2xl hover:shadow-emerald-900/40 transition-all duration-300 flex flex-col justify-between h-48 relative overflow-hidden shadow-lg">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-12 -mt-12 pointer-events-none transition-transform group-hover:scale-110"></div>
                          
                          <div className="flex justify-between items-start relative z-10">
                              <div className="h-12 w-12 rounded-xl bg-white/10 text-yellow-400 flex items-center justify-center backdrop-blur-sm border border-white/10 shadow-lg">
                                  <ShieldCheck className="w-6 h-6" />
                              </div>
                              <div className="bg-white/10 p-2 rounded-lg group-hover:bg-white group-hover:text-[#1a3826] transition-all">
                                <ArrowRight className="w-4 h-4" />
                              </div>
                          </div>
                          <div className="relative z-10">
                              <h3 className="font-bold text-white text-xl tracking-tight">Admin Panel</h3>
                              <p className="text-sm text-emerald-100/70 mt-2 leading-relaxed">Upravljanje korisničkim računima, dozvolama i sistemom.</p>
                          </div>
                      </Link>
                  ) : (
                      <Link href="/profile" className="group bg-white p-7 rounded-2xl border border-slate-200 hover:border-slate-400 hover:shadow-xl transition-all duration-300 flex flex-col justify-between h-48 shadow-sm relative overflow-hidden">
                          <div className="flex justify-between items-start">
                              <div className="h-12 w-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shadow-inner">
                                  <UserCog className="w-6 h-6" />
                              </div>
                              <div className="bg-slate-100 p-2 rounded-lg group-hover:bg-slate-800 group-hover:text-white transition-colors">
                                <ArrowRight className="w-4 h-4" />
                              </div>
                          </div>
                          <div>
                              <h3 className="font-bold text-slate-900 text-xl tracking-tight">Moj Profil</h3>
                              <p className="text-sm text-slate-500 mt-2 leading-relaxed">Pregled ličnih podataka i sigurnosne postavke.</p>
                          </div>
                      </Link>
                  )}
              </div>
          </div>
      </main>
    </div>
  );
}