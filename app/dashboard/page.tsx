import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import Link from "next/link";
import {
  Search,
  Bell,
  ArrowRight,
  ClipboardCheck,
  Palmtree,
  ShieldCheck,
  UserCog,
  LayoutDashboard,
  TrendingUp,
  Clock,
  Calendar,
  LogOut
} from "lucide-react";
import { Role } from "@prisma/client";

// Helper za formatiranje datuma
const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat("bs-BA", { day: "numeric", month: "short" }).format(date);
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/login");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userSession = session.user as any;
  const userId = userSession.id;
  const userRole = userSession.role as Role;
  
  // --- DOHVAT PODATAKA ---
  const userDataPromise = prisma.user.findUnique({
    where: { id: userId },
    include: {
        vacations: { 
            orderBy: { createdAt: 'desc' },
            take: 3
        },
        pdsList: {
            where: { year: new Date().getFullYear() + 1 },
            take: 1
        }
    }
  });

  const adminRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.SYSTEM_ARCHITECT, Role.MANAGER];
  const isAdmin = adminRoles.includes(userRole);
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const adminStatsPromise = isAdmin ? prisma.user.count({ where: { isActive: true } }) : Promise.resolve(0);
  const adminPendingPromise = isAdmin ? prisma.vacationRequest.count({ where: { status: 'PENDING' } }) : Promise.resolve(0);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [userData, _totalEmployees, totalPending] = await Promise.all([
    userDataPromise,
    adminStatsPromise,
    adminPendingPromise
  ]);

  if (!userData) redirect("/login");

  // --- STATISTIKA ---
  const currentPDS = userData.pdsList[0];
  const pdsScore = currentPDS ? currentPDS.totalScore : 0;
  const pdsStatus = currentPDS ? currentPDS.status : "Nije započeto";

  const totalVacation = (userData.vacationEntitlement || 0) + (userData.vacationCarryover || 0);
  const usedVacation = userData.vacations
    .filter(v => v.status === 'APPROVED')
    .reduce((acc, v) => acc + v.days, 0);
  const vacationLeft = totalVacation - usedVacation;

  const canViewPDS = true;
  const canViewVacations = true;

  return (
    // FIX: Dodan relative i z-0 na glavni wrapper da ne gazi navigaciju
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 flex flex-col relative z-0">
      
      {/* --- HEADER --- */}
      {/* FIX: Z-index header-a podignut na 50 da bude iznad svega */}
      <header className="h-20 bg-white border-b border-slate-200 sticky top-0 z-50 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] px-6 md:px-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
              <div className="bg-[#1a3826] p-2.5 rounded-xl text-white shadow-lg shadow-emerald-900/20">
                <LayoutDashboard size={22} />
              </div>
              <div>
                  <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">AIW Service</h2>
                  <h1 className="text-lg font-black text-[#1a3826] leading-none tracking-tight">DASHBOARD</h1>
              </div>
          </div>
          
          <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center bg-slate-100 rounded-xl px-4 py-2.5 border border-transparent focus-within:border-[#1a3826] focus-within:bg-white transition-all w-80">
                  <Search className="w-4 h-4 text-slate-400 mr-3" />
                  <input 
                      type="text" 
                      placeholder="Pretraži module..." 
                      className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 w-full placeholder:text-slate-400" 
                  />
              </div>
              <div className="flex items-center gap-3">
                  <button className="h-11 w-11 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all relative">
                      <Bell className="w-5 h-5" />
                      <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                  </button>
                  <Link href="/api/auth/signout" className="h-11 w-11 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all" title="Odjava">
                      <LogOut className="w-5 h-5" />
                  </Link>
              </div>
          </div>
      </header>

      {/* FIX: Main content ima manji z-index (z-0) kako bi dropdownovi mogli ići preko njega */}
      <main className="flex-1 p-6 md:p-10 max-w-[1600px] mx-auto w-full space-y-10 relative z-0">
          
          {/* --- HERO SECTION --- */}
          {/* FIX: Uklonjen visoki z-index, sada je relative z-0 */}
          <div className="relative overflow-hidden bg-[#1a3826] rounded-[2.5rem] p-10 md:p-12 shadow-2xl shadow-emerald-900/30 text-white flex flex-col md:flex-row justify-between items-center gap-8 z-0">
              {/* Background Pattern - sada je apsolutno u dnu */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none z-[-1]"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#FFC72C]/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none z-[-1]"></div>

              <div className="relative z-10 max-w-2xl">
                  <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-[#FFC72C] mb-4 border border-white/10">
                      <span className="w-2 h-2 rounded-full bg-[#FFC72C] animate-pulse"></span>
                      Sistem aktivan
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 leading-tight">
                      Dobrodošao, <span className="text-[#FFC72C]">{userData.name?.split(' ')[0]}</span>.
                  </h1>
                  <p className="text-emerald-100/80 text-lg font-medium max-w-lg leading-relaxed">
                      Imate <strong className="text-white">{userData.vacations.filter(v => v.status === 'PENDING').length} zahtjeva</strong> na čekanju i Vaš trenutni PDS skor je <strong className="text-white">{pdsScore}</strong>.
                  </p>
              </div>

              {/* Quick KPI Stats */}
              <div className="flex gap-4 relative z-10 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                  <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl min-w-[140px] flex flex-col items-center text-center hover:bg-white/20 transition-all cursor-default">
                      <span className="text-emerald-100/60 text-[10px] font-black uppercase tracking-widest mb-1">Godišnji</span>
                      <span className="text-3xl font-black text-white">{vacationLeft}</span>
                      <span className="text-xs font-bold text-emerald-200">Dana ostalo</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md border border-white/10 p-5 rounded-2xl min-w-[140px] flex flex-col items-center text-center hover:bg-white/20 transition-all cursor-default">
                      <span className="text-emerald-100/60 text-[10px] font-black uppercase tracking-widest mb-1">PDS Skor</span>
                      <span className="text-3xl font-black text-[#FFC72C]">{pdsScore}</span>
                      <span className="text-xs font-bold text-emerald-200">{pdsStatus}</span>
                  </div>
                  {isAdmin && (
                      <div className="bg-[#FFC72C] text-[#1a3826] p-5 rounded-2xl min-w-[140px] flex flex-col items-center text-center shadow-lg shadow-yellow-500/20">
                          <span className="opacity-60 text-[10px] font-black uppercase tracking-widest mb-1">Zahtjevi</span>
                          <span className="text-3xl font-black">{totalPending}</span>
                          <span className="text-xs font-bold opacity-80">Na čekanju</span>
                      </div>
                  )}
              </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
              
              {/* --- ALATI --- */}
              <div className="xl:col-span-3 space-y-6">
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                      <LayoutDashboard className="text-[#1a3826]" size={20}/> MOJI ALATI
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      
                      {/* PDS */}
                      {canViewPDS && (
                          <Link href="/tools/PDS" className="group bg-white p-1 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                              <div className="bg-slate-50 rounded-[1.8rem] p-6 h-full flex flex-col justify-between group-hover:bg-white transition-colors border border-transparent group-hover:border-slate-100">
                                  <div className="flex justify-between items-start mb-6">
                                      <div className="h-14 w-14 bg-white rounded-2xl flex items-center justify-center text-[#1a3826] shadow-sm group-hover:scale-110 transition-transform duration-300">
                                          <ClipboardCheck size={28} strokeWidth={2.5}/>
                                      </div>
                                      <div className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-full">
                                          2026 Ready
                                      </div>
                                  </div>
                                  <div>
                                      <h4 className="text-xl font-black text-slate-800 mb-2 group-hover:text-[#1a3826] transition-colors">PDS Sistem</h4>
                                      <p className="text-xs font-medium text-slate-400 leading-relaxed mb-4">Evaluacija performansi, postavljanje ciljeva i praćenje napretka.</p>
                                      <div className="flex items-center gap-2 text-xs font-bold text-[#1a3826] group-hover:underline decoration-2 underline-offset-4">
                                          Otvori Alat <ArrowRight size={14}/>
                                      </div>
                                  </div>
                              </div>
                          </Link>
                      )}

                      {/* VACATIONS */}
                      {canViewVacations && (
                          <Link href="/tools/vacations" className="group bg-white p-1 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                              <div className="bg-slate-50 rounded-[1.8rem] p-6 h-full flex flex-col justify-between group-hover:bg-white transition-colors border border-transparent group-hover:border-slate-100">
                                  <div className="flex justify-between items-start mb-6">
                                      <div className="h-14 w-14 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-110 transition-transform duration-300">
                                          <Palmtree size={28} strokeWidth={2.5}/>
                                      </div>
                                      <div className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-black uppercase rounded-full">
                                          {vacationLeft} Dana
                                      </div>
                                  </div>
                                  <div>
                                      <h4 className="text-xl font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">Godišnji Odmori</h4>
                                      <p className="text-xs font-medium text-slate-400 leading-relaxed mb-4">Planer odsustva, kalendar praznika i slanje zahtjeva.</p>
                                      <div className="flex items-center gap-2 text-xs font-bold text-blue-600 group-hover:underline decoration-2 underline-offset-4">
                                          Otvori Alat <ArrowRight size={14}/>
                                      </div>
                                  </div>
                              </div>
                          </Link>
                      )}

                      {/* ADMIN/PROFILE */}
                      {isAdmin ? (
                          <Link href="/admin/users" className="group bg-[#1a3826] p-1 rounded-[2rem] shadow-lg shadow-emerald-900/20 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                              <div className="bg-[#1a3826] rounded-[1.8rem] p-6 h-full flex flex-col justify-between border border-white/10 relative overflow-hidden">
                                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#FFC72C] rounded-full blur-[50px] opacity-20 group-hover:opacity-30 transition-opacity"></div>
                                  
                                  <div className="flex justify-between items-start mb-6 relative z-10">
                                      <div className="h-14 w-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-[#FFC72C] shadow-inner group-hover:scale-110 transition-transform duration-300">
                                          <ShieldCheck size={28} strokeWidth={2.5}/>
                                      </div>
                                      <div className="px-3 py-1 bg-white/20 text-white text-[10px] font-black uppercase rounded-full">
                                          Admin
                                      </div>
                                  </div>
                                  <div className="relative z-10">
                                      <h4 className="text-xl font-black text-white mb-2">Admin Panel</h4>
                                      <p className="text-xs font-medium text-emerald-100/60 leading-relaxed mb-4">Upravljanje korisnicima, restoranima i globalnim postavkama.</p>
                                      <div className="flex items-center gap-2 text-xs font-bold text-[#FFC72C] group-hover:underline decoration-2 underline-offset-4">
                                          Upravljaj <ArrowRight size={14}/>
                                      </div>
                                  </div>
                              </div>
                          </Link>
                      ) : (
                          <Link href="/profile" className="group bg-white p-1 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                              <div className="bg-slate-50 rounded-[1.8rem] p-6 h-full flex flex-col justify-between group-hover:bg-white transition-colors border border-transparent group-hover:border-slate-100">
                                  <div className="flex justify-between items-start mb-6">
                                      <div className="h-14 w-14 bg-white rounded-2xl flex items-center justify-center text-slate-600 shadow-sm group-hover:scale-110 transition-transform duration-300">
                                          <UserCog size={28} strokeWidth={2.5}/>
                                      </div>
                                  </div>
                                  <div>
                                      <h4 className="text-xl font-black text-slate-800 mb-2 group-hover:text-slate-600 transition-colors">Moj Profil</h4>
                                      <p className="text-xs font-medium text-slate-400 leading-relaxed mb-4">Postavke naloga, promjena lozinke i lični podaci.</p>
                                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600 group-hover:underline decoration-2 underline-offset-4">
                                          Uredi Profil <ArrowRight size={14}/>
                                      </div>
                                  </div>
                              </div>
                          </Link>
                      )}
                  </div>
              </div>

              {/* --- SIDEBAR: ACTIVITY --- */}
              <div className="xl:col-span-1 space-y-6">
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                      <TrendingUp className="text-blue-500" size={20}/> AKTIVNOSTI
                  </h3>
                  
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 h-fit">
                      <div className="space-y-6">
                          
                          <div className="flex gap-4 relative">
                              <div className="flex flex-col items-center">
                                  <div className="h-2 w-2 rounded-full bg-[#1a3826]"></div>
                                  <div className="w-px h-full bg-slate-100 my-1"></div>
                              </div>
                              <div className="pb-2">
                                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">PDS Evaluacija</p>
                                  <p className="text-sm font-bold text-slate-800">
                                      {pdsStatus === 'OPEN' ? 'Evaluacija je otvorena' : pdsStatus === 'SUBMITTED' ? 'Poslano na pregled' : 'Status: ' + pdsStatus}
                                  </p>
                                  <span className="text-[10px] font-bold text-[#1a3826] bg-emerald-50 px-2 py-0.5 rounded mt-2 inline-block">
                                      {pdsScore} Bodova
                                  </span>
                              </div>
                          </div>

                          {userData.vacations.map((vac) => (
                              <div key={vac.id} className="flex gap-4 relative">
                                  <div className="flex flex-col items-center">
                                      <div className={`h-2 w-2 rounded-full ${vac.status === 'APPROVED' ? 'bg-green-500' : vac.status === 'REJECTED' ? 'bg-red-500' : 'bg-orange-400'}`}></div>
                                      <div className="w-px h-full bg-slate-100 my-1 last:hidden"></div>
                                  </div>
                                  <div className="pb-2">
                                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">Zahtjev za odmor</p>
                                      <div className="flex items-center gap-2 mb-1">
                                          <Calendar size={12} className="text-slate-400"/>
                                          <span className="text-xs font-bold text-slate-600">{formatDate(new Date(vac.start))}</span>
                                      </div>
                                      <p className={`text-xs font-black uppercase ${vac.status === 'APPROVED' ? 'text-green-600' : vac.status === 'REJECTED' ? 'text-red-500' : 'text-orange-500'}`}>
                                          {vac.status}
                                      </p>
                                  </div>
                              </div>
                          ))}

                          {userData.vacations.length === 0 && (
                              <div className="text-center py-6">
                                  <Clock className="mx-auto text-slate-200 mb-2" size={32}/>
                                  <p className="text-xs text-slate-400 font-medium">Nema nedavnih aktivnosti.</p>
                              </div>
                          )}
                      </div>
                      
                      <div className="mt-6 pt-6 border-t border-slate-50 text-center">
                          <button className="text-xs font-bold text-slate-400 hover:text-[#1a3826] transition-colors">
                              Prikaži svu historiju
                          </button>
                      </div>
                  </div>

                  <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                      <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500 rounded-full blur-[40px] opacity-20"></div>
                      <h4 className="font-bold text-lg mb-2 relative z-10">Trebaš pomoć?</h4>
                      <p className="text-xs text-slate-400 mb-4 leading-relaxed relative z-10">
                          Ako imaš problema s alatima ili prijavom, kontaktiraj IT podršku.
                      </p>
                      <button className="w-full py-3 bg-white text-slate-900 rounded-xl text-xs font-black uppercase hover:bg-slate-200 transition-colors relative z-10">
                          Kontaktiraj Podršku
                      </button>
                  </div>
              </div>

          </div>
      </main>
    </div>
  );
}