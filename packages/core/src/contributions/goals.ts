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
 * Progress of a metric over a period. Commits count each commit; merged pull
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

/** [singular, plural] of what each metric counts. */
const METRIC_NOUNS: Record<GoalMetric, [string, string]> = {
  contributions: ["Open Source Contribution", "Open Source Contributions"],
  active_days: ["active day", "active days"],
  commits: ["commit", "commits"],
  issues_opened: ["issue opened", "issues opened"],
  prs_opened: ["pull request opened", "pull requests opened"],
  prs_merged: ["pull request merged", "pull requests merged"],
  reviews: ["review", "reviews"],
  discussions: ["discussion", "discussions"],
};

const shortDate = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const utc = (date: IsoDate) => new Date(`${date}T00:00:00Z`);

/** "30 Open Source Contributions a month", "3 pull requests merged a week in acme/lib" */
export function describeGoal(goal: {
  metric: GoalMetric;
  target: number;
  recurrence: GoalRecurrence;
  endsOn: IsoDate | null;
  repoScope: "all" | "subscribed" | "repo";
  repoFullName: string | null;
}): string {
  const noun = METRIC_NOUNS[goal.metric][goal.target === 1 ? 0 : 1];
  const when =
    goal.recurrence === "weekly"
      ? " a week"
      : goal.recurrence === "monthly"
        ? " a month"
        : goal.endsOn
          ? ` by ${shortDate.format(utc(goal.endsOn))}`
          : "";
  const where =
    goal.repoScope === "repo" && goal.repoFullName
      ? ` in ${goal.repoFullName}`
      : goal.repoScope === "subscribed"
        ? " in repositories you follow"
        : "";
  return `${goal.target} ${noun}${when}${where}`;
}

/** "the week of Oct 11, 2026", "October 2026", "Oct 1, 2026 – Dec 31, 2026" */
export function describePeriod(recurrence: GoalRecurrence, period: GoalPeriod): string {
  if (recurrence === "weekly") return `the week of ${shortDate.format(utc(period.start))}`;
  if (recurrence === "monthly") return monthYear.format(utc(period.start));
  return `${shortDate.format(utc(period.start))} – ${shortDate.format(utc(period.end))}`;
}
