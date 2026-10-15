// Synced contributions for 2026, seeded directly: two counted commit days and a merged pull
// request in acme/lib, plus excluded contributions (unlicensed repo, own repo).
import type { Database } from "@osg/core/db";
import {
  contributionDays,
  contributionSyncs,
  contributions,
  repositories,
  userStreaks,
} from "@osg/core/db/schema";

export async function seedContributions(db: Database, userId: string) {
  const [lib, app, own] = await db
    .insert(repositories)
    .values([
      { githubId: 1, owner: "acme", name: "lib", licenseSpdxId: "MIT", isOpenSource: true },
      { githubId: 2, owner: "acme", name: "app", licenseSpdxId: null, isOpenSource: false },
      { githubId: 3, owner: "ada", name: "dotfiles", licenseSpdxId: "MIT", isOpenSource: true },
    ])
    .returning();
  const at = (iso: string) => new Date(iso);
  const base = { userId, repoOwnerIsUser: false, counted: true, excludedReason: null };
  await db.insert(contributions).values([
    {
      ...base,
      kind: "commit",
      dedupeKey: "c1",
      repoId: lib?.id,
      occurredAt: at("2026-03-03T08:00:00Z"),
      date: "2026-03-03",
      count: 3,
    },
    {
      ...base,
      kind: "commit",
      dedupeKey: "c2",
      repoId: lib?.id,
      occurredAt: at("2026-03-04T08:00:00Z"),
      date: "2026-03-04",
      count: 2,
    },
    {
      ...base,
      kind: "pull_request",
      dedupeKey: "p1",
      repoId: lib?.id,
      title: "Fix",
      url: "https://x/pr/1",
      occurredAt: at("2026-03-04T10:00:00Z"),
      date: "2026-03-04",
      prState: "merged",
      prMergedAt: at("2026-03-06T10:00:00Z"),
    },
    {
      ...base,
      kind: "issue",
      dedupeKey: "i1",
      repoId: app?.id,
      occurredAt: at("2026-03-05T10:00:00Z"),
      date: "2026-03-05",
      counted: false,
      excludedReason: "no_license",
    },
    {
      ...base,
      kind: "commit",
      dedupeKey: "c3",
      repoId: own?.id,
      occurredAt: at("2026-03-05T08:00:00Z"),
      date: "2026-03-05",
      count: 7,
      repoOwnerIsUser: true,
      counted: false,
      excludedReason: "own_repo",
    },
  ] as (typeof contributions.$inferInsert)[]);
  await db.insert(contributionDays).values([
    { userId, date: "2026-03-03", count: 3 },
    { userId, date: "2026-03-04", count: 3 },
  ]);
  await db.insert(contributionSyncs).values([
    {
      userId,
      year: 2026,
      status: "done",
      lastSyncedAt: at("2026-10-15T01:00:00Z"),
      restrictedCount: 12,
    },
    { userId, year: 2025, status: "done", lastSyncedAt: at("2026-10-01T01:00:00Z") },
  ]);
  await db.insert(userStreaks).values([
    // Stored long ago: the daily streak has ended since, the longest stays.
    {
      userId,
      period: "day",
      currentLength: 2,
      longestLength: 2,
      currentStart: "2026-03-03",
      lastCountedPeriod: "2026-03-04",
    },
    {
      userId,
      period: "week",
      currentLength: 1,
      longestLength: 1,
      currentStart: "2026-03-01",
      lastCountedPeriod: "2026-03-01",
    },
  ]);
}
