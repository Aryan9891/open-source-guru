// Mirror of the GitHub data we poll, shared by all users (PLAN.md §8.3).
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export interface IssueLabel {
  /** GitHub node ID: stable across label renames. */
  nodeId: string;
  name: string;
  color: string;
}

export interface RepoLabel extends IssueLabel {
  description: string | null;
  openIssues: number;
}

export type RepositoryStatus = "active" | "not_found" | "moved";

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const repositories = pgTable(
  "repositories",
  {
    id: uuid().defaultRandom().primaryKey(),
    githubId: bigint({ mode: "number" }).notNull().unique(),
    owner: text().notNull(),
    name: text().notNull(),
    status: text().$type<RepositoryStatus>().default("active").notNull(),
    // Polling state (PLAN.md §2)
    etag: text(),
    /** `since` sent to GitHub on the next poll. */
    cursorSince: timestamp({ withTimezone: true }),
    /**
     * When the first full snapshot was stored. Null until then, and no notifications are sent
     * before it. Issues created after this moment that we haven't seen yet are new issues.
     */
    initializedAt: timestamp({ withTimezone: true }),
    nextPollAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    pollIntervalSeconds: integer().default(120).notNull(),
    lastPolledAt: timestamp({ withTimezone: true }),
    lastPollError: text(),
    // Classification for Open Source Contributions (PLAN.md §4.1); null until classified.
    ownerGithubId: bigint({ mode: "number" }),
    isPrivate: boolean(),
    isFork: boolean(),
    /** SPDX identifier GitHub detected, e.g. `MIT`, `NOASSERTION`; null without a license. */
    licenseSpdxId: text(),
    isOpenSource: boolean(),
    classifiedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("repositories_full_name_idx").on(
      sql`lower(${table.owner})`,
      sql`lower(${table.name})`,
    ),
    index("repositories_next_poll_at_idx").on(table.nextPollAt),
  ],
);

export const repoLabelsCache = pgTable("repo_labels_cache", {
  repoId: uuid()
    .primaryKey()
    .references(() => repositories.id, { onDelete: "cascade" }),
  labels: jsonb().$type<RepoLabel[]>().notNull(),
  fetchedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export const issueSnapshots = pgTable(
  "issue_snapshots",
  {
    repoId: uuid()
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    issueNumber: integer().notNull(),
    githubId: bigint({ mode: "number" }).notNull(),
    title: text().notNull(),
    htmlUrl: text().notNull(),
    state: text().$type<"open" | "closed">().notNull(),
    labels: jsonb().$type<IssueLabel[]>().notNull(),
    assignees: jsonb().$type<string[]>().notNull(),
    authorLogin: text(),
    /** `created_at` / `updated_at` on GitHub. */
    githubCreatedAt: timestamp({ withTimezone: true }).notNull(),
    githubUpdatedAt: timestamp({ withTimezone: true }).notNull(),
    syncedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.repoId, table.issueNumber] })],
);

export type IssueEventType = "issue.opened" | "issue.labeled";

export const events = pgTable(
  "events",
  {
    id: uuid().defaultRandom().primaryKey(),
    repoId: uuid()
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    issueNumber: integer().notNull(),
    type: text().$type<IssueEventType>().notNull(),
    /** The label that was added (`issue.labeled` only). */
    label: text(),
    /** The issue as it was when the event was detected. */
    issue: jsonb().$type<EventIssue>().notNull(),
    occurredAt: timestamp({ withTimezone: true }).notNull(),
    dedupeKey: text().notNull().unique(),
    /** Set once deliveries have been created for this event. */
    fannedOutAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("events_pending_fanout_idx").on(table.createdAt).where(sql`${table.fannedOutAt} is null`),
  ],
);

export interface EventIssue {
  number: number;
  title: string;
  htmlUrl: string;
  labels: IssueLabel[];
  assignees: string[];
  authorLogin: string | null;
}
