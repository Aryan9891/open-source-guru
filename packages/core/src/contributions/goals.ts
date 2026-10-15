import type { ContributionKind, GoalMetric, GoalRecurrence } from "../db/schema/contributions.ts";
import { addDays, type IsoDate, weekStart } from "./dates.ts";

/** Periods of a recurring goal kept with their progress (current one included). */
export const GOAL_HISTORY = 12;

export interface GoalPeriod {
  start: IsoDate;
  /** Last day, included. */
  end: IsoDate;
}

export interface GoalShape {
  recurrence: GoalRecurrence;
  startsOn: IsoDate;
  /** One-off goals only. */
  endsOn: IsoDate | null;
}

const monthStart = (date: IsoDate) => `${date.slice(0, 7)}-01`;
function nextMonth(date: IsoDate): IsoDate {
  const [year, month] = date.split("-").map(Number) as [number, number];
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

/** Where a goal's first period starts: the week (Sunday) or month of `date`, or `date` itself. */
export function alignStart(recurrence: GoalRecurrence, date: IsoDate): IsoDate {
  if (recurrence === "weekly") return weekStart(date);
  if (recurrence === "monthly") return monthStart(date);
  return date;
}

/**
 * The periods a goal covers up to `today`, oldest first: one for a one-off goal, otherwise every
 * week or month since it started, the current one included, the last `GOAL_HISTORY` at most.
 */
export function goalPeriods(goal: GoalShape, today: IsoDate): GoalPeriod[] {
  if (goal.recurrence === "none") {
    return goal.startsOn <= today
      ? [{ start: goal.startsOn, end: goal.endsOn ?? goal.startsOn }]
      : [];
  }
  const periods: GoalPeriod[] = [];
  let start = alignStart(goal.recurrence, goal.startsOn);
  while (start <= today) {
    const next = goal.recurrence === "weekly" ? addDays(start, 7) : nextMonth(start);
    periods.push({ start, end: addDays(next, -1) });
    start = next;
  }
  return periods.slice(-GOAL_HISTORY);
}

/** A counted contribution, as goal progress needs it. */
export interface GoalContribution {
  kind: ContributionKind;
  date: IsoDate;
  count: number;
  /** UTC date of the merge, for merged pull requests. */
  mergedOn: IsoDate | null;
  repoId: string | null;
}

const KIND_OF: Partial<Record<GoalMetric, ContributionKind>> = {
  commits: "commit",
  issues_opened: "issue",
  prs_opened: "pull_request",
  reviews: "review",
  discussions: "discussion",
};

/**
 * Progress of a metric over a period (PLAN.md §4.5). Commits count each commit; merged pull
 * requests count by merge date (they're opened earlier, possibly in another period).
 */
export function measure(metric: GoalMetric, items: GoalContribution[], period: GoalPeriod): number {
  const inPeriod = (date: IsoDate | null) =>
    date !== null && date >= period.start && date <= period.end;

  if (metric === "prs_merged") {
    return items.filter((item) => item.kind === "pull_request" && inPeriod(item.mergedOn)).length;
  }
  const within = items.filter((item) => inPeriod(item.date));
  if (metric === "active_days") return new Set(within.map((item) => item.date)).size;
  if (metric === "contributions") return within.reduce((sum, item) => sum + item.count, 0);
  const kind = KIND_OF[metric];
  return within.filter((item) => item.kind === kind).reduce((sum, item) => sum + item.count, 0);
}
