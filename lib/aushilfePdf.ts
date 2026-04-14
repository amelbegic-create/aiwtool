import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { HelpRequestRow } from "@/app/actions/aushilfeActions";

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString("de-AT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function restCode(r: { code: string; name: string | null } | undefined): string {
  if (!r) return "–";
  return (r.code ?? "").trim() || (r.name ?? "").trim() || "–";
}

function personName(u: { name: string | null; email: string | null } | null | undefined): string {
  if (!u) return "–";
  return u.name?.trim() || u.email?.trim() || "–";
}

export function generateAushilfePDF(request: HelpRequestRow) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 15;
  const rightMargin = 15;
  const contentWidth = pageWidth - leftMargin - rightMargin;

  const greenDark = [26, 56, 38] as [number, number, number];
  const yellow = [255, 199, 44] as [number, number, number];

  let yPos = 20;

  doc.setFillColor(...greenDark);
  doc.rect(0, 0, pageWidth, 35, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text("AUSHILFE ANFRAGE", leftMargin, 15);

  doc.setFontSize(11);
  doc.setTextColor(...yellow);
  doc.text("Personalunterstützung zwischen Restaurants", leftMargin, 25);

  yPos = 45;

  doc.setDrawColor(...greenDark);
  doc.setFillColor(...yellow);
  doc.roundedRect(leftMargin, yPos, contentWidth, 28, 3, 3, "FD");

  const restNr = restCode(request.requestingRestaurant);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(...greenDark);
  doc.text(`#${restNr}`, leftMargin + 5, yPos + 20);

  const requester = personName(request.createdByUser);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Anfrage von:", leftMargin + 35, yPos + 8);
  doc.setFont("helvetica", "normal");
  doc.text(requester, leftMargin + 35, yPos + 14);

  doc.setFont("helvetica", "bold");
  doc.text("Datum:", leftMargin + 35, yPos + 20);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(request.date), leftMargin + 55, yPos + 20);

  doc.setFont("helvetica", "bold");
  doc.text("Schicht:", leftMargin + 35, yPos + 26);
  doc.setFont("helvetica", "normal");
  doc.text(request.shiftTime, leftMargin + 55, yPos + 26);

  yPos += 35;

  if (request.notes?.trim()) {
    yPos += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text("Anmerkungen:", leftMargin, yPos);
    yPos += 6;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const notesLines = doc.splitTextToSize(request.notes.trim(), contentWidth - 10);
    doc.text(notesLines, leftMargin + 5, yPos);
    yPos += notesLines.length * 4 + 3;
  }

  yPos += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...greenDark);
  doc.text(`Benötigte Personen: ${request.neededSpots}`, leftMargin, yPos);
  doc.setFontSize(10);
  doc.text(`Besetzt: ${request.slots.length}/${request.neededSpots}`, pageWidth - rightMargin - 35, yPos);

  yPos += 8;

  const tableData: string[][] = [];
  for (let i = 0; i < request.neededSpots; i++) {
    const slot = request.slots[i];
    if (slot) {
      const manager = personName(slot.providerManager);
      const restC = restCode(slot.providingRestaurant);
      tableData.push([
        `${i + 1}`,
        slot.workerName,
        `${manager}\nRestaurant #${restC}`,
        "✔",
      ]);
    } else {
      tableData.push([`${i + 1}`, "–", "–", "✗"]);
    }
  }

  autoTable(doc, {
    startY: yPos,
    head: [["Platz", "Mitarbeiter", "Geschickt von", "Status"]],
    body: tableData,
    styles: {
      fontSize: 10,
      cellPadding: 4,
      halign: "left",
      valign: "middle",
      lineColor: [200, 200, 200],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: greenDark,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 20 },
      1: { cellWidth: 50 },
      2: { cellWidth: "auto" },
      3: { halign: "center", cellWidth: 20 },
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    didDrawCell: (data: { column: { index: number }; cell: { raw: unknown } }) => {
      if (data.column.index === 3 && data.cell.raw === "✔") {
        doc.setTextColor(0, 150, 0);
      }
      if (data.column.index === 3 && data.cell.raw === "✗") {
        doc.setTextColor(200, 0, 0);
      }
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPos;
  yPos = finalY + 10;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  const timestamp = new Date().toLocaleString("de-AT");
  doc.text(`Exportiert am ${timestamp}`, leftMargin, pageHeight - 10);

  const filename = `Aushilfe_Restaurant_${restNr}_${request.date}.pdf`;
  doc.save(filename);
}
