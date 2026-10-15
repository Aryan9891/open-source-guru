import type { StreakPeriod } from "../db/schema/contributions.ts";
import { addDays, daysBetween, type IsoDate, weekStart } from "./dates.ts";

export interface Streak {
  /** Periods in a row with a contribution, up to now; 0 when broken. */
  currentLength: number;
  longestLength: number;
  /** First day of the current streak (a Sunday for weekly streaks); null without one. */
  currentStart: IsoDate | null;
  /** First day of the last period with a contribution. */
  lastCountedPeriod: IsoDate | null;
}

const periodStart = (date: IsoDate, period: StreakPeriod) =>
  period === "week" ? weekStart(date) : date;
const periodDays = (period: StreakPeriod) => (period === "week" ? 7 : 1);

/**
 * Streaks of days or weeks (Sunday to Saturday) with at least one Open Source Contribution
 * (PLAN.md §4.4). `today` is the user's current date: the current day or week isn't counted as
 * broken until it's over, so a streak that ended in the previous period is still current.
 */
export function computeStreak(
  activeDays: Iterable<IsoDate>,
  period: StreakPeriod,
  today: IsoDate,
): Streak {
  const current = periodStart(today, period);
  const step = periodDays(period);
  // Distinct periods with a contribution, oldest first; future dates are ignored.
  const periods = [...new Set([...activeDays].map((day) => periodStart(day, period)))]
    .filter((start) => start <= current)
    .sort();

  let longest = 0;
  let runStart: IsoDate | null = null;
  let runLength = 0;
  let previous: IsoDate | null = null;
  for (const start of periods) {
    if (previous !== null && daysBetween(previous, start) === step) {
      runLength++;
    } else {
      runStart = start;
      runLength = 1;
    }
    longest = Math.max(longest, runLength);
    previous = start;
  }

  const last = previous;
  const ongoing = last !== null && (last === current || last === addDays(current, -step));
  return {
    currentLength: ongoing ? runLength : 0,
    longestLength: longest,
    currentStart: ongoing ? runStart : null,
    lastCountedPeriod: last,
  };
}

/**
 * A stored streak as of `today`: streaks are computed after each sync, so the current one may
 * have ended since (no contribution in the previous period or this one).
 */
export function currentStreakAsOf(streak: Streak, period: StreakPeriod, today: IsoDate): Streak {
  if (!streak.lastCountedPeriod) return streak;
  const current = periodStart(today, period);
  const ongoing =
    streak.lastCountedPeriod === current ||
    streak.lastCountedPeriod === addDays(current, -periodDays(period));
  return ongoing ? streak : { ...streak, currentLength: 0, currentStart: null };
}
