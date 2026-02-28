'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRef, useEffect } from 'react';
import { Trash2, Play, Globe, Store, ChevronDown } from 'lucide-react';
import { createBulkPDS, deleteAllPDSForYear, getFullPDSListForGlobalExport, getGlobalPDSForExport } from '../../../actions/pdsActions';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateDDMMGGGG } from '@/lib/dateUtils';

interface RestaurantOption {
  id: string;
  name: string;
  code: string;
}

const PDS_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Entwurf',
  OPEN: 'Offen',
  IN_PROGRESS: 'In Bearbeitung',
  SUBMITTED: 'Eingereicht',
  RETURNED: 'Zurückgegeben',
  APPROVED: 'Genehmigt',
  COMPLETED: 'Abgeschlossen'
};

function getGoalPointRangeLabel(goal: {
  type?: string;
  scoringRules?: Array<{ from: number; to: number; pts: number }>;
  yesPoints?: number;
  noPoints?: number;
}): string {
  if (goal.type === 'BOOLEAN') {
    const ja = goal.yesPoints ?? 0;
    const nein = goal.noPoints ?? 0;
    return `Ja: ${ja}, Nein: ${nein}`;
  }
  const rules = goal.scoringRules ?? [];
  if (rules.length === 0) return '–';
  return rules.map((r) => `${r.from}–${r.to}`).join(', ');
}

