'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Play } from 'lucide-react';
// 👇 SADA OVO GAĐA TAČNU PUTANJU (ako si uradio Korak 1)
import { createBulkPDS, deleteAllPDSForYear } from '@/app/actions/pdsActions'; 

interface Props {
  selectedYear: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  template: any;
  currentUserId: string;
}

export default function AdminControlsClient({ selectedYear, template, currentUserId }: Props) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleGenerate = async () => {
    if (!template || !template.goals || template.goals.length === 0) {
      return alert('Prvo morate definisati pravila (Ciljeve i Skalu)!');
    }

    setIsGenerating(true);

    try {
      const yearAsNumber = Number(selectedYear);
      const res = await createBulkPDS(yearAsNumber, currentUserId);

      if (res?.success) {
        alert('Generisanje uspješno!');
        router.refresh();
      } else {
        alert(res?.error || 'Greška pri generisanju.');
      }
    } catch (error) {
      console.error(error);
      alert('Greška.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async () => {
    const ok = confirm(`Jeste li sigurni da želite obrisati sve PDS-ove za ${selectedYear}. godinu?`);
    if (!ok) return;

    setIsDeleting(true);
    try {
        const yearAsNumber = Number(selectedYear);
        await deleteAllPDSForYear(yearAsNumber);
        router.refresh();
        alert("Uspješno obrisano.");
    } catch (error) {
        console.error(error);
        alert("Greška pri brisanju.");
    } finally {
        setIsDeleting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="flex items-center gap-2 px-4 py-2 bg-[#1a3826] text-white rounded-xl text-xs font-bold hover:bg-[#142e1e] disabled:opacity-60 transition-colors shadow-sm"
      >
        {isGenerating ? <span className="animate-spin">↻</span> : <Play size={14} />}
        GENERIŠI
      </button>

      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="flex items-center justify-center w-9 h-9 bg-white border border-red-100 rounded-xl text-red-500 hover:bg-red-50 disabled:opacity-60 transition-colors shadow-sm"
        title="Obriši sve za ovu godinu"
      >
        {isDeleting ? <span className="animate-spin">↻</span> : <Trash2 size={14} />}
      </button>
    </div>
  );
}