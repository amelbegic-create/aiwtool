/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { User, Search, Filter } from 'lucide-react';
import AdminControlsClient from './AdminControlsClient';

const prisma = new PrismaClient();
const db = prisma as any;

const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

export default async function PDSDashboard(props: { searchParams: Promise<{ year?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return redirect("/");

  const searchParams = await props.searchParams;
  const selectedYear = searchParams.year ? parseInt(searchParams.year) : new Date().getFullYear();

  const currentUser = await prisma.user.findUnique({ 
    where: { email: session.user.email } 
  });
  
  const isManager = ['ADMIN', 'MANAGER', 'SUPER_ADMIN', 'SYSTEM_ARCHITECT'].includes(currentUser?.role || '');

  const template = await db.pDSTemplate.findUnique({ where: { year: selectedYear } });
  
  const pdsList = await db.pDS.findMany({
    where: isManager ? { year: selectedYear } : { userId: currentUser?.id, year: selectedYear },
    include: { user: true },
    orderBy: { user: { name: 'asc' } }
  });

  const safeTemplate = template ? JSON.parse(JSON.stringify(template)) : null;
  const safePdsList = JSON.parse(JSON.stringify(pdsList));

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 md:p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-black text-[#1a3826] uppercase tracking-tighter mb-2">
              PDS <span className="text-[#FFC72C]">EVALUACIJE</span>
            </h1>
            <p className="text-slate-500 text-sm font-medium">Upravljanje učinkom i razvojem zaposlenika</p>
          </div>
          
          <div className="flex flex-col items-end gap-4">
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
              {YEARS.map(y => (
                <Link 
                  key={y} 
                  href={`/tools/PDS?year=${y}`} 
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedYear === y 
                    ? 'bg-[#1a3826] text-white shadow-sm' 
                    : 'text-slate-500 hover:text-[#1a3826] hover:bg-slate-50'
                  }`}
                >
                  {y}
                </Link>
              ))}
            </div>
            
            {isManager && (
              <AdminControlsClient 
                selectedYear={selectedYear} 
                template={safeTemplate} 
                currentUserId={currentUser!.id} 
              />
            )}
          </div>
        </div>

        {/* Data Table View */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Table Header Controls */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                    <input type="text" placeholder="Pretraži zaposlenika..." className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#1a3826] w-64 transition-all"/>
                </div>
                <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50">
                    <Filter size={14}/> Filter Statusa
                </button>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <div className="col-span-4">Zaposlenik</div>
                <div className="col-span-2">Uloga</div>
                <div className="col-span-2 text-center">Status</div>
                <div className="col-span-2 text-center">Rezultat</div>
                <div className="col-span-2 text-right">Akcija</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-slate-100">
                {safePdsList.length > 0 ? (
                    safePdsList.map((pds: any) => (
                        <div key={pds.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50/80 transition-colors group">
                            <div className="col-span-4 flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-[#1a3826] text-white flex items-center justify-center text-xs font-bold shadow-sm overflow-hidden relative">
                                    {/* FIX: Običan img sa alt tagom da zadovolji lint */}
                                    {pds.user.image ? (
                                        <img src={pds.user.image} alt="User" className="h-full w-full object-cover"/>
                                    ) : (
                                        <User size={14}/>
                                    )}
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-800">{pds.user.name}</div>
                                    <div className="text-[10px] text-slate-400">{pds.user.email}</div>
                                </div>
                            </div>
                            <div className="col-span-2">
                                <span className="inline-block px-2 py-1 rounded bg-slate-100 text-[10px] font-bold text-slate-500 uppercase">
                                    {pds.user.role}
                                </span>
                            </div>
                            <div className="col-span-2 text-center">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                                    pds.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                    pds.status === 'SUBMITTED' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                                    'bg-orange-50 text-orange-600 border-orange-100'
                                }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                         pds.status === 'COMPLETED' ? 'bg-emerald-500' : 
                                         pds.status === 'SUBMITTED' ? 'bg-blue-500' : 
                                         'bg-orange-500'
                                    }`}></span>
                                    {pds.status}
                                </span>
                            </div>
                            <div className="col-span-2 text-center">
                                <span className="text-sm font-black text-[#1a3826]">{pds.totalScore}</span>
                                <span className="text-[10px] text-slate-400 ml-1">pts</span>
                            </div>
                            <div className="col-span-2 text-right">
                                <Link 
                                    href={`/tools/PDS/${pds.id}`}
                                    className="inline-block text-[10px] font-bold text-[#1a3826] bg-[#FFC72C] hover:bg-[#e6b225] px-4 py-2 rounded-lg transition-colors shadow-sm"
                                >
                                    OTVORI
                                </Link>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-20 text-center">
                        <div className="inline-block p-4 rounded-full bg-slate-50 mb-3">
                            <Search className="text-slate-300" size={32}/>
                        </div>
                        <p className="text-sm font-bold text-slate-500">Nema pronađenih evaluacija za {selectedYear}.</p>
                        {/* FIX: Escaped quotes */}
                        {isManager && <p className="text-xs text-slate-400 mt-1">Koristite &quot;Generiši&quot; opciju iznad.</p>}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}