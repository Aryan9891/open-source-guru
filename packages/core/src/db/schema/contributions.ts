// Open Source Contributions, streaks and goals (PLAN.md §4, §8.4).
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth.ts";
import { repositories } from "./github.ts";

export type ContributionKind = "commit" | "issue" | "pull_request" | "review" | "discussion";

/** Why a contribution isn't an Open Source Contribution (PLAN.md §4.1). */
export type ExcludedReason =
  | "private"
  | "fork"
  | "own_repo"
  | "no_license"
  | "not_osi_approved"
  | "unknown_license";

export type PullRequestState = "open" | "closed" | "merged";
export type ContributionSyncStatus = "pending" | "running" | "done" | "failed";
export type StreakPeriod = "week" | "day";
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
export type GoalStatus = "active" | "archived";

/**
 * Every contribution GitHub counts for the user. `counted` marks Open Source Contributions;
 * excluded ones are kept so the dashboard can explain them and counts can be recomputed.
 */
export const contributions = pgTable(
  "contributions",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text().$type<ContributionKind>().notNull(),
    /** GitHub node ID, or `commit:<repo id>:<date>` for commits (grouped per repo per day). */
    dedupeKey: text().notNull(),
    /** Null for commits, which GitHub only reports as daily counts per repository. */
    githubNodeId: text(),
    /** Null for private repositories: we don't store anything about them. */
    repoId: uuid().references(() => repositories.id, { onDelete: "set null" }),
    /** Whether the repository belongs to the user's account (PLAN.md §4.1, ownership rules). */
    repoOwnerIsUser: boolean().notNull(),
    /** Null for commits and private repositories. */
    title: text(),
    url: text(),
    occurredAt: timestamp({ withTimezone: true }).notNull(),
    /** The day it counts for, as on GitHub's contribution graph. */
    date: date({ mode: "string" }).notNull(),
    /** Commits on that day in that repository; 1 for everything else. */
    count: integer().default(1).notNull(),
    prState: text().$type<PullRequestState>(),
    prMergedAt: timestamp({ withTimezone: true }),
    counted: boolean().notNull(),
    excludedReason: text().$type<ExcludedReason>(),
    syncedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("contributions_user_dedupe_key").on(table.userId, table.dedupeKey),
    index("contributions_user_date_idx").on(table.userId, table.date),
    index("contributions_repo_id_idx").on(table.repoId),
  ],
);

/** Daily totals of counted contributions: drives the graph, yearly totals and streaks. */
export const contributionDays = pgTable(
  "contribution_days",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    count: integer().notNull(),
    syncedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.date] })],
);

/** Sync state per user and calendar year, so backfills run year by year and resume. */
export const contributionSyncs = pgTable(
  "contribution_syncs",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    year: integer().notNull(),
    status: text().$type<ContributionSyncStatus>().default("pending").notNull(),
    lastSyncedAt: timestamp({ withTimezone: true }),
    /** When a sync last started: retries and stuck syncs are scheduled from it. */
    lastAttemptAt: timestamp({ withTimezone: true }),
    lastError: text(),
    /** Contributions in private repositories GitHub reports only as a number. */
    restrictedCount: integer().default(0).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.year] })],
);

/** Both periods are kept up to date, so switching in Settings needs no recount. */
export const userStreaks = pgTable(
  "user_streaks",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    period: text().$type<StreakPeriod>().notNull(),
    currentLength: integer().default(0).notNull(),
    longestLength: integer().default(0).notNull(),
    /** First day of the current streak's first period; null when there's no streak. */
    currentStart: date({ mode: "string" }),
    /** First day of the last period with a contribution. */
    lastCountedPeriod: date({ mode: "string" }),
    updatedAt: timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.period] })],
);

export const goals = pgTable(
  "goals",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metric: text().$type<GoalMetric>().notNull(),
    target: integer().notNull(),
    recurrence: text().$type<GoalRecurrence>().notNull(),
    startsOn: date({ mode: "string" }).notNull(),
    /** One-off goals only. */
    endsOn: date({ mode: "string" }),
    repoScope: text().$type<GoalRepoScope>().default("all").notNull(),
    /** With `repoScope = 'repo'`. */
    repoId: uuid().references(() => repositories.id, { onDelete: "cascade" }),
    isPublic: boolean().default(false).notNull(),
    status: text().$type<GoalStatus>().default("active").notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("goals_user_id_idx").on(table.userId)],
);

export const goalPeriods = pgTable(
  "goal_periods",
  {
    goalId: uuid()
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    periodStart: date({ mode: "string" }).notNull(),
    periodEnd: date({ mode: "string" }).notNull(),
    progress: integer().default(0).notNull(),
    achievedAt: timestamp({ withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.goalId, table.periodStart] })],
);
