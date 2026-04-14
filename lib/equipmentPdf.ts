import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { InventarSectionDetail } from "@/app/actions/inventarActions";

const GREEN = [26, 56, 38] as [number, number, number];
const YELLOW = [255, 199, 44] as [number, number, number];
const LIGHT_GREEN = [237, 245, 240] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];
const DARK_TXT = [30, 30, 30] as [number, number, number];
const MUTED = [120, 120, 120] as [number, number, number];

const SECTION_ACCENT: Record<string, [number, number, number]> = {
  Produktion: [26, 56, 38],
  Service: [26, 74, 46],
  Lobby: [15, 46, 28],
  McCafe: [74, 26, 0],
};

function drawPageHeader(doc: jsPDF, restaurantName: string, title: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pw, 32, "F");

  // Yellow accent strip
  doc.setFillColor(...YELLOW);
  doc.rect(0, 32, pw, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...WHITE);
  doc.text("EQUIPMENT", 15, 14);

  doc.setFontSize(9);
  doc.setTextColor(...YELLOW);
  doc.text(title, 15, 23);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 220, 200);
  doc.text(`Restaurant ${restaurantName}`, pw - 15, 14, { align: "right" });
  doc.text(
    new Date().toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }),
    pw - 15,
    23,
    { align: "right" }
  );
}

function drawSectionTable(
  doc: jsPDF,
  section: InventarSectionDetail,
  startY: number
): number {
  const pw = doc.internal.pageSize.getWidth();
  const accent = SECTION_ACCENT[section.name] ?? GREEN;

  // Section banner
  doc.setFillColor(...accent);
  doc.roundedRect(15, startY, pw - 30, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text(section.name.toUpperCase(), 20, startY + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...YELLOW);
  doc.text(`${section.items.length} Geräte`, pw - 20, startY + 7, { align: "right" });

  const tableData = section.items.map((item) => [
    item.geraet,
    item.marke ?? "—",
    item.modell ?? "—",
    item.seriennummer ?? "—",
    item.anschaffungsjahr ? String(item.anschaffungsjahr) : "—",
    item.garantieUrl ? "✓" : "—",
  ]);

  autoTable(doc, {
    startY: startY + 12,
    head: [["Gerät", "Marke", "Modell", "Seriennummer", "Baujahr", "Garantie"]],
    body: tableData,
    margin: { left: 15, right: 15 },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: DARK_TXT,
      lineColor: [220, 225, 220],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: LIGHT_GREEN,
      textColor: GREEN,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 252, 249] },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 28 },
      2: { cellWidth: 30 },
      3: { cellWidth: 38 },
      4: { cellWidth: 18, halign: "center" },
      5: { cellWidth: 14, halign: "center" },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable.finalY + 6;
}

function drawFooter(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const totalPages = doc.internal.pages.length - 1;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...GREEN);
    doc.rect(0, ph - 10, pw, 10, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(200, 220, 200);
    doc.text("Equipment Inventar · McDonald's AIW", 15, ph - 3.5);
    doc.setTextColor(...YELLOW);
    doc.text(`Seite ${i} / ${totalPages}`, pw - 15, ph - 3.5, { align: "right" });
  }
}

/** Generates PDF for a single section. Returns a Blob URL. */
export function generateSectionPDF(
  section: InventarSectionDetail,
  restaurantName: string
): string {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  drawPageHeader(doc, restaurantName, `Sektion: ${section.name}`);
  drawSectionTable(doc, section, 42);
  drawFooter(doc);
  return URL.createObjectURL(doc.output("blob"));
}

/** Generates a full PDF with all sections. Returns a Blob URL. */
export function generateFullEquipmentPDF(
  sections: InventarSectionDetail[],
  restaurantName: string
): string {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  drawPageHeader(doc, restaurantName, "Vollständige Geräteliste");

  // Summary stats box
  const totalItems = sections.reduce((s, sec) => s + sec.items.length, 0);
  const withSerial = sections.reduce(
    (s, sec) => s + sec.items.filter((i) => i.seriennummer).length,
    0
  );
  const withGarantie = sections.reduce(
    (s, sec) => s + sec.items.filter((i) => i.garantieUrl).length,
    0
  );

  doc.setFillColor(...LIGHT_GREEN);
  doc.roundedRect(15, 40, pw - 30, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GREEN);
  doc.text(`Gesamt: ${totalItems} Geräte`, 22, 48);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(`Seriennummer: ${withSerial}/${totalItems}`, 90, 48);
  doc.text(`Garantiescheine: ${withGarantie}/${totalItems}`, 180, 48);

  let y = 60;

  sections.forEach((section, idx) => {
    if (y > ph - 40 && idx > 0) {
      doc.addPage();
      drawPageHeader(doc, restaurantName, "Vollständige Geräteliste (Fortsetzung)");
      y = 42;
    }
    y = drawSectionTable(doc, section, y);
  });

  drawFooter(doc);
  return URL.createObjectURL(doc.output("blob"));
}
