'use client';

import { useState } from 'react';
import { Settings, Trash2 } from 'lucide-react';
// FIX: SettingsModal je u istom folderu
import SettingsModal from './SettingsModal';
// FIX: actions su jedan folder iznad
import { deleteAllPDSForYear } from '../actions';

interface Props {
  selectedYear: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  template: any;
  currentUserId: string;
}

export default function AdminControlsClient({ selectedYear, template, currentUserId }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _unused = { currentUserId };

  const handleDelete = async () => {
    if (confirm('Jeste li sigurni da želite obrisati sve PDS-ove za ovu godinu u AKTIVNOM restoranu?')) {
      setIsDeleting(true);
      await deleteAllPDSForYear(selectedYear);
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button 
        onClick={() => setShowSettings(true)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-[#1a3826] hover:bg-slate-50 transition-all shadow-sm"
      >
        <Settings size={14} />
        UREDI PRAVILA
      </button>

      <button 
        onClick={handleDelete}
        disabled={isDeleting}
        className="flex items-center justify-center w-9 h-9 bg-white border border-red-100 rounded-xl text-red-500 hover:bg-red-50 transition-all shadow-sm"
        title="Obriši sve za ovu godinu"
      >
        {isDeleting ? <span className="animate-spin">↻</span> : <Trash2 size={14} />}
      </button>

      {showSettings && (
        <SettingsModal 
          year={selectedYear}
          initialGoals={template?.goals || []} 
          initialScale={template?.scale || []}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}