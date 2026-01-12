'use client';

import { Trash2, Play } from 'lucide-react';
import { createBulkPDS, deleteAllPDSForYear } from './actions';
import SettingsModalClient from './SettingsModalClient';
import { useRouter } from 'next/navigation';
import { PDSGoal, PDSScaleLevel } from './types';

interface AdminControlsProps {
  selectedYear: number;
  template: {
    goals: PDSGoal[];
    scale: PDSScaleLevel[];
  } | null;
  currentUserId: string;
}

export default function AdminControlsClient({ selectedYear, template, currentUserId }: AdminControlsProps) {
  const router = useRouter();

  const handleBulkDelete = async () => {
    if(!confirm(`Obrisati SVE evaluacije za ${selectedYear}?`)) return;
    const res = await deleteAllPDSForYear(selectedYear);
    if (res.success) {
        router.refresh();
    } else {
        alert("Greška pri brisanju.");
    }
  };

  const handleBulkCreate = async () => {
    const res = await createBulkPDS(currentUserId, selectedYear);
    if (res.success) {
        router.refresh();
    } else {
        alert("Greška pri generisanju. Provjerite da li već postoje evaluacije.");
    }
  };

  return (
    <div className="flex gap-3">
      <button 
        onClick={handleBulkDelete} 
        className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all border border-red-500/20 flex items-center gap-2 active:scale-95"
      >
        <Trash2 size={16}/> OBRIŠI SVE ({selectedYear})
      </button>
      
      <SettingsModalClient 
        year={selectedYear} 
        initialGoals={template?.goals || []} 
        initialScale={template?.scale || []} 
      />
      
      <button 
        onClick={handleBulkCreate}
        disabled={!template}
        className="bg-[#FFC72C] text-[#1a3826] px-6 py-2.5 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 disabled:opacity-50 shadow-md hover:-translate-y-0.5 transition-all active:translate-y-0"
      >
        <Play size={14} className="fill-current"/> Generiši za sve
      </button>
    </div>
  );
}