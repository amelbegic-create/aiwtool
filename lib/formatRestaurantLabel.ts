/**
 * Jedinstveni prikaz restorana u selectu i karticama: ne ponavlja isti kod i naziv (npr. "26 · 26" → "26").
 */
export function formatRestaurantLabel(r: { code: string; name: string | null | undefined }): string {
  const code = (r.code ?? "").trim();
  const name = (r.name ?? "").trim();
  if (!code && !name) return "";
  if (!name || name === code) return code || name;
  return `${code} · ${name}`;
}
