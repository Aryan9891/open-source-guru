// Types of the contribution endpoints, and helpers to show them.

export type ContributionKind = "commit" | "issue" | "pull_request" | "review" | "discussion";
export type StreakPeriod = "week" | "day";
export type ExcludedReason =
  | "private"
  | "fork"
  | "own_repo"
  | "no_license"
  | "not_osi_approved"
  | "unknown_license";

export interface Period {
  from: string;
  to: string;
  year: number | null;
}

export interface Repo {
  fullName: string;
  url: string;
  license: string | null;
}

export interface Streak {
  current: number;
  longest: number;
  currentStart: string | null;
  lastCountedPeriod: string | null;
}

export interface Stats {
  period: Period;
  total: number;
  days: { date: string; count: number }[];
  byKind: Record<ContributionKind, number>;
  byRepo: (Repo & { count: number })[];
  mergedPullRequests: { title: string | null; url: string | null; repo: Repo; mergedAt: string }[];
  streaks: { period: StreakPeriod; week: Streak; day: Streak };
  years: number[];
  lastSyncedAt: string | null;
}

export interface Excluded {
  period: Period;
  reasons: { reason: ExcludedReason; count: number }[];
  repos: (Repo & { reason: ExcludedReason; count: number })[];
  private: number | null;
}

export const KIND_LABELS: Record<ContributionKind, string> = {
  commit: "Commits",
  pull_request: "Pull requests",
  review: "Reviews",
  issue: "Issues",
  discussion: "Discussions",
};

/** "… contributions in your own repositories" */
export const REASON_LABELS: Record<ExcludedReason, string> = {
  own_repo: "in your own repositories",
  no_license: "in repositories without a license",
  not_osi_approved: "under a license that isn't OSI-approved",
  unknown_license: "under a license GitHub couldn't identify",
  fork: "in forks",
  private: "in private repositories",
};

/** `?year=` as the stats endpoint takes it; null for the last 12 months. */
export function parseYear(value: string | null): number | null {
  if (!value || !/^\d{4}$/.test(value)) return null;
  return Number(value);
}

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" });
const shortDateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });
const numberFormat = new Intl.NumberFormat("en");

const utc = (date: string) => new Date(`${date}T00:00:00Z`);
/** "October 12, 2026" for a `YYYY-MM-DD` date. */
export const formatDate = (date: string) => dateFormat.format(utc(date));
/** "Oct 12, 2026" for a `YYYY-MM-DD` date or an ISO timestamp. */
export const formatShortDate = (value: string) =>
  shortDateFormat.format(value.length === 10 ? utc(value) : new Date(value));
export const formatMonth = (date: string) => monthFormat.format(utc(date));
export const formatNumber = (value: number) => numberFormat.format(value);

/** "No Open Source Contributions", "1 Open Source Contribution", "3 Open Source Contributions" */
export const contributionsText = (count: number) =>
  `${count === 0 ? "No" : formatNumber(count)} Open Source Contribution${count === 1 ? "" : "s"}`;

/** "5 weeks", "1 day" */
export const streakText = (length: number, period: StreakPeriod) =>
  `${formatNumber(length)} ${period}${length === 1 ? "" : "s"}`;

export function addDays(date: string, days: number): string {
  return new Date(utc(date).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/** Weeks run Sunday to Saturday, as on GitHub's graph. */
export const weekStart = (date: string) => addDays(date, -utc(date).getUTCDay());

/**
 * Intensity 0–4 of a day, relative to the busiest day of the period: 0 for none, then four
 * equal steps, so a light year still uses the whole ramp.
 */
export function level(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as 1 | 2 | 3 | 4;
}
