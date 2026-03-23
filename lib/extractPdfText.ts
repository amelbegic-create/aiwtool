/** Max. duljina teksta za spremanje u DB (performanse / veličina reda). */
export const VORLAGEN_EXTRACTED_TEXT_MAX = 400_000;

/**
 * Izvlači čisti tekst iz PDF buffera (samo „pravi“ tekstualni PDF, ne skenirani).
 * Koristi pdf-parse v2 (`PDFParse`). Vraća null ako nema teksta ili ako parsiranje padne.
 */
export async function extractPdfPlainText(buffer: Buffer): Promise<string | null> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    const raw = (result.text ?? "").replace(/\s+/g, " ").trim();
    if (!raw) return null;
    return raw.length > VORLAGEN_EXTRACTED_TEXT_MAX
      ? raw.slice(0, VORLAGEN_EXTRACTED_TEXT_MAX)
      : raw;
  } catch (e) {
    console.warn("[vorlagen] PDF text extraction failed:", e);
    return null;
  }
}

/** Naslov iz imena datoteke (bez ekstenzije). */
export function deriveTitleFromFileName(fileName: string): string {
  const base = fileName.replace(/^.*[/\\]/, "").trim();
  const noExt = base.replace(/\.[^.]+$/i, "").trim();
  const spaced = noExt.replace(/[_]+/g, " ").trim();
  return spaced || "Dokument";
}
