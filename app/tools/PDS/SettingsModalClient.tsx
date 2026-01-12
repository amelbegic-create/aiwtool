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
        className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"
      >
        <Edit size={16}/> UREDI PRAVILA
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