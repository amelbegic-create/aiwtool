import type { jsPDF } from "jspdf";

/** Zelena (#1a3826) i zlatna, usklađeno s Urlaub PDF-ovima. */
export const MCD_GREEN: [number, number, number] = [26, 56, 38];
export const MCD_GOLD: [number, number, number] = [255, 199, 44];

export type McdPdfHeaderOptions = {
  /** Sivi podnaslov ispod brenda – ako nije postavljen, ne crta se. */
  documentTitle?: string;
  /** Dodatni red (bijeli), npr. restoran. */
  detailLine?: string;
  /** Tekst u bijelom boxu desno (npr. samo godina). */
  rightBadgeText?: string;
  /** Visina zelenog traka u mm. */
  headerHeight?: number;
};

/**
 * Zelena traka: glavni brend „aiw services“ (zlatno), opcionalno detalji, badge desno.
 * Bez obaveznog donjeg sivog naslova – dodaje se samo ako je `documentTitle` postavljen.
 */
export function drawMcdPdfHeader(doc: jsPDF, opts: McdPdfHeaderOptions): number {
  const pageW = doc.internal.pageSize.getWidth();
  const hasSubtitle = Boolean(opts.documentTitle?.trim());
  const hasDetail = Boolean(opts.detailLine?.trim());
  const headerHeight =
    opts.headerHeight ?? (hasSubtitle || hasDetail ? 34 : 26);

  doc.setFillColor(...MCD_GREEN);
  doc.rect(0, 0, pageW, headerHeight, "F");

  let y = 13;
  doc.setTextColor(...MCD_GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("aiw services", 14, y);
  y += hasDetail || hasSubtitle ? 8 : 0;

  if (opts.detailLine?.trim()) {
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(opts.detailLine.trim(), 14, y);
    y += 6;
  }

  if (opts.documentTitle?.trim()) {
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    doc.text(opts.documentTitle.trim(), 14, y);
    y += 5;
  }

  const badge =
    opts.rightBadgeText ?? String(new Date().getFullYear());
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  const textW = doc.getTextWidth(badge);
  const padding = 6;
  const boxW = textW + padding * 2;
  const boxH = 15;
  const boxX = pageW - 14 - boxW;
  const boxY = (headerHeight - boxH) / 2;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, "F");
  doc.setTextColor(...MCD_GREEN);
  doc.text(badge, boxX + boxW / 2, boxY + boxH / 2 + 2, { align: "center" });

  // Gold accent stripe at the bottom of the header band
  doc.setFillColor(...MCD_GOLD);
  doc.rect(0, headerHeight, pageW, 1.5, "F");

  doc.setTextColor(15, 23, 42);
  return headerHeight + 7;
}

/** Compact header on continuation pages, with gold accent stripe underneath. */
export function drawMcdPdfHeaderContinuation(doc: jsPDF, pageLabel: string): number {
  const pageW = doc.internal.pageSize.getWidth();
  const h = 10;
  doc.setFillColor(...MCD_GREEN);
  doc.rect(0, 0, pageW, h, "F");
  // gold accent bar
  doc.setFillColor(...MCD_GOLD);
  doc.rect(0, h, pageW, 1, "F");
  doc.setTextColor(...MCD_GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("aiw services", 14, 6.8);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text((pageLabel.trim() || "Training").toUpperCase(), pageW - 14, 6.8, { align: "right" });
  doc.setTextColor(15, 23, 42);
  return h + 6;
}
