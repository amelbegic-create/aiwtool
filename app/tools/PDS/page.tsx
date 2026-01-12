/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { User, ChevronRight, LayoutList } from 'lucide-react';
import AdminControlsClient from './AdminControlsClient';

const prisma = new PrismaClient();
const db = prisma as any;

// Definisanje raspona godina koji je nedostajao
const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

export default async function PDSDashboard(props: { searchParams: Promise<{ year?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return redirect("/");

  // Next.js 15 zahtijeva await za searchParams
  const searchParams = await props.searchParams;
  const selectedYear = searchParams.year ? parseInt(searchParams.year) : 2026;

  const currentUser = await prisma.user.findUnique({ 
    where: { email: session.user.email } 
  });
  
  // Provjera managerskih rola za admin kontrole
  const isManager = ['ADMIN', 'MANAGER', 'SUPER_ADMIN', 'SYSTEM_ARCHITECT'].includes(currentUser?.role || '');

  // Dohvatanje šablona i liste PDS-ova
  const template = await db.pDSTemplate.findUnique({ where: { year: selectedYear } });
  const pdsList = await db.pDS.findMany({
    where: isManager ? { year: selectedYear } : { userId: currentUser?.id, year: selectedYear },
    include: { user: true },
    orderBy: { user: { name: 'asc' } }
  });

  // Sigurna konverzija podataka za klijenta
  const safeTemplate = template ? JSON.parse(JSON.stringify(template)) : null;
  const safePdsList = JSON.parse(JSON.stringify(pdsList));

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 md:p-12 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* HEADER SEKCIJA SA GODINAMA */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <h1 className="text-6xl font-[1000] text-[#1a3826] uppercase tracking-tighter leading-none">
              PDS <span className="text-[#FFC72C]">LISTA</span>
            </h1>
            
            {/* Selektor godina - rješava problem nedostajućih godina */}
            <div className="flex gap-2 mt-6 bg-white p-1.5 rounded-2xl border shadow-sm ring-1 ring-slate-100">
              {YEARS.map(y => (
                <Link 
                  key={y} 
                  href={`/tools/PDS?year=${y}`} 
                  className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${
                    selectedYear === y 
                    ? 'bg-[#1a3826] text-white shadow-lg' 
                    : 'text-slate-400 hover:text-[#1a3826] hover:bg-slate-50'
                  }`}
                >
                  {y}
                </Link>
              ))}
            </div>
          </div>
          
          {/* Admin kontrole - rješava problem nevidljivog dugmeta "Uredi pravila" */}
          {isManager && (
            <AdminControlsClient 
              selectedYear={selectedYear} 
              template={safeTemplate} 
              currentUserId={currentUser!.id} 
            />
          )}
        </div>

        {/* LIST VIEW DIZAJN */}
        <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden">
          <div className="p-8 bg-slate-50 border-b flex items-center justify-between">
            <div className="flex items-center gap-3 text-[#1a3826]">
              <LayoutList size={22}/>
              <span className="font-[1000] uppercase text-sm tracking-tighter">
                Zaposlenici za {selectedYear}. godinu
              </span>
            </div>
            <div className="text-xs font-black text-slate-300 uppercase tracking-widest">
              Ukupno: {safePdsList.length}
            </div>
          </div>
          
          <div className="divide-y divide-slate-100">
            {safePdsList.map((pds: any) => (
              <Link 
                key={pds.id} 
                href={`/tools/PDS/${pds.id}`}
                className="group flex flex-col md:flex-row items-center justify-between p-8 hover:bg-slate-50 transition-all gap-6"
              >
                <div className="flex items-center gap-6 flex-1">
                  <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center text-[#1a3826] group-hover:bg-[#1a3826] group-hover:text-white transition-all shadow-inner border border-white">
                    <User size={28}/>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 group-hover:text-[#1a3826] transition-colors tracking-tight">
                      {pds.user.name}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {pds.user.role || 'Personal'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-10 w-full md:w-auto justify-between md:justify-end">
                   <div className="text-center">
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Status</p>
                      <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm ${
                        pds.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 
                        pds.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-700' : 'bg-orange-50 text-orange-600'
                      }`}>
                        {pds.status}
                      </span>
                   </div>

                   <div className="text-center min-w-[100px]">
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Rezultat</p>
                      <p className="text-3xl font-black text-[#1a3826] tracking-tighter">
                        {pds.totalScore}<span className="text-[10px] text-slate-300 ml-1">pts</span>
                      </p>
                   </div>

                   <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 group-hover:bg-[#FFC72C] group-hover:text-[#1a3826] transition-all shadow-inner">
                      <ChevronRight size={28}/>
                   </div>
                </div>
              </Link>
            ))}

            {safePdsList.length === 0 && (
              <div className="p-32 text-center">
                <p className="text-slate-300 font-black uppercase tracking-[0.5em] text-sm">
                  Nema aktivnih evaluacija za odabranu godinu
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}