// Goals: types of the API's responses, and how to word them.
import { formatNumber, formatShortDate } from "./contributions";

export type GoalMetric =
  | "contributions"
  | "active_days"
  | "commits"
  | "issues_opened"
  | "prs_opened"
  | "prs_merged"
  | "reviews"
  | "discussions";
export type GoalRecurrence = "none" | "weekly" | "monthly";
export type GoalRepoScope = "all" | "subscribed" | "repo";

export interface GoalPeriod {
  start: string;
  end: string;
  progress: number;
  achievedAt: string | null;
}

export interface Goal {
  id: string;
  metric: GoalMetric;
  target: number;
  recurrence: GoalRecurrence;
  startsOn: string;
  endsOn: string | null;
  repoScope: GoalRepoScope;
  repo: { fullName: string; url: string } | null;
  isPublic: boolean;
  status: "active" | "archived";
  createdAt: string;
  /** Oldest first; the last is the current period. */
  periods: GoalPeriod[];
}

export const MAX_GOALS = 20;

/** [singular, plural] */
export const METRIC_NOUNS: Record<GoalMetric, [string, string]> = {
  contributions: ["Open Source Contribution", "Open Source Contributions"],
  active_days: ["active day", "active days"],
  commits: ["commit", "commits"],
  issues_opened: ["issue opened", "issues opened"],
  prs_opened: ["pull request opened", "pull requests opened"],
  prs_merged: ["pull request merged", "pull requests merged"],
  reviews: ["review", "reviews"],
  discussions: ["discussion", "discussions"],
};

export const METRIC_OPTIONS = Object.keys(METRIC_NOUNS) as GoalMetric[];

const noun = (metric: GoalMetric, count: number) => METRIC_NOUNS[metric][count === 1 ? 0 : 1];

/** "30 Open Source Contributions a month in acme/lib" */
export function goalTitle(
  goal: Pick<Goal, "metric" | "target" | "recurrence" | "endsOn" | "repoScope" | "repo">,
): string {
  const when =
    goal.recurrence === "weekly"
      ? " a week"
      : goal.recurrence === "monthly"
        ? " a month"
        : goal.endsOn
          ? ` by ${formatShortDate(goal.endsOn)}`
          : "";
  const where =
    goal.repoScope === "repo" && goal.repo
      ? ` in ${goal.repo.fullName}`
      : goal.repoScope === "subscribed"
        ? " in repositories you follow"
        : "";
  return `${formatNumber(goal.target)} ${noun(goal.metric, goal.target)}${when}${where}`;
}

/** "this week", "this month", "Oct 1 – Dec 31, 2026" */
export function periodLabel(goal: Pick<Goal, "recurrence">, period: GoalPeriod): string {
  if (goal.recurrence === "weekly") return "this week";
  if (goal.recurrence === "monthly") return "this month";
  return `${formatShortDate(period.start)} – ${formatShortDate(period.end)}`;
}
