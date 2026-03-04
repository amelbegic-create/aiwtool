import type { jsPDF } from "jspdf";

/**
 * Opens the generated PDF in a **new browser tab** using a blob URL,
 * so that the current page (godišnji modul, admin pregled itd.) ostaje otvorena.
 *
 * Napomena: Ime funkcije ostaje isto zbog postojećih importa,
 * ali ponašanje je \"open in new tab\".
 */
export function openPdfInSameTab(doc: jsPDF): void {
  const url = pdfToBlobUrl(doc);

  // Otvori u novom tabu i zadrži trenutnu stranicu
  window.open(url, "_blank", "noopener,noreferrer");

  // Sigurnosno očisti blob URL nakon kratkog vremena
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}

/**
 * Pretvara jsPDF dokument u Blob URL.
 * Ako je doc neočekivano undefined/null, kreira se prazan PDF
 * kako bi se izbjegao runtime crash.
 */
export function pdfToBlobUrl(doc?: jsPDF | null): string {
  const instance = doc ?? (new (require("jspdf").jsPDF)() as jsPDF);
  const blob = instance.output("blob");
  return URL.createObjectURL(blob);
}
