/**
 * Europski format datuma: DD.MM.GGGG (npr. 01.02.2026).
 * Koristiti za sve prikaze datuma u aplikaciji.
 */
export function formatDateDDMMGGGG(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}
