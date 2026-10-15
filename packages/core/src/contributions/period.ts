import { addDays, type IsoDate, weekStart } from "./dates.ts";

/** A date range, both ends included. */
export interface Period {
  from: IsoDate;
  to: IsoDate;
  /** The calendar year, or null for the last 12 months. */
  year: number | null;
}

/**
 * The period the contribution graph shows (PLAN.md §4.3): a calendar year, or by default the
 * last 12 months as GitHub draws them, 53 weeks starting on a Sunday and ending today.
 */
export function resolvePeriod(year: number | undefined, today: IsoDate): Period {
  if (year !== undefined) return { from: `${year}-01-01`, to: `${year}-12-31`, year };
  return { from: weekStart(addDays(today, -364)), to: today, year: null };
}
