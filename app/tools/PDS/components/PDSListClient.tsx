/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, User } from 'lucide-react';

interface Props {
  data: any[];
  year: number;
  isManager: boolean;
}

export default function PDSListClient({ data, year, isManager }: Props) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filtriranje u realnom vremenu
  const filteredList = data.filter((pds) => 
    pds.user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pds.user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* HEADER TABLICE + SEARCH */}
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
          <input 
            type="text" 
            placeholder="Mitarbeiter suchen…" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#1a3826] w-64 transition-all"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded">
            Angezeigt: {filteredList.length}
          </span>
        </div>
      </div>

      {/* HEADER KOLONE */}
      <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
        <div className="col-span-4">Mitarbeiter</div>
        <div className="col-span-2">Rolle</div>
        <div className="col-span-2 text-center">Status</div>
        <div className="col-span-2 text-center">Ergebnis</div>
        <div className="col-span-2 text-center">Aktionen</div>
      </div>

      {/* LISTA */}
      <div className="divide-y divide-slate-100">
        {filteredList.length > 0 ? (
          filteredList.map((pds: any) => (
            <div key={pds.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50/80 transition-colors group">
              <div className="col-span-4 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[#1a3826] text-white flex items-center justify-center text-xs font-bold shadow-sm overflow-hidden relative">
                  {pds.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
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
                  pds.status === 'APPROVED' ? 'bg-green-50 text-green-600 border-green-100' :
                  pds.status === 'SUBMITTED' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                  pds.status === 'RETURNED' ? 'bg-red-50 text-red-600 border-red-100' :
                  'bg-orange-50 text-orange-600 border-orange-100'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                    pds.status === 'COMPLETED' ? 'bg-emerald-500' :
                    pds.status === 'APPROVED' ? 'bg-green-500' :
                    pds.status === 'SUBMITTED' ? 'bg-blue-500' :
                    pds.status === 'RETURNED' ? 'bg-red-500' :
                    'bg-orange-500'
                  }`}></span>
                  {pds.status === 'DRAFT' || pds.status === 'OPEN' || pds.status === 'IN_PROGRESS' ? 'Entwurf' : pds.status === 'SUBMITTED' || pds.status === 'PENDING' ? 'Eingereicht' : pds.status === 'APPROVED' ? 'Genehmigt' : pds.status === 'RETURNED' ? 'Zur Überarbeitung' : pds.status === 'ARCHIVED' ? 'Archiviert' : pds.status === 'COMPLETED' ? 'Abgeschlossen' : pds.status}
                </span>
              </div>
              <div className="col-span-2 text-center">
                <span className="text-sm font-black text-[#1a3826]">{pds.totalScore}</span>
                <span className="text-[10px] text-slate-400 ml-1">pts</span>
              </div>
              <div className="col-span-2 flex justify-center">
                <Link 
                  href={`/tools/PDS/${pds.id}`}
                  className="inline-block text-[10px] font-bold text-[#1a3826] bg-[#FFC72C] hover:bg-[#e6b225] px-4 py-2 rounded-lg transition-colors shadow-sm"
                  title="Beurteilung öffnen"
                >
                  ÖFFNEN
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center">
            <div className="inline-block p-4 rounded-full bg-slate-50 mb-3">
              <Search className="text-slate-300" size={32}/>
            </div>
            <p className="text-sm font-bold text-slate-500">Keine Beurteilungen gefunden.</p>
            {isManager && <p className="text-xs text-slate-400 mt-1">Bitte prüfen Sie, ob für dieses Jahr Beurteilungsregeln definiert sind.</p>}
          </div>
        )}
      </div>
    </div>
  );
}