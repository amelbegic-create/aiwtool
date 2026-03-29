/**
 * Kurzformen für PDF-Köpfe / Urlaubsplan (österreichisches Deutsch).
 * Index 0 = Jänner … 11 = Dezember (Mär, Mai, Dez statt Mar/Maj/Dec).
 */
export const MONTH_ABBREVS_DE_AT: readonly string[] = [
  "Jän",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

/**
 * European/Austrian date format: DD.MM.YYYY (e.g. 15.02.2026).
 * Used for all date displays (incl. de-AT locale).
 */
export function formatDateDDMMGGGG(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/** Datum und Uhrzeit (Admin-Statistik, z. B. letzter Aufruf). */
export function formatDateTimeDeAt(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
