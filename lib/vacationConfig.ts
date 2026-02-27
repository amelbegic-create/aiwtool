// Global config for Urlaub (vacation) date rules.
// Toggle this to false after the initial rollout / backfill phase is finished.
export const IS_VACATION_ROLLOUT_PHASE = true;

/** 
 * Returns the earliest allowed start date for a vacation request.
 *
 * - Rollout phase (IS_VACATION_ROLLOUT_PHASE = true):
 *   allow backdating from 01.01 of the current year.
 * - Standard phase:
 *   allow backdating at most 1 month into the past from "today".
 */
export function getEarliestAllowedVacationStart(today: Date = new Date()): Date {
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);

  if (IS_VACATION_ROLLOUT_PHASE) {
    return new Date(base.getFullYear(), 0, 1); // 1st January of current year
  }

  const oneMonthAgo = new Date(base);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  return oneMonthAgo;
}

