/**
 * Prva godina u rasponu za višegodišnji prenos godišnjeg.
 * Koristi se u modulima godišnjih i u timskom prikazu.
 */
export const VACATION_YEAR_MIN = 2025;

/**
 * Pure helper: računa allowance, carriedOver i total za targetYear
 * uz iterativni prenos iz svih prethodnih godina.
 *
 * - allowancesByYear: dodjela (days) po godini
 * - usedByYear: utrošeno (approved dani) po godini
 * - defaultAllowance: osnovni godišnji (npr. 20) ako nema zapisa za godinu
 * - defaultCarryover: početni prenos (user.vacationCarryover) za prvu godinu
 */
export function computeCarryOverForYear(
  allowancesByYear: Map<number, { days: number }>,
  usedByYear: Map<number, number>,
  defaultAllowance: number,
  defaultCarryover: number,
  targetYear: number
): { allowance: number; carriedOver: number; total: number } {
  const firstYear = VACATION_YEAR_MIN;

  // Ako je targetYear prije ili jednako prvoj godini, nema iterativnog prenosa unatrag.
  if (targetYear <= firstYear) {
    const allowance = allowancesByYear.get(targetYear)?.days ?? defaultAllowance;
    const carriedOver = targetYear === firstYear ? Math.max(0, defaultCarryover) : 0;
    return { allowance, carriedOver, total: allowance + carriedOver };
  }

  // remainingPrev = preostali dani na kraju prethodne iterirane godine
  let remainingPrev = 0;
  for (let y = firstYear; y <= targetYear - 1; y++) {
    const allowanceY = allowancesByYear.get(y)?.days ?? defaultAllowance;
    const carryIntoY = y === firstYear ? defaultCarryover : remainingPrev;
    const totalY = allowanceY + carryIntoY;
    const usedY = usedByYear.get(y) ?? 0;
    remainingPrev = Math.max(0, totalY - usedY);
  }

  const carriedOver = Math.max(0, remainingPrev);
  const allowance = allowancesByYear.get(targetYear)?.days ?? defaultAllowance;
  const total = allowance + carriedOver;
  return { allowance, carriedOver, total };
}
