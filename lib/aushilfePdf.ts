import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { HelpRequestRow } from "@/app/actions/aushilfeActions";

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
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
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const L = 15;
  const R = 15;
  const contentWidth = pageWidth - L - R;

  const greenDark = [26, 56, 38] as [number, number, number];
  const yellow = [255, 199, 44] as [number, number, number];

  // ── Header band ──────────────────────────────────────────────────────────────
  doc.setFillColor(...greenDark);
  doc.rect(0, 0, pageWidth, 35, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text("AUSHILFE ANFRAGE", L, 15);

  doc.setFontSize(11);
  doc.setTextColor(...yellow);
  doc.text("Personalunterstützung zwischen Restaurants", L, 25);

  let yPos = 45;

  // ── Request info card ────────────────────────────────────────────────────────
  doc.setDrawColor(...greenDark);
  doc.setFillColor(...yellow);
  doc.roundedRect(L, yPos, contentWidth, 28, 3, 3, "FD");

  const restNr = restCode(request.requestingRestaurant);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(...greenDark);
  doc.text(`#${restNr}`, L + 5, yPos + 20);

  const requester = personName(request.createdByUser);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Anfrage von:", L + 40, yPos + 8);
  doc.setFont("helvetica", "normal");
  doc.text(requester, L + 40, yPos + 14);

  doc.setFont("helvetica", "bold");
  doc.text("Datum:", L + 40, yPos + 22);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(request.date), L + 60, yPos + 22);

  yPos += 35;

  // ── Notes ────────────────────────────────────────────────────────────────────
  if (request.notes?.trim()) {
    yPos += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text("Anmerkungen:", L, yPos);
    yPos += 6;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const notesLines = doc.splitTextToSize(request.notes.trim(), contentWidth - 10);
    doc.text(notesLines, L + 5, yPos);
    yPos += notesLines.length * 4 + 4;
  }

  yPos += 4;

  // ── Positions ────────────────────────────────────────────────────────────────
  const hasPositions = request.positions.length > 0;

  if (hasPositions) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...greenDark);
    doc.text("Benötigte Positionen", L, yPos);
    yPos += 6;

    for (const pos of request.positions) {
      if (yPos > pageHeight - 50) { doc.addPage(); yPos = 20; }

      // Position header
      doc.setFillColor(240, 247, 240);
      doc.setDrawColor(...greenDark);
      doc.roundedRect(L, yPos, contentWidth, 14, 2, 2, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...greenDark);
      doc.text(pos.sectorLabel, L + 4, yPos + 5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(pos.shiftTimeText, L + 4, yPos + 11);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...greenDark);
      const spotsLabel = `${pos.slots.length}/${pos.neededSpots} besetzt`;
      const spotsWidth = doc.getTextWidth(spotsLabel);
      doc.text(spotsLabel, L + contentWidth - spotsWidth - 2, yPos + 8);

      yPos += 16;

      // Slots table for this position
      const tableData: string[][] = Array.from({ length: pos.neededSpots }, (_, i) => {
        const slot = pos.slots[i];
        if (slot) {
          const manager = personName(slot.providerManager);
          const rc = restCode(slot.providingRestaurant);
          return [`${i + 1}`, slot.workerName, `${manager} · #${rc}`, "✔"];
        }
        return [`${i + 1}`, "–", "–", "✗"];
      });

      autoTable(doc, {
        startY: yPos,
        head: [["Platz", "Mitarbeiter", "Geschickt von", "Status"]],
        body: tableData,
        styles: { fontSize: 9, cellPadding: 3, valign: "middle", lineColor: [210, 210, 210], lineWidth: 0.2 },
        headStyles: { fillColor: greenDark, textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
        columnStyles: {
          0: { halign: "center", cellWidth: 18 },
          1: { cellWidth: 48 },
          2: { cellWidth: "auto" },
          3: { halign: "center", cellWidth: 18 },
        },
        alternateRowStyles: { fillColor: [248, 252, 248] },
        margin: { left: L, right: R },
      });

      yPos = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPos) + 8;
    }
  } else {
    // Legacy: single slot table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...greenDark);
    doc.text("Mitarbeiter", L, yPos);
    yPos += 6;

    const tableData: string[][] = request.slots.map((slot, i) => [
      `${i + 1}`,
      slot.workerName,
      `${personName(slot.providerManager)} · #${restCode(slot.providingRestaurant)}`,
      "✔",
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Platz", "Mitarbeiter", "Geschickt von", "Status"]],
      body: tableData,
      styles: { fontSize: 10, cellPadding: 4, valign: "middle", lineColor: [200, 200, 200], lineWidth: 0.3 },
      headStyles: { fillColor: greenDark, textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
      columnStyles: {
        0: { halign: "center", cellWidth: 20 },
        1: { cellWidth: 50 },
        2: { cellWidth: "auto" },
        3: { halign: "center", cellWidth: 20 },
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: L, right: R },
    });
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Exportiert am ${new Date().toLocaleString("de-AT")}`, L, pageHeight - 10);

  doc.save(`Aushilfe_Restaurant_${restNr}_${request.date}.pdf`);
}

export function openAushilfePDFPopup(request: HelpRequestRow) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const L = 15;
  const R = 15;
  const contentWidth = pageWidth - L - R;

  const greenDark = [26, 56, 38] as [number, number, number];
  const yellow = [255, 199, 44] as [number, number, number];

  // ── Header band ──────────────────────────────────────────────────────────────
  doc.setFillColor(...greenDark);
  doc.rect(0, 0, pageWidth, 35, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text("AUSHILFE ANFRAGE", L, 15);

  doc.setFontSize(11);
  doc.setTextColor(...yellow);
  doc.text("Personalunterstützung zwischen Restaurants", L, 25);

  let yPos = 45;

  // ── Request info card ────────────────────────────────────────────────────────
  doc.setDrawColor(...greenDark);
  doc.setFillColor(...yellow);
  doc.roundedRect(L, yPos, contentWidth, 28, 3, 3, "FD");

  const restNr = restCode(request.requestingRestaurant);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(...greenDark);
  doc.text(`#${restNr}`, L + 5, yPos + 20);

  const requester = personName(request.createdByUser);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Anfrage von:", L + 40, yPos + 8);
  doc.setFont("helvetica", "normal");
  doc.text(requester, L + 40, yPos + 14);

  doc.setFont("helvetica", "bold");
  doc.text("Datum:", L + 40, yPos + 22);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(request.date), L + 60, yPos + 22);

  yPos += 35;

  // ── Notes ────────────────────────────────────────────────────────────────────
  if (request.notes?.trim()) {
    yPos += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text("Anmerkungen:", L, yPos);
    yPos += 6;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const notesLines = doc.splitTextToSize(request.notes.trim(), contentWidth - 10);
    doc.text(notesLines, L + 5, yPos);
    yPos += notesLines.length * 4 + 4;
  }

  yPos += 4;

  // ── Positions ────────────────────────────────────────────────────────────────
  const hasPositions = request.positions.length > 0;

  if (hasPositions) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...greenDark);
    doc.text("Benötigte Positionen", L, yPos);
    yPos += 6;

    for (const pos of request.positions) {
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFillColor(240, 247, 240);
      doc.setDrawColor(...greenDark);
      doc.roundedRect(L, yPos, contentWidth, 14, 2, 2, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...greenDark);
      doc.text(pos.sectorLabel, L + 4, yPos + 5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(pos.shiftTimeText, L + 4, yPos + 11);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...greenDark);
      const spotsLabel = `${pos.slots.length}/${pos.neededSpots} besetzt`;
      const spotsWidth = doc.getTextWidth(spotsLabel);
      doc.text(spotsLabel, L + contentWidth - spotsWidth - 2, yPos + 8);

      yPos += 16;

      const tableData: string[][] = Array.from({ length: pos.neededSpots }, (_, i) => {
        const slot = pos.slots[i];
        if (slot) {
          const manager = personName(slot.providerManager);
          const rc = restCode(slot.providingRestaurant);
          return [`${i + 1}`, slot.workerName, `${manager} · #${rc}`, "✔"];
        }
        return [`${i + 1}`, "–", "–", "✗"];
      });

      autoTable(doc, {
        startY: yPos,
        head: [["Platz", "Mitarbeiter", "Geschickt von", "Status"]],
        body: tableData,
        styles: { fontSize: 9, cellPadding: 3, valign: "middle", lineColor: [210, 210, 210], lineWidth: 0.2 },
        headStyles: { fillColor: greenDark, textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
        columnStyles: {
          0: { halign: "center", cellWidth: 18 },
          1: { cellWidth: 48 },
          2: { cellWidth: "auto" },
          3: { halign: "center", cellWidth: 18 },
        },
        alternateRowStyles: { fillColor: [248, 252, 248] },
        margin: { left: L, right: R },
      });

      yPos = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPos) + 8;
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...greenDark);
    doc.text("Mitarbeiter", L, yPos);
    yPos += 6;

    const tableData: string[][] = request.slots.map((slot, i) => [
      `${i + 1}`,
      slot.workerName,
      `${personName(slot.providerManager)} · #${restCode(slot.providingRestaurant)}`,
      "✔",
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Platz", "Mitarbeiter", "Geschickt von", "Status"]],
      body: tableData,
      styles: { fontSize: 10, cellPadding: 4, valign: "middle", lineColor: [200, 200, 200], lineWidth: 0.3 },
      headStyles: { fillColor: greenDark, textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
      columnStyles: {
        0: { halign: "center", cellWidth: 20 },
        1: { cellWidth: 50 },
        2: { cellWidth: "auto" },
        3: { halign: "center", cellWidth: 20 },
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: L, right: R },
    });
  }

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Exportiert am ${new Date().toLocaleString("de-AT")}`, L, pageHeight - 10);

  const filename = `Aushilfe_Restaurant_${restNr}_${request.date}.pdf`;

  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const w = window.open("", "_blank", "popup,width=980,height=1100");
  if (!w) {
    URL.revokeObjectURL(url);
    doc.save(filename);
    return;
  }

  w.document.title = filename;
  w.document.body.style.margin = "0";
  w.document.body.style.height = "100vh";
  w.document.body.innerHTML = `
    <iframe
      src="${url}"
      style="border:0;width:100%;height:100vh"
      title="${filename.replace(/\"/g, "")}"
    ></iframe>
  `;

  const revoke = () => {
    try { URL.revokeObjectURL(url); } catch { /* noop */ }
  };
  w.addEventListener("beforeunload", revoke, { once: true });
}