interface PDSListItem {
  id: string;
  user: { name: string | null; email?: string | null; role?: string | null; supervisor?: { name: string | null } | null };
  totalScore: number;
  finalGrade: string | null;
  status?: string;
  goals?: Array<{ title?: string; type?: string; result?: unknown; points?: number }>;
  scale?: unknown;
  employeeComment?: string | null;
  managerComment?: string | null;
  employeeSignature?: string | null;
  managerSignature?: string | null;
  year?: number;
  restaurant?: { name?: string | null; code?: string } | null;
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
  const [exportingRestaurant, setExportingRestaurant] = useState(false);
  const [exportingGlobal, setExportingGlobal] = useState(false);
  const [exportingCards, setExportingCards] = useState(false);
  const [openExportMenu, setOpenExportMenu] = useState<'restaurant' | 'global' | null>(null);
  const menuRestaurantRef = useRef<HTMLDivElement>(null);
  const menuGlobalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (openExportMenu && menuRestaurantRef.current && !menuRestaurantRef.current.contains(e.target as Node) && menuGlobalRef.current && !menuGlobalRef.current.contains(e.target as Node)) {
        setOpenExportMenu(null);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openExportMenu]);

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
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 14;
      const exportYear = selectedYear - 1;

      doc.setFillColor(26, 56, 38);
      doc.rect(0, 0, pageW, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('AIW Services', margin, 12);
      doc.setFontSize(14);
      doc.text('PDS – Bewertungen pro Restaurant', margin, 20);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(255, 199, 44);
      doc.text(`Erstellt: ${new Date().toLocaleDateString('de-AT')}`, margin, 26);

      const yearBoxW = 22;
      const yearBoxH = 10;
      const yearBoxX = pageW - margin - yearBoxW;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(yearBoxX, 9, yearBoxW, yearBoxH, 1, 1, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(String(exportYear), yearBoxX + yearBoxW / 2, 9 + yearBoxH / 2 + 1.5, { align: 'center' });

      const scale = (template?.scale ?? []) as Array<{ label: string; colorHex?: string }>;
      const gradeToRgb = (grade: string | null): [number, number, number] => {
        if (!grade) return [100, 116, 139];
        const level = scale.find((s) => s.label === grade);
        if (level?.colorHex) {
          const hex = level.colorHex.replace('#', '');
          return [
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16),
          ];
        }
        if (/ungenügend|ungenuegend/i.test(grade)) return [239, 68, 68];
        if (/genügend|genuegend/i.test(grade)) return [245, 158, 11];
        if (/gut/i.test(grade)) return [34, 197, 94];
        if (/ausgezeichnet|sehr gut/i.test(grade)) return [26, 56, 38];
        return [100, 116, 139];
      };

      const data = (pdsList || []).map((p) => [
        p.user?.name ?? 'N/A',
        String(p.totalScore ?? 0),
        p.finalGrade ?? '–',
        PDS_STATUS_LABELS[p.status ?? ''] ?? p.status ?? '–',
      ]);
      autoTable(doc, {
        startY: 34,
        head: [['Mitarbeiter', 'Punkte', 'Bewertung', 'Status']],
        body: data,
        theme: 'plain',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [26, 56, 38], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { cellWidth: 58, halign: 'left' },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 42, halign: 'center' },
          3: { cellWidth: 38, halign: 'center' },
        },
        didDrawCell: (hookData) => {
          if (hookData.section !== 'body' || hookData.column?.index !== 2) return;
          const rowIdx = hookData.row?.index ?? 0;
          const grade = data[rowIdx]?.[2] ?? '–';
          const [r, g, b] = gradeToRgb(grade);
          const x = Number(hookData.cell?.x ?? 0);
          const y = Number(hookData.cursor?.y ?? (hookData.cell as { y?: number })?.y ?? 0);
          const w = Number(hookData.cell?.width ?? 0);
          const h = Number(hookData.cell?.height ?? 0);
          doc.setFillColor(r, g, b);
          doc.rect(x, y, w, h, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.text(String(grade), x + w / 2, y + h / 2 + 1.5, { align: 'center' });
        },
      });
      doc.save(`PDS_Bewertungen_Restaurant_${exportYear}.pdf`);
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
      const fullList = await getFullPDSListForGlobalExport(selectedYear) as PDSListItem[];
      if (!fullList?.length) {
        alert('Keine PDS-Einträge für den Export vorhanden.');
        return;
      }
      const doc = new jsPDF('p', 'mm', 'a4');
      const w = doc.internal.pageSize.getWidth();
      const margin = 14;
      const maxTextWidth = w - 2 * margin;
      const exportYear = selectedYear - 1;
      const boxW = 42;
      const boxH = 28;
      const rangeColWidth = 32;
      const goalLineHeight = 4.5;
      const sigImgW = 45;
      const sigImgH = 22;
      const leftX = margin;
      const rightX = w - margin - sigImgW;

      const drawFirstPageHeader = (title: string) => {
        doc.setFillColor(26, 56, 38);
        doc.rect(0, 0, w, 28, 'F');
        doc.setTextColor(255, 199, 44);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('AIW Services', margin, 12);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.text(title, margin, 20);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(255, 199, 44);
        doc.text(`Erstellt: ${formatDateDDMMGGGG(new Date())}`, margin, 26);
        const yearBoxW = 22;
        const yearBoxH = 10;
        const yearBoxX = w - margin - yearBoxW;
        doc.setFillColor(255, 255, 255);
        doc.rect(yearBoxX, 9, yearBoxW, yearBoxH, 'F');
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(String(exportYear), yearBoxX + yearBoxW / 2, 9 + yearBoxH / 2 + 1.5, { align: 'center' });
      };

      for (let idx = 0; idx < fullList.length; idx++) {
        const pds = fullList[idx];
        const name = pds.user?.name ?? 'Mitarbeiter';
        if (idx === 0) {
          drawFirstPageHeader('PDS – Bewertungen gesamte Firma');
        } else {
          doc.addPage();
        }
        let y = idx === 0 ? 36 : 20;

        const supervisorName = pds.user?.supervisor?.name ?? null;
        const goals = Array.isArray(pds.goals) ? pds.goals : [];
        const totalScore = pds.totalScore ?? goals.reduce((acc: number, g: { points?: number }) => acc + (Number(g?.points) || 0), 0);
        const finalGrade = pds.finalGrade ?? '–';
        const employeeComment = pds.employeeComment ?? '';
        const managerComment = pds.managerComment ?? '';
        const empSigImg = typeof pds.employeeSignature === 'string' && pds.employeeSignature.startsWith('data:image') ? pds.employeeSignature : null;
        const mgrSigImg = typeof pds.managerSignature === 'string' && pds.managerSignature.startsWith('data:image') ? pds.managerSignature : null;
        const isSystemArchitect = pds.user?.role === 'SYSTEM_ARCHITECT';
        const restaurantName = pds.restaurant ? (pds.restaurant.name || pds.restaurant.code || '') : '';

        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.text(name, margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(`${pds.user?.email ?? ''} • ${pds.user?.role ?? ''}`, margin, y);
        y += 5;
        if (restaurantName) {
          doc.setFontSize(8);
          doc.text(`Restaurant: ${restaurantName}`, margin, y);
          y += 5;
        }
        if (supervisorName) {
          doc.setFontSize(8);
          doc.text(`Vorgesetzte/r: ${supervisorName}`, margin, y);
          y += 5;
        }
        y += 5;

        const boxTop = Math.max(28, y - 18);
        doc.setFillColor(26, 56, 38);
        doc.rect(w - margin - boxW, boxTop, boxW, boxH, 'F');
        const boxCenterX = w - margin - boxW / 2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 199, 44);
        doc.text('BEWERTUNG', boxCenterX, boxTop + 8, { align: 'center' });
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.text(String(finalGrade), boxCenterX, boxTop + 18, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(255, 199, 44);
        doc.text(`Punkte: ${totalScore}`, boxCenterX, boxTop + 24, { align: 'center' });
        y = Math.max(y, boxTop + boxH + 6);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        doc.text('ZIELE UND ERGEBNISSE', margin, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text('bodovanje', margin, y);
        y += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        const twoCols = goals.length >= 10;
        const gap = 6;
        const colWidth = twoCols ? (w - 2 * margin - gap) / 2 : w - 2 * margin;
        const goalTextWidth = colWidth - 22 - rangeColWidth;

        const drawOneGoalBlock = (goal: { title?: string; type?: string; result?: unknown; points?: number }, goalIndex: number, x: number, startY: number, blockWidth: number): number => {
          const title = goal.title ?? `Ziel ${goalIndex + 1}`;
          const titleLines = doc.splitTextToSize(title, goalTextWidth);
          const res = goal.type === 'BOOLEAN' ? (goal.result ? 'Ja' : 'Nein') : String(goal.result ?? '');
          const blockTop = startY;
          const titleHeight = titleLines.length * goalLineHeight;
          const resultY = blockTop + titleHeight + goalLineHeight;
          const rowH = titleHeight + goalLineHeight * 2 + 4;
          const localRangeX = x + blockWidth - 14 - rangeColWidth;
          const localScoreX = x + blockWidth - 14;
          doc.setFillColor(249, 250, 251);
          doc.rect(x, blockTop - 2, blockWidth, rowH, 'F');
          doc.setFont('helvetica', 'bold');
          titleLines.forEach((line: string, li: number) => {
            doc.text(line, x + 2, blockTop + 2 + (li + 1) * goalLineHeight);
          });
          doc.setFont('helvetica', 'normal');
          doc.text(`Ergebnis: ${res}`, x + 2, resultY + 2);
          doc.setFontSize(6);
          doc.setTextColor(71, 85, 105);
          const rangeLabel = getGoalPointRangeLabel(goal as Parameters<typeof getGoalPointRangeLabel>[0]);
          const rangeLines = doc.splitTextToSize(rangeLabel, rangeColWidth - 2);
          rangeLines.slice(0, 2).forEach((line: string, li: number) => {
            doc.text(line, localRangeX + 1, blockTop + 2 + goalLineHeight + li * 2.8);
          });
          doc.setFontSize(8);
          doc.setTextColor(26, 56, 38);
          doc.setFont('helvetica', 'bold');
          doc.text(`${goal.points ?? 0} Pkt`, localScoreX, blockTop + 2 + goalLineHeight);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(15, 23, 42);
          return blockTop + rowH + 2;
        };

        if (twoCols) {
          const leftGoals = goals.slice(0, Math.ceil(goals.length / 2));
          const rightGoals = goals.slice(Math.ceil(goals.length / 2));
          const leftXCol = margin;
          const rightXCol = margin + colWidth + gap;
          for (let row = 0; row < leftGoals.length; row++) {
            if (y > 265) { doc.addPage(); y = 20; }
            const leftGoal = leftGoals[row];
            const rightGoal = rightGoals[row];
            const yAfterLeft = drawOneGoalBlock(leftGoal, row, leftXCol, y, colWidth);
            let yAfterRight = y;
            if (rightGoal) {
              yAfterRight = drawOneGoalBlock(rightGoal, leftGoals.length + row, rightXCol, y, colWidth);
            }
            y = Math.max(yAfterLeft, yAfterRight);
          }
        } else {
          goals.forEach((goal: { title?: string; type?: string; result?: unknown; points?: number }, i: number) => {
            if (y > 265) { doc.addPage(); y = 20; }
            y = drawOneGoalBlock(goal, i, margin, y, colWidth);
          });
        }

        y += 5;
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        doc.text('KOMMENTARE', margin, y);
        y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const commentWidth = maxTextWidth - 4;
        const commentLineH = 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Mitarbeiter:', margin, y);
        y += commentLineH;
        doc.setFont('helvetica', 'normal');
        const empText = (employeeComment || '–').trim() || '–';
        doc.splitTextToSize(empText, commentWidth).forEach((line: string) => { doc.text(line, margin, y); y += commentLineH; });
        y += 4;
        doc.setFont('helvetica', 'bold');
        doc.text('Manager:', margin, y);
        y += commentLineH;
        doc.setFont('helvetica', 'normal');
        const mgrText = (managerComment || '–').trim() || '–';
        doc.splitTextToSize(mgrText, commentWidth).forEach((line: string) => { doc.text(line, margin, y); y += commentLineH; });
        y += 10;

        if (y > 260) { doc.addPage(); y = 20; }
        if (!isSystemArchitect) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.text('UNTERSCHRIFTEN', margin, y);
        y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text('Unterschrift Mitarbeiter:', leftX, y);
          if (empSigImg) {
            try { doc.addImage(empSigImg, 'PNG', leftX, y + 2, sigImgW, sigImgH); } catch { doc.text('________________', leftX, y + 8); }
          } else { doc.text('________________', leftX, y + 5); }
          doc.text('Unterschrift Manager:', rightX, y);
          if (mgrSigImg) {
            try { doc.addImage(mgrSigImg, 'PNG', rightX, y + 2, sigImgW, sigImgH); } catch { doc.text('________________', rightX, y + 8); }
          } else { doc.text('________________', rightX, y + 5); }
          y += sigImgH + 12;
        }
        doc.setFontSize(7);
        doc.text('Erstellt: ' + formatDateDDMMGGGG(new Date()), margin, y + 5);
      }

      doc.save(`PDS_Alle_Beurteilungen_Global_${exportYear}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Fehler beim Export.');
    } finally {
      setExportingGlobal(false);
    }
  };

  const exportGlobalTable = async () => {
    setOpenExportMenu(null);
    setExportingGlobal(true);
    try {
      const rows = await getGlobalPDSForExport(selectedYear);
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 14;
      const exportYear = selectedYear - 1;
      doc.setFillColor(26, 56, 38);
      doc.rect(0, 0, pageW, 24, 'F');
      doc.setTextColor(255, 199, 44);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('AIW Services', margin, 12);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text('PDS – Globale Bewertungen (Tabelle)', margin, 20);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(255, 199, 44);
      doc.text(`Erstellt: ${new Date().toLocaleDateString('de-AT')}`, margin, 23);
      const yearBoxW = 22;
      const yearBoxH = 10;
      const yearBoxX = pageW - margin - yearBoxW;
      const yearBoxY = 9;
      doc.setFillColor(255, 255, 255);
      doc.rect(yearBoxX, yearBoxY, yearBoxW, yearBoxH, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(String(exportYear), yearBoxX + yearBoxW / 2, yearBoxY + yearBoxH / 2 + 1.5, { align: 'center' });

      const scale = (template?.scale ?? []) as Array<{ label: string; colorHex?: string }>;
      const gradeToRgb = (grade: string | null): [number, number, number] => {
        if (!grade) return [100, 116, 139];
        const level = scale.find((s) => s.label === grade);
        if (level?.colorHex) {
          const hex = level.colorHex.replace('#', '');
          return [
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16),
          ];
        }
        if (/ungenügend|ungenuegend/i.test(grade)) return [239, 68, 68];
        if (/genügend|genuegend/i.test(grade)) return [245, 158, 11];
        if (/gut/i.test(grade)) return [34, 197, 94];
        if (/ausgezeichnet|sehr gut/i.test(grade)) return [26, 56, 38];
        return [100, 116, 139];
      };

      const data = rows.map((r) => [
        r.userName,
        r.restaurantName,
        String(r.totalScore),
        r.finalGrade ?? '–',
        r.status,
      ]);
      autoTable(doc, {
        startY: 30,
        head: [['Mitarbeiter', 'Restaurant', 'Punkte', 'Bewertung', 'Status']],
        body: data,
        theme: 'plain',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [26, 56, 38], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { cellWidth: 40, halign: 'left' },
          1: { cellWidth: 36, halign: 'center' },
          2: { cellWidth: 18, halign: 'center' },
          3: { cellWidth: 34, halign: 'center' },
          4: { cellWidth: 28, halign: 'center' },
        },
        didDrawCell: (hookData) => {
          if (hookData.section !== 'body' || hookData.column?.index !== 3) return;
          const rowIdx = hookData.row?.index ?? 0;
          const grade = data[rowIdx]?.[3] ?? '–';
          const [r, g, b] = gradeToRgb(grade);
          const x = Number(hookData.cell?.x ?? 0);
          const y = Number(hookData.cursor?.y ?? (hookData.cell as { y?: number })?.y ?? 0);
          const w = Number(hookData.cell?.width ?? 0);
          const h = Number(hookData.cell?.height ?? 0);
          doc.setFillColor(r, g, b);
          doc.rect(x, y, w, h, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text(String(grade), x + w / 2, y + h / 2 + 1.2, { align: 'center' });
        },
      });
      doc.save(`PDS_Global_Tabelle_${selectedYear - 1}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Fehler beim Export.');
    } finally {
      setExportingGlobal(false);
    }
  };

  const exportFullPDSForEach = () => {
    if (!pdsList?.length) return;
    setExportingCards(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const w = doc.internal.pageSize.getWidth();
      const margin = 14;
      const maxTextWidth = w - 2 * margin;
      const exportYear = (selectedYear - 1);
      const boxW = 42;
      const boxH = 28;
      const rangeColWidth = 32;
      const goalTextWidth = w - 2 * margin - 22 - rangeColWidth;
      const goalLineHeight = 4.5;
      const rangeX = w - margin - 14 - rangeColWidth;
      const scoreX = w - margin - 14;
      const sigImgW = 45;
      const sigImgH = 22;
      const leftX = margin;
      const rightX = w - margin - sigImgW;

      const drawFirstPageHeader = () => {
        doc.setFillColor(26, 56, 38);
        doc.rect(0, 0, w, 28, 'F');
        doc.setTextColor(255, 199, 44);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('AIW Services', margin, 12);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.text('PDS – Bewertungen pro Restaurant', margin, 20);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(255, 199, 44);
        doc.text(`Erstellt: ${formatDateDDMMGGGG(new Date())}`, margin, 26);
        const yearBoxW = 22;
        const yearBoxH = 10;
        const yearBoxX = w - margin - yearBoxW;
        doc.setFillColor(255, 255, 255);
        doc.rect(yearBoxX, 9, yearBoxW, yearBoxH, 'F');
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(String(exportYear), yearBoxX + yearBoxW / 2, 9 + yearBoxH / 2 + 1.5, { align: 'center' });
      };

      for (let idx = 0; idx < pdsList.length; idx++) {
        const pds = pdsList[idx];
        const name = pds.user?.name ?? 'Mitarbeiter';
        if (idx === 0) {
          drawFirstPageHeader();
        } else {
          doc.addPage();
        }
        let y = idx === 0 ? 36 : 20;

        const supervisorName = pds.user?.supervisor?.name ?? null;
        const goals = Array.isArray(pds.goals) ? pds.goals : [];
        const totalScore = pds.totalScore ?? goals.reduce((acc: number, g: { points?: number }) => acc + (Number(g?.points) || 0), 0);
        const finalGrade = pds.finalGrade ?? '–';
        const employeeComment = pds.employeeComment ?? '';
        const managerComment = pds.managerComment ?? '';
        const empSigImg = typeof pds.employeeSignature === 'string' && pds.employeeSignature.startsWith('data:image') ? pds.employeeSignature : null;
        const mgrSigImg = typeof pds.managerSignature === 'string' && pds.managerSignature.startsWith('data:image') ? pds.managerSignature : null;
        const isSystemArchitect = pds.user?.role === 'SYSTEM_ARCHITECT';

        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.text(name, margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(`${pds.user?.email ?? ''} • ${pds.user?.role ?? ''}`, margin, y);
        y += 5;
        if (supervisorName) {
          doc.setFontSize(8);
          doc.text(`Vorgesetzte/r: ${supervisorName}`, margin, y);
          y += 5;
        }
        y += 5;

        const boxTop = Math.max(28, y - 18);
        doc.setFillColor(26, 56, 38);
        doc.rect(w - margin - boxW, boxTop, boxW, boxH, 'F');
        const boxCenterX = w - margin - boxW / 2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 199, 44);
        doc.text('BEWERTUNG', boxCenterX, boxTop + 8, { align: 'center' });
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.text(String(finalGrade), boxCenterX, boxTop + 18, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(255, 199, 44);
        doc.text(`Punkte: ${totalScore}`, boxCenterX, boxTop + 24, { align: 'center' });
        y = Math.max(y, boxTop + boxH + 6);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        doc.text('ZIELE UND ERGEBNISSE', margin, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text('bodovanje', margin, y);
        y += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        const twoCols = goals.length >= 10;
        const gap = 6;
        const colWidth = twoCols ? (w - 2 * margin - gap) / 2 : w - 2 * margin;
        const goalTextWidth = colWidth - 22 - rangeColWidth;

        const drawOneGoalBlock = (goal: { title?: string; type?: string; result?: unknown; points?: number }, goalIndex: number, x: number, startY: number, blockWidth: number): number => {
          const title = goal.title ?? `Ziel ${goalIndex + 1}`;
          const titleLines = doc.splitTextToSize(title, goalTextWidth);
          const res = goal.type === 'BOOLEAN' ? (goal.result ? 'Ja' : 'Nein') : String(goal.result ?? '');
          const blockTop = startY;
          const titleHeight = titleLines.length * goalLineHeight;
          const resultY = blockTop + titleHeight + goalLineHeight;
          const rowH = titleHeight + goalLineHeight * 2 + 4;
          const localRangeX = x + blockWidth - 14 - rangeColWidth;
          const localScoreX = x + blockWidth - 14;
          doc.setFillColor(249, 250, 251);
          doc.rect(x, blockTop - 2, blockWidth, rowH, 'F');
          doc.setFont('helvetica', 'bold');
          titleLines.forEach((line: string, li: number) => {
            doc.text(line, x + 2, blockTop + 2 + (li + 1) * goalLineHeight);
          });
          doc.setFont('helvetica', 'normal');
          doc.text(`Ergebnis: ${res}`, x + 2, resultY + 2);
          doc.setFontSize(6);
          doc.setTextColor(71, 85, 105);
          const rangeLabel = getGoalPointRangeLabel(goal as Parameters<typeof getGoalPointRangeLabel>[0]);
          const rangeLines = doc.splitTextToSize(rangeLabel, rangeColWidth - 2);
          rangeLines.slice(0, 2).forEach((line: string, li: number) => {
            doc.text(line, localRangeX + 1, blockTop + 2 + goalLineHeight + li * 2.8);
          });
          doc.setFontSize(8);
          doc.setTextColor(26, 56, 38);
          doc.setFont('helvetica', 'bold');
          doc.text(`${goal.points ?? 0} Pkt`, localScoreX, blockTop + 2 + goalLineHeight);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(15, 23, 42);
          return blockTop + rowH + 2;
        };

        if (twoCols) {
          const leftGoals = goals.slice(0, Math.ceil(goals.length / 2));
          const rightGoals = goals.slice(Math.ceil(goals.length / 2));
          const leftXCol = margin;
          const rightXCol = margin + colWidth + gap;
          for (let row = 0; row < leftGoals.length; row++) {
            if (y > 265) { doc.addPage(); y = 20; }
            const leftGoal = leftGoals[row];
            const rightGoal = rightGoals[row];
            const yAfterLeft = drawOneGoalBlock(leftGoal, row, leftXCol, y, colWidth);
            let yAfterRight = y;
            if (rightGoal) {
              yAfterRight = drawOneGoalBlock(rightGoal, leftGoals.length + row, rightXCol, y, colWidth);
            }
            y = Math.max(yAfterLeft, yAfterRight);
          }
        } else {
          goals.forEach((goal: { title?: string; type?: string; result?: unknown; points?: number }, i: number) => {
            if (y > 265) { doc.addPage(); y = 20; }
            y = drawOneGoalBlock(goal, i, margin, y, colWidth);
          });
        }

        y += 5;
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        doc.text('KOMMENTARE', margin, y);
        y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const commentWidth = maxTextWidth - 4;
        const commentLineH = 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Mitarbeiter:', margin, y);
        y += commentLineH;
        doc.setFont('helvetica', 'normal');
        const empText = (employeeComment || '–').trim() || '–';
        doc.splitTextToSize(empText, commentWidth).forEach((line: string) => { doc.text(line, margin, y); y += commentLineH; });
        y += 4;
        doc.setFont('helvetica', 'bold');
        doc.text('Manager:', margin, y);
        y += commentLineH;
        doc.setFont('helvetica', 'normal');
        const mgrText = (managerComment || '–').trim() || '–';
        doc.splitTextToSize(mgrText, commentWidth).forEach((line: string) => { doc.text(line, margin, y); y += commentLineH; });
        y += 10;

        if (y > 260) { doc.addPage(); y = 20; }
        if (!isSystemArchitect) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.text('UNTERSCHRIFTEN', margin, y);
        y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text('Unterschrift Mitarbeiter:', leftX, y);
          if (empSigImg) {
            try { doc.addImage(empSigImg, 'PNG', leftX, y + 2, sigImgW, sigImgH); } catch { doc.text('________________', leftX, y + 8); }
          } else { doc.text('________________', leftX, y + 5); }
          doc.text('Unterschrift Manager:', rightX, y);
          if (mgrSigImg) {
            try { doc.addImage(mgrSigImg, 'PNG', rightX, y + 2, sigImgW, sigImgH); } catch { doc.text('________________', rightX, y + 8); }
          } else { doc.text('________________', rightX, y + 5); }
          y += sigImgH + 12;
        }
        doc.setFontSize(7);
        doc.text('Erstellt: ' + formatDateDDMMGGGG(new Date()), margin, y + 5);
      }

      doc.save(`PDS_Alle_Beurteilungen_${exportYear}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Fehler beim Export.');
    } finally {
      setExportingCards(false);
    }
  };

  const runExportRestaurantTable = () => {
    setOpenExportMenu(null);
    exportByRestaurant();
  };
  const runExportRestaurantFull = () => {
    setOpenExportMenu(null);
    exportFullPDSForEach();
  };
  const runExportGlobalFull = async () => {
    setOpenExportMenu(null);
    await exportGlobal();
  };

  const isExportingAny = exportingRestaurant || exportingGlobal || exportingCards;

  return (
    <>
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a3826] text-white rounded-xl text-xs font-bold hover:bg-[#142e1e] disabled:opacity-60 transition-colors shadow-sm"
        >
          {isGenerating ? <span className="animate-spin">↻</span> : <Play size={14} />}
          ERSTELLEN
        </button>

        <div className="relative" ref={menuRestaurantRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setOpenExportMenu((m) => (m === 'restaurant' ? null : 'restaurant')); }}
            disabled={isExportingAny || pdsList.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a3826] text-white rounded-xl text-xs font-bold hover:bg-[#142e1e] disabled:opacity-60 transition-colors shadow-sm"
            title="Export für aktuelles Restaurant"
          >
            {exportingRestaurant || exportingCards ? <span className="animate-spin">↻</span> : <Store size={14} />}
            EXPORT RESTAURANT
            <ChevronDown size={14} className={openExportMenu === 'restaurant' ? 'rotate-180' : ''} />
          </button>
          {openExportMenu === 'restaurant' && (
            <div className="absolute left-0 top-full mt-1 z-10 min-w-[200px] bg-white border border-slate-200 rounded-xl shadow-lg py-1">
              <button
                type="button"
                onClick={runExportRestaurantTable}
                disabled={exportingRestaurant}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                Als Tabelle
              </button>
              <button
                type="button"
                onClick={runExportRestaurantFull}
                disabled={exportingCards}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                Komplette Beurteilungen
              </button>
            </div>
          )}
        </div>

        <div className="relative" ref={menuGlobalRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setOpenExportMenu((m) => (m === 'global' ? null : 'global')); }}
            disabled={isExportingAny}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a3826] text-white rounded-xl text-xs font-bold hover:bg-[#142e1e] disabled:opacity-60 transition-colors shadow-sm"
            title="Export gesamte Firma"
          >
            {exportingGlobal ? <span className="animate-spin">↻</span> : <Globe size={14} />}
            GLOBAL EXPORT
            <ChevronDown size={14} className={openExportMenu === 'global' ? 'rotate-180' : ''} />
          </button>
          {openExportMenu === 'global' && (
            <div className="absolute left-0 top-full mt-1 z-10 min-w-[200px] bg-white border border-slate-200 rounded-xl shadow-lg py-1">
              <button
                type="button"
                onClick={exportGlobalTable}
                disabled={exportingGlobal}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                Als Tabelle
              </button>
              <button
                type="button"
                onClick={runExportGlobalFull}
                disabled={exportingGlobal}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                Komplette Beurteilungen
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex items-center justify-center w-9 h-9 bg-[#1a3826] text-white rounded-xl hover:bg-[#142e1e] disabled:opacity-60 transition-colors shadow-sm"
          title="Alle Einträge für dieses Jahr löschen"
        >
          {isDeleting ? <span className="animate-spin">↻</span> : <Trash2 size={14} />}
        </button>
      </div>
    </>
  );
}