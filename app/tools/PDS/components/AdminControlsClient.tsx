'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Play, Edit, Globe, Store } from 'lucide-react';
import { createBulkPDS, deleteAllPDSForYear, getGlobalPDSForExport } from '../../../actions/pdsActions';
import { toast } from 'sonner';
import SettingsModal from './SettingsModal';
import type { PDSGoal, PDSScaleLevel } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface RestaurantOption {
  id: string;
  name: string;
  code: string;
}

interface PDSListItem {
  id: string;
  user: { name: string | null };
  totalScore: number;
  finalGrade: string | null;
}

interface Props {
  selectedYear: number;
  template: any;
  currentUserId: string;
  restaurants: RestaurantOption[];
  pdsList: PDSListItem[];
}

export default function AdminControlsClient({ selectedYear, template, currentUserId, restaurants, pdsList }: Props) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportingRestaurant, setExportingRestaurant] = useState(false);
  const [exportingGlobal, setExportingGlobal] = useState(false);

  const handleGenerate = async () => {
    if (!template || !template.goals || template.goals.length === 0) {
      return alert('Bitte definieren Sie zuerst Ziele und Skala.');
    }

    setIsGenerating(true);

    try {
      const yearAsNumber = Number(selectedYear);
      const res = await createBulkPDS(yearAsNumber, currentUserId);

      if (res?.success) {
        toast.success('PDS-Einträge erstellt.');
        router.refresh();
      } else {
        alert(res?.error || 'Fehler beim Erstellen.');
      }
    } catch (error) {
      console.error(error);
      alert('Fehler.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async () => {
    const ok = confirm(`Möchten Sie wirklich alle PDS-Einträge für ${selectedYear} löschen?`);
    if (!ok) return;

    setIsDeleting(true);
    try {
        const yearAsNumber = Number(selectedYear);
        await deleteAllPDSForYear(yearAsNumber);
        toast.success("PDS-Einträge gelöscht.");
        router.refresh();
    } catch (error) {
        console.error(error);
        alert("Fehler beim Löschen.");
    } finally {
        setIsDeleting(false);
    }
  };

  const exportByRestaurant = () => {
    setExportingRestaurant(true);
    try {
      const doc = new jsPDF();
      doc.setFillColor(26, 56, 38);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 24, 'F');
      doc.setTextColor(255, 199, 44);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('AIW Services', 14, 10);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text('PDS – Bewertungen pro Restaurant', 14, 18);
      doc.setFontSize(8);
      doc.setTextColor(255, 199, 44);
      doc.text(`Jahr: ${selectedYear}`, 14, 23);

      const data = (pdsList || []).map((p) => [
        p.user?.name ?? 'N/A',
        p.finalGrade ?? '–',
        String(p.totalScore ?? 0)
      ]);
      autoTable(doc, {
        startY: 30,
        head: [['Mitarbeiter', 'Bewertung', 'Punkte']],
        body: data,
        theme: 'plain',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [26, 56, 38], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 50 }, 2: { cellWidth: 30 } }
      });
      doc.save(`PDS_Bewertungen_Restaurant_${selectedYear}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Fehler beim Export.');
    } finally {
      setExportingRestaurant(false);
    }
  };

  const exportGlobal = async () => {
    setExportingGlobal(true);
    try {
      const rows = await getGlobalPDSForExport(selectedYear);
      const doc = new jsPDF();
      doc.setFillColor(26, 56, 38);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 24, 'F');
      doc.setTextColor(255, 199, 44);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('AIW Services', 14, 10);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text('PDS – Globale Bewertungen', 14, 18);
      doc.setFontSize(8);
      doc.setTextColor(255, 199, 44);
      doc.text(`Jahr: ${selectedYear}`, 14, 23);

      const data = rows.map((r) => [r.userName, r.restaurantName, r.finalGrade ?? '–', String(r.totalScore)]);
      autoTable(doc, {
        startY: 30,
        head: [['Mitarbeiter', 'Restaurant', 'Bewertung', 'Punkte']],
        body: data,
        theme: 'plain',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [26, 56, 38], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 45 }, 2: { cellWidth: 40 }, 3: { cellWidth: 25 } }
      });
      doc.save(`PDS_Bewertungen_Global_${selectedYear}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Fehler beim Export.');
    } finally {
      setExportingGlobal(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-[#1a3826] text-[#1a3826] rounded-xl text-xs font-bold hover:bg-[#1a3826] hover:text-[#FFC72C] transition-colors shadow-sm"
        >
          <Edit size={14} className="stroke-[3px]" /> REGELN BEARBEITEN
        </button>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a3826] text-white rounded-xl text-xs font-bold hover:bg-[#142e1e] disabled:opacity-60 transition-colors shadow-sm"
        >
          {isGenerating ? <span className="animate-spin">↻</span> : <Play size={14} />}
          ERSTELLEN
        </button>
        <button
          onClick={exportByRestaurant}
          disabled={exportingRestaurant || pdsList.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 disabled:opacity-60 transition-colors shadow-sm"
          title="PDF herunterladen: Bewertungen für aktuelles Restaurant"
        >
          {exportingRestaurant ? <span className="animate-spin">↻</span> : <Store size={14} />}
          EXPORT RESTAURANT
        </button>
        <button
          onClick={exportGlobal}
          disabled={exportingGlobal}
          className="flex items-center gap-2 px-4 py-2 bg-[#FFC72C] text-[#1a3826] rounded-xl text-xs font-bold hover:bg-[#e6b225] disabled:opacity-60 transition-colors shadow-sm"
          title="PDF herunterladen: alle Bewertungen, alle Restaurants"
        >
          {exportingGlobal ? <span className="animate-spin">↻</span> : <Globe size={14} />}
          GLOBAL EXPORT
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex items-center justify-center w-9 h-9 bg-white border border-red-100 rounded-xl text-red-500 hover:bg-red-50 disabled:opacity-60 transition-colors shadow-sm"
          title="Alle Einträge für dieses Jahr löschen"
        >
          {isDeleting ? <span className="animate-spin">↻</span> : <Trash2 size={14} />}
        </button>
      </div>

      {settingsOpen && (
        <SettingsModal
          year={selectedYear}
          initialGoals={(template?.goals as PDSGoal[]) ?? []}
          initialScale={(template?.scale as PDSScaleLevel[]) ?? []}
          restaurants={restaurants}
          currentUserId={currentUserId}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}