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
  Verschiedenes: [26, 56, 38],
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
  ]);

  autoTable(doc, {
    startY: startY + 12,
    head: [["Gerät", "Marke", "Modell", "Seriennummer", "Baujahr"]],
    body: tableData,
    margin: { left: 15, right: 15 },
    styles: {
      fontSize: 9,
      cellPadding: 3.5,
      textColor: DARK_TXT,
      lineColor: [220, 225, 220],
      lineWidth: 0.2,
      overflow: "linebreak",
      cellWidth: "wrap",
    },
    headStyles: {
      fillColor: LIGHT_GREEN,
      textColor: GREEN,
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [248, 252, 249] },
    tableWidth: "auto",
    columnStyles: {
      4: { halign: "center" },
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

  const restLabel = (restaurantName || "").trim() || "—";
  drawPageHeader(doc, restLabel, "Vollständige Geräteliste");

  // Summary stats box
  const totalItems = sections.reduce((s, sec) => s + sec.items.length, 0);
  const withSerial = sections.reduce(
    (s, sec) => s + sec.items.filter((i) => i.seriennummer).length,
    0
  );

  doc.setFillColor(...LIGHT_GREEN);
  doc.roundedRect(15, 40, pw - 30, 18, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GREEN);
  doc.text(`Restaurant: ${restLabel}`, 22, 48);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(`Gesamt Geräte: ${totalItems}`, 22, 55);
  doc.text(`Mit Seriennummer: ${withSerial}/${totalItems}`, 90, 55);
  doc.text(
    `Exportiert: ${new Date().toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" })}`,
    pw - 22,
    55,
    { align: "right" }
  );

  // Cover: section overview table (so page 1 is never empty)
  const coverRows = sections.map((s) => [
    s.name,
    String(s.items.length),
    String(s.items.filter((i) => i.seriennummer).length),
  ]);

  autoTable(doc, {
    startY: 66,
    head: [["Sektion", "Geräte", "Mit Seriennummer"]],
    body: coverRows,
    margin: { left: 15, right: 15 },
    styles: {
      fontSize: 10,
      cellPadding: 4,
      textColor: DARK_TXT,
      lineColor: [220, 225, 220],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: GREEN,
      textColor: WHITE,
      fontStyle: "bold",
      halign: "left",
    },
    alternateRowStyles: { fillColor: [248, 252, 249] },
    columnStyles: {
      1: { halign: "center", cellWidth: 28 },
      2: { halign: "center", cellWidth: 42 },
    },
  });

  // Each section starts on a new page for clean layout / no awkward breaks
  sections.forEach((section, idx) => {
    doc.addPage();
    drawPageHeader(doc, restLabel, `Sektion: ${section.name}`);
    drawSectionTable(doc, section, 42);
    // If a section spans multiple pages, re-draw header on the following pages
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const last = (doc as any).lastAutoTable;
    if (last && typeof last.pageNumber === "number") {
      // no-op: autoTable handles splitting; header will exist on the first page of the section
    }
    // remove: y tracking, we rely on autoTable paging within a section
    void idx;
    void ph;
  });

  drawFooter(doc);
  return URL.createObjectURL(doc.output("blob"));
}
