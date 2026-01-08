import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import Link from "next/link";
import {
  Search,
  Bell,
  ArrowRight,
  Users,           
  ClipboardCheck,  
  Palmtree,        
  BookOpen,
  Store,
  ChevronRight,
  Settings
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // --- 1. PODACI KORISNIKA ---
  const user = session.user as any;
  const userName = user?.name || "Korisnik";
  const userRole = user?.role || "CREW";
  const userPermissions = user?.permissions || {};

  // Helper za provjeru permisija
  const can = (module: string, action: string) => {
    if (userRole === 'SUPER_ADMIN') return true; 
    if (!userPermissions[module]) return false;
    return userPermissions[module].includes(action);
  };

  // --- 2. DOHVATANJE PRAVIH PODATAKA (Restorani) ---
  const restaurants = await prisma.restaurant.findMany({
    orderBy: { code: "asc" },
    take: 10
  });

  return (
    <>
      {/* Header - Sada je dio stranice, ali bez vanjskog omotača */}
      <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-800">Pregled Sistema</h2>
          </div>
          
          <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                      type="text" 
                      placeholder="Pretraži..." 
                      className="h-9 w-64 pl-9 pr-4 rounded-md bg-slate-100 border-none text-sm focus:ring-1 focus:ring-[#1a3826] transition-all" 
                  />
              </div>
              <button className="h-9 w-9 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all">
                  <Bell className="w-4 h-4" />
              </button>
          </div>
      </header>

      <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto">
              
              {/* 1. WELCOME SECTION */}
              <div className="mb-8">
                  <h1 className="text-2xl font-bold text-slate-900">Dobrodošli nazad, {userName}.</h1>
                  <p className="text-slate-500 mt-1">Izaberite alat za početak rada.</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                  
                  {/* --- LIJEVA STRANA: GRID ALATA --- */}
                  <div className="xl:col-span-3 space-y-8">
                      
                      {/* A) GLAVNI ALATI */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          
                          {/* Kartica: Evaluacije */}
                          {can('evaluations', 'view') && (
                              <Link href="/tools/evaluations" className="group bg-white p-6 rounded-lg border border-slate-200 hover:border-[#1a3826] hover:shadow-md transition-all flex flex-col justify-between h-40">
                                  <div className="flex justify-between items-start">
                                      <div className="h-10 w-10 rounded-md bg-emerald-50 text-[#1a3826] flex items-center justify-center">
                                          <ClipboardCheck className="w-5 h-5" />
                                      </div>
                                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#1a3826] transition-colors" />
                                  </div>
                                  <div>
                                      <h3 className="font-bold text-slate-900 text-lg">Evaluacije</h3>
                                      <p className="text-sm text-slate-500 mt-1">Pregled i unos mjesečnih audita.</p>
                                  </div>
                              </Link>
                          )}

                          {/* Kartica: Odmori */}
                          {can('vacations', 'view_own') && (
                              <Link href="/tools/vacations" className="group bg-white p-6 rounded-lg border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all flex flex-col justify-between h-40">
                                  <div className="flex justify-between items-start">
                                      <div className="h-10 w-10 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                                          <Palmtree className="w-5 h-5" />
                                      </div>
                                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                                  </div>
                                  <div>
                                      <h3 className="font-bold text-slate-900 text-lg">Godišnji Odmori</h3>
                                      <p className="text-sm text-slate-500 mt-1">Kalendar i zahtjevi za odsustvo.</p>
                                  </div>
                              </Link>
                          )}

                           {/* Kartica: Admin Panel (ILI Moj Profil) */}
                           {can('users', 'view') ? (
                              <Link href="/admin/users" className="group bg-white p-6 rounded-lg border border-purple-200 hover:border-purple-600 hover:shadow-md transition-all flex flex-col justify-between h-40 relative overflow-hidden">
                                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-full -mr-10 -mt-10 opacity-50"></div>
                                  <div className="flex justify-between items-start relative z-10">
                                      <div className="h-10 w-10 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center">
                                          <Users className="w-5 h-5" />
                                      </div>
                                      <ArrowRight className="w-4 h-4 text-purple-300 group-hover:text-purple-700 transition-colors" />
                                  </div>
                                  <div className="relative z-10">
                                      <h3 className="font-bold text-slate-900 text-lg">Korisnici</h3>
                                      <p className="text-sm text-slate-500 mt-1">Upravljanje pristupom.</p>
                                  </div>
                              </Link>
                          ) : (
                              <Link href="/profile" className="group bg-white p-6 rounded-lg border border-slate-200 hover:border-slate-400 hover:shadow-md transition-all flex flex-col justify-between h-40">
                                  <div className="flex justify-between items-start">
                                      <div className="h-10 w-10 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center">
                                          <Users className="w-5 h-5" />
                                      </div>
                                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
                                  </div>
                                  <div>
                                      <h3 className="font-bold text-slate-900 text-lg">Moj Profil</h3>
                                      <p className="text-sm text-slate-500 mt-1">Postavke naloga.</p>
                                  </div>
                              </Link>
                          )}
                      </div>

                      {/* B) SEKUNDARNI ALATI */}
                      <div>
                          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Baza Znanja</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              
                              {can('rules', 'view') && (
                                  <Link href="/rules" className="flex items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                                      <div className="h-10 w-10 rounded bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                                          <BookOpen className="w-5 h-5" />
                                      </div>
                                      <div>
                                          <h4 className="font-bold text-slate-900">Standardi i Pravila</h4>
                                          <p className="text-xs text-slate-500">Pristup globalnim procedurama</p>
                                      </div>
                                      <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
                                  </Link>
                              )}

                              <Link href="/restaurants" className="flex items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                                  <div className="h-10 w-10 rounded bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                                      <Store className="w-5 h-5" />
                                  </div>
                                  <div>
                                      <h4 className="font-bold text-slate-900">Mreža Restorana</h4>
                                      <p className="text-xs text-slate-500">Pregled lokacija i kodova</p>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
                              </Link>

                          </div>
                      </div>

                  </div>

                  {/* --- DESNA STRANA: SYSTEM STATUS --- */}
                  <div className="xl:col-span-1">
                      <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-full max-h-[600px]">
                          <div className="p-5 border-b border-slate-100">
                              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                  <Settings className="w-4 h-4 text-slate-400" />
                                  Status Sistema
                              </h3>
                              <p className="text-xs text-slate-500 mt-1">Prikaz aktivnih restorana</p>
                          </div>

                          <div className="flex-1 overflow-y-auto p-2">
                              {restaurants.length > 0 ? (
                                  <div className="space-y-1">
                                      {restaurants.map((r) => (
                                          <Link href={`/restaurants/${r.id}`} key={r.id} className="flex items-center justify-between p-3 rounded hover:bg-slate-50 group transition-colors">
                                              <div className="flex items-center gap-3">
                                                  <div className={`h-2 w-2 rounded-full ${r.isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                                  <div>
                                                      <p className="text-sm font-bold text-slate-700 group-hover:text-[#1a3826]">{r.name}</p>
                                                      <p className="text-[10px] text-slate-400 font-mono">#{r.code}</p>
                                                  </div>
                                              </div>
                                          </Link>
                                      ))}
                                  </div>
                              ) : (
                                  <div className="p-4 text-center text-slate-400 text-sm">
                                      Nema unesenih restorana.
                                  </div>
                              )}
                          </div>
                          
                          <div className="p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-lg">
                              <Link href="/restaurants" className="text-xs font-bold text-[#1a3826] hover:underline flex items-center justify-center">
                                  Upravljaj Restoranima
                              </Link>
                          </div>
                      </div>
                  </div>

              </div>
          </div>
      </main>
    </>
  );
}