/** Normalisiert auf YYYY-MM-DD (DB / ISO). */
export function toDayISO(d: string | Date): string {
  if (typeof d === "string") {
    const t = d.trim();
    if (t.length >= 10) return t.slice(0, 10);
    const parsed = new Date(t);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
  }
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Alle Kalendertage von–bis inklusive (YYYY-MM-DD). */
export function eachCalendarDayISO(isoStart: string, isoEnd: string): string[] {
  const a = toDayISO(isoStart);
  const b = toDayISO(isoEnd);
  if (!a || !b || b < a) return [];
  const out: string[] = [];
  const cur = new Date(`${a}T12:00:00`);
  const end = new Date(`${b}T12:00:00`);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export type BlockedDayLike = { date: string; reason?: string | null };

/** Liegt im Zeitraum mindestens ein admin-gesperrter Tag? */
export function rangeHitsBlockedDay(
  isoStart: string,
  isoEnd: string,
  blockedDays: readonly BlockedDayLike[]
): { hit: boolean; blockedDates: string[]; sampleReason: string | null } {
  const blockedMap = new Map<string, string | null>();
  for (const b of blockedDays) {
    const k = toDayISO(b.date);
    if (k) blockedMap.set(k, b.reason ?? null);
  }
  const days = eachCalendarDayISO(isoStart, isoEnd);
  const blockedDates = days.filter((d) => blockedMap.has(d));
  if (blockedDates.length === 0) {
    return { hit: false, blockedDates: [], sampleReason: null };
  }
  const first = blockedDates[0];
  return {
    hit: true,
    blockedDates,
    sampleReason: blockedMap.get(first) ?? null,
  };
}
