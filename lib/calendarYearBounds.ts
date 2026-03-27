/** „Mein Kalender“: navigacija strelicama i URL parametar `year`. */
export const CALENDAR_YEAR_MAX = 2035;

export function getCalendarYearBounds(now: Date = new Date()) {
  const y = now.getFullYear();
  const minCandidate = y - 1;
  const max = CALENDAR_YEAR_MAX;
  const min = minCandidate > max ? max : minCandidate;
  return { min, max } as const;
}
