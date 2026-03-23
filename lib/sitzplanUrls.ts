/** Maximal Sitzplan-PDFs pro Restaurant (Admin-Upload). */
export const SITZPLAN_MAX_FILES = 5;

export type SitzplanPdfEntry = { url: string; fileName: string };

/** Red iz baze za merge (Prisma `Json` polje). */
export type RestaurantSitzplanFields = {
  sitzplanPdfUrl: string | null;
  sitzplanPdfsData: unknown;
};

/** Pokušaj imena iz Blob-URL puta (Vercel: .../sitzplan-id-timestamp-Originalname.pdf-xyz). */
export function inferPdfFileNameFromUrl(url: string, fallbackIndex?: number): string {
  try {
    const pathPart = url.split("?")[0].split("/").pop() || "";
    const decoded = decodeURIComponent(pathPart);
    const withoutRandom = decoded.replace(/-[a-zA-Z0-9]{4,}\.pdf$/i, ".pdf");
    const pdfMatch = withoutRandom.match(/([^/]+\.pdf)$/i);
    if (pdfMatch?.[1]) return pdfMatch[1];
    if (decoded.toLowerCase().endsWith(".pdf")) return decoded;
  } catch {
    /* ignore */
  }
  return fallbackIndex !== undefined ? `Dokument ${fallbackIndex + 1}` : "Sitzplan.pdf";
}

function parsePdfsFromJson(data: unknown): SitzplanPdfEntry[] {
  if (!Array.isArray(data)) return [];
  const out: SitzplanPdfEntry[] = [];
  data.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const o = item as Record<string, unknown>;
    const url = typeof o.url === "string" ? o.url.trim() : "";
    if (!url) return;
    const fn = typeof o.fileName === "string" ? o.fileName.trim() : "";
    out.push({
      url,
      fileName: fn || inferPdfFileNameFromUrl(url, i),
    });
  });
  return out;
}

/**
 * Legacy jedan URL + JSON lista `{ url, fileName }`.
 * (Stari kod / keš: `mergeSitzplanUrls` vraća samo URL-ove.)
 */
export function mergeSitzplanPdfs(r: RestaurantSitzplanFields): SitzplanPdfEntry[] {
  const items = parsePdfsFromJson(r.sitzplanPdfsData);

  if (r.sitzplanPdfUrl && !items.some((x) => x.url === r.sitzplanPdfUrl)) {
    return [
      {
        url: r.sitzplanPdfUrl,
        fileName: inferPdfFileNameFromUrl(r.sitzplanPdfUrl),
      },
      ...items,
    ];
  }

  return items;
}

/** @deprecated Koristi `mergeSitzplanPdfs`; ostavljeno zbog starog bundla / importa. */
export function mergeSitzplanUrls(r: RestaurantSitzplanFields): string[] {
  return mergeSitzplanPdfs(r).map((e) => e.url);
}
