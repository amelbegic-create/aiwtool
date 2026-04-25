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
  renderCompactAushilfePdf(doc, request);
  const restNr = restCode(request.requestingRestaurant);
  doc.save(`Aushilfe_Restaurant_${restNr}_${request.date}.pdf`);
}

export function openAushilfePDFPopup(request: HelpRequestRow) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  renderCompactAushilfePdf(doc, request);

  const restNr = restCode(request.requestingRestaurant);
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

function renderCompactAushilfePdf(doc: jsPDF, request: HelpRequestRow) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const L = 12;
  const R = 12;
  const contentWidth = pageWidth - L - R;

  const greenDark = [26, 56, 38] as [number, number, number];
  const yellow = [255, 199, 44] as [number, number, number];
  const headerH = 26;

  // Header band (keep style, more compact)
  doc.setFillColor(...greenDark);
  doc.rect(0, 0, pageWidth, headerH, "F");
  // accent line
  doc.setFillColor(...yellow);
  doc.rect(0, headerH - 1.2, pageWidth, 1.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("AUSHILFE ANFRAGE", L, 15);
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text("Personalunterstützung zwischen Restaurants", L, 21);

  const restNr = restCode(request.requestingRestaurant);
  const requester = personName(request.createdByUser);

  let yPos = headerH + 6;

  // Info card (branded, compact)
  doc.setDrawColor(26, 56, 38);
  doc.setFillColor(255, 199, 44);
  doc.roundedRect(L, yPos, contentWidth, 18, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...greenDark);
  doc.text(`#${restNr}`, L + 4, yPos + 12.5);

  doc.setFontSize(9.5);
  doc.setTextColor(26, 56, 38);
  doc.text("Datum:", L + 38, yPos + 7);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(request.date), L + 52, yPos + 7);

  doc.setFont("helvetica", "bold");
  doc.text("Erstellt von:", L + 38, yPos + 13);
  doc.setFont("helvetica", "normal");
  doc.text(requester, L + 63, yPos + 13);

  yPos += 22;

  // Notes box
  if (request.notes?.trim()) {
    doc.setDrawColor(210, 210, 210);
    doc.setFillColor(248, 250, 248);
    const noteH = 10;
    doc.roundedRect(L, yPos, contentWidth, noteH, 2.5, 2.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(26, 56, 38);
    doc.text("Grund:", L + 3, yPos + 6.4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70, 70, 70);
    const notesLines = doc.splitTextToSize(request.notes.trim(), contentWidth - 18);
    doc.text(notesLines.slice(0, 2), L + 18, yPos + 6.4);
    yPos += noteH + 4;
  }

  const positions = request.positions.length > 0 ? request.positions : [
    {
      id: "legacy",
      sectorKey: request.sectorKey ?? "",
      sectorLabel: request.sectorLabel ?? "–",
      shiftTimeText: request.shiftTime ?? "–",
      neededSpots: request.neededSpots ?? request.slots.length,
      sortOrder: 0,
      slots: request.slots,
    },
  ];

  // Position summary (few rows)
  const posSummaryBody = positions.map((p) => [
    p.sectorLabel,
    p.shiftTimeText,
    String(p.neededSpots),
    String(p.slots.length),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["Sektor/Bereich", "Uhrzeit", "Benötigt", "Besetzt"]],
    body: posSummaryBody,
    styles: { fontSize: 7.6, cellPadding: 1.3, valign: "middle", lineColor: [210, 210, 210], lineWidth: 0.15 },
    headStyles: { fillColor: greenDark, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 48 },
      1: { cellWidth: 30 },
      2: { halign: "center", cellWidth: 18 },
      3: { halign: "center", cellWidth: 18 },
    },
    margin: { left: L, right: R },
  });

  yPos = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPos) + 2.5;

  // Workers table (one row per filled person) – sized to fit 1 page for ~20 rows
  const workerRows: string[][] = [];
  for (const p of positions) {
    for (const s of p.slots) {
      const mgr = personName(s.providerManager);
      const rc = restCode(s.providingRestaurant);
      workerRows.push([p.sectorLabel, p.shiftTimeText, s.workerName, mgr, `#${rc}`]);
    }
  }
  if (workerRows.length === 0) {
    workerRows.push(["–", "–", "–", "–", "–"]);
  }

  autoTable(doc, {
    startY: yPos,
    head: [["Sektor", "Zeit", "Mitarbeiter", "Von", "Rest."]],
    body: workerRows,
    styles: { fontSize: 7.1, cellPadding: 1.15, valign: "middle", lineColor: [220, 220, 220], lineWidth: 0.12 },
    headStyles: { fillColor: yellow, textColor: greenDark, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [252, 253, 252] },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 20 },
      2: { cellWidth: 42 },
      3: { cellWidth: "auto" },
      4: { halign: "center", cellWidth: 16 },
    },
    margin: { left: L, right: R },
    tableWidth: contentWidth,
  });

  // Footer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text(`Exportiert am ${new Date().toLocaleString("de-AT")}`, L, pageHeight - 6);
}
