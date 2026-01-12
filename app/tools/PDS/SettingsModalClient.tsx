/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { Edit } from 'lucide-react';
import SettingsModal from './components/SettingsModal';
import { PDSGoal, PDSScaleLevel } from './types';

interface SettingsModalClientProps {
  year: number;
  initialGoals: PDSGoal[] | any;
  initialScale: PDSScaleLevel[] | any;
}

export default function SettingsModalClient({ year, initialGoals, initialScale }: SettingsModalClientProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)} 
        className="bg-white border-2 border-[#1a3826] text-[#1a3826] hover:bg-[#1a3826] hover:text-[#FFC72C] px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 shadow-sm active:scale-95"
      >
        <Edit size={14} className="stroke-[3px]"/> UREDI PRAVILA
      </button>

      {isOpen && (
        <SettingsModal 
          year={year} 
          initialGoals={initialGoals as PDSGoal[]} 
          initialScale={initialScale as PDSScaleLevel[]} 
          onClose={() => setIsOpen(false)} 
        />
      )}
    </>
  );
}