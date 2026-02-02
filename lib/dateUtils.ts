/**
 * Jedinstveni format datuma u projektu: DD.MM.GGGG (npr. 01.02.2026).
 * Koristiti za sve prikaze datuma u aplikaciji.
 */
export function formatDateDDMMGGGG(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("bs-BA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}
