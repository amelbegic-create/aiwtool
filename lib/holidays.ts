/**
 * Easter (Ostersonntag) – Anonymous Gregorian algorithm.
 * Returns day and month (1-based) for the given year.
 */
export function getEasterForYear(year: number): { d: number; m: number } {
  const f = Math.floor;
  const a = year % 19;
  const b = f(year / 100);
  const c = year % 100;
  const d = f(b / 4);
  const e = b % 4;
  const g = f((8 * b + 13) / 25);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = f(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = f((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  const month = f(n / 31);
  const day = 1 + (n % 31);
  return { d: day, m: month };
}

/** Add days to a { d, m } date in the given year; returns { d, m }. */
export function addDaysToHoliday(
  year: number,
  h: { d: number; m: number },
  days: number
): { d: number; m: number } {
  const date = new Date(year, h.m - 1, h.d);
  date.setDate(date.getDate() + days);
  return { d: date.getDate(), m: date.getMonth() + 1 };
}
