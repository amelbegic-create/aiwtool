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
    if(!confirm(`Oprez! Ovo će trajno obrisati SVE PDS evaluacije za ${selectedYear}. godinu.\n\nDa li ste sigurni?`)) return;
    const res = await deleteAllPDSForYear(selectedYear);
    if (res.success) router.refresh();
    else alert("Greška pri brisanju.");
  };

  const handleBulkCreate = async () => {
    if(!template || !template.goals || template.goals.length === 0) return alert("Prvo morate definisati pravila (Ciljeve i Skalu)!");
    
    const res = await createBulkPDS(currentUserId, selectedYear);
    if (res.success) {
        alert("Generisanje uspješno!");
        router.refresh();
    } else {
        alert("Greška pri generisanju.");
    }
  };

  return (
    <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
      <SettingsModalClient 
        year={selectedYear} 
        initialGoals={template?.goals || []} 
        initialScale={template?.scale || []} 
      />
      
      <div className="w-px h-6 bg-slate-200 mx-1"></div>

      <button 
        onClick={handleBulkCreate}
        disabled={!template}
        className="bg-[#1a3826] hover:bg-[#142e1e] text-white px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all active:scale-95"
      >
        <Play size={14} className="fill-current"/> Generiši
      </button>

      <button 
        onClick={handleBulkDelete} 
        className="text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-2.5 rounded-xl transition-all"
        title="Obriši sve"
      >
        <Trash2 size={16}/>
      </button>
    </div>
  );
}