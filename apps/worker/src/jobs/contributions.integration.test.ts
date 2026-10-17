import { and, asc, eq } from "@osg/core/db/query";
import {
  contributionDays,
  contributionSyncs,
  contributions,
  repositories,
  userStreaks,
  users,
} from "@osg/core/db/schema";
import { describe, expect, it } from "vitest";
import { contribution, ghRepo, USER_GITHUB_ID } from "../testing/contributions.ts";
import { createWorkerTest, useTestDatabase } from "../testing/setup.ts";
import { RECLASSIFY_AFTER_MS, reclassifyRepositories } from "./classify-repos.ts";
import {
  findContributionSyncsDue,
  REFRESH_CURRENT_YEAR_MS,
  RETRY_AFTER_MS,
} from "./schedule-contribution-syncs.ts";
import { syncContributionYear } from "./sync-contributions.ts";

const database = useTestDatabase();
const setup = () => createWorkerTest(database());

const openSource = ghRepo(10);
const forked = ghRepo(11, { isFork: true });
const own = ghRepo(12, { ownerGithubId: USER_GITHUB_ID });
const secret = ghRepo(13, { isPrivate: true, name: "secret-project" });

const days = async (userId: string) =>
  database()
    .db.select({ date: contributionDays.date, count: contributionDays.count })
    .from(contributionDays)
    .where(eq(contributionDays.userId, userId))
    .orderBy(asc(contributionDays.date));

describe("syncContributionYear", () => {
  it("stores and classifies a year of contributions, and builds daily totals", async () => {
    const { ctx, contributions: github, user } = await setup();
    github.state.restrictedCount = 4;
    github.state.contributions = [
      // Commit days arrive as midnight Pacific time.
      contribution("commit", openSource, "2026-03-03T08:00:00Z", { count: 3 }),
      contribution("pull_request", openSource, "2026-03-03T15:00:00Z", { prState: "merged" }),
      contribution("issue", forked, "2026-03-04T10:00:00Z"),
      contribution("commit", own, "2026-03-04T08:00:00Z", { count: 9 }),
      contribution("review", secret, "2026-03-05T10:00:00Z", { title: "Secret PR" }),
    ];
    github.state.discussions = [contribution("discussion", openSource, "2026-03-05T12:00:00Z")];

    const result = await syncContributionYear(ctx, user.id, 2026);

    expect(result).toEqual({ outcome: "synced", contributions: 6, counted: 3, restricted: 4 });
    expect(github.state.windows).toEqual([
      { from: new Date("2026-01-01T00:00:00Z"), to: ctx.now() },
    ]);
    const stored = await database()
      .db.select()
      .from(contributions)
      .orderBy(asc(contributions.occurredAt));
    expect(
      stored.map((row) => [row.kind, row.date, row.count, row.counted, row.excludedReason]),
    ).toEqual([
      ["commit", "2026-03-03", 3, true, null],
      ["pull_request", "2026-03-03", 1, true, null],
      ["commit", "2026-03-04", 9, false, "own_repo"],
      ["issue", "2026-03-04", 1, false, "fork"],
      ["review", "2026-03-05", 1, false, "private"],
      ["discussion", "2026-03-05", 1, true, null],
    ]);
    // Nothing identifying is kept about private repositories.
    expect(stored.find((row) => row.kind === "review")).toMatchObject({
      repoId: null,
      title: null,
      url: null,
    });
    const repos = await database().db.select().from(repositories);
    expect(repos.map((repo) => repo.githubId).sort()).toEqual([10, 11, 12, 99]);
    expect(repos.find((repo) => repo.githubId === 11)).toMatchObject({
      isOpenSource: false,
      isFork: true,
      ownerGithubId: 500,
    });

    expect(await days(user.id)).toEqual([
      { date: "2026-03-03", count: 4 },
      { date: "2026-03-05", count: 1 },
    ]);
    const sync = await database().db.query.contributionSyncs.findFirst();
    expect(sync).toMatchObject({ year: 2026, status: "done", restrictedCount: 4, lastError: null });
    // Streaks are recomputed: March 3 and 5 aren't consecutive days, but share a week.
    const streaks = await database().db.select().from(userStreaks).orderBy(asc(userStreaks.period));
    expect(streaks.map((row) => [row.period, row.currentLength, row.longestLength])).toEqual([
      ["day", 0, 1],
      ["week", 0, 1],
    ]);
  });

  it("updates what changed and removes what disappeared on the next sync", async () => {
    const { ctx, contributions: github, advance, user } = await setup();
    const pr = contribution("pull_request", openSource, "2026-05-01T10:00:00Z");
    const issue = contribution("issue", openSource, "2026-05-02T10:00:00Z");
    github.state.contributions = [pr, issue];
    await syncContributionYear(ctx, user.id, 2026);

    advance(60 * 60 * 1000);
    github.state.contributions = [{ ...pr, prState: "merged", prMergedAt: ctx.now() }];
    await syncContributionYear(ctx, user.id, 2026);

    const stored = await database().db.select().from(contributions);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ kind: "pull_request", prState: "merged" });
    expect(await days(user.id)).toEqual([{ date: "2026-05-01", count: 1 }]);
  });

  it("records failures so they can be retried", async () => {
    const { ctx, contributions: github, advance, user } = await setup();
    github.state.failure = new Error("GitHub is down");

    await expect(syncContributionYear(ctx, user.id, 2026)).rejects.toThrow("GitHub is down");

    const sync = await database().db.query.contributionSyncs.findFirst();
    expect(sync).toMatchObject({ status: "failed", lastError: "GitHub is down" });
    expect(await findContributionSyncsDue(ctx)).not.toContainEqual({ userId: user.id, year: 2026 });
    advance(RETRY_AFTER_MS + 1);
    expect(await findContributionSyncsDue(ctx)).toContainEqual({ userId: user.id, year: 2026 });
  });
});

describe("findContributionSyncsDue", () => {
  it("backfills every year since the GitHub account was created, newest first", async () => {
    const { ctx, user } = await setup();
    await database()
      .db.update(users)
      .set({ githubCreatedAt: new Date("2024-06-01T00:00:00Z") })
      .where(eq(users.id, user.id));

    expect(await findContributionSyncsDue(ctx)).toEqual([
      { userId: user.id, year: 2026 },
      { userId: user.id, year: 2025 },
      { userId: user.id, year: 2024 },
    ]);
  });

  it("refreshes the current year every 6 hours and past years monthly", async () => {
    const { ctx, advance, user } = await setup();
    await database()
      .db.update(users)
      .set({ githubCreatedAt: new Date("2025-06-01T00:00:00Z") })
      .where(eq(users.id, user.id));
    await syncContributionYear(ctx, user.id, 2026);
    await syncContributionYear(ctx, user.id, 2025);
    expect(await findContributionSyncsDue(ctx)).toEqual([]);

    advance(REFRESH_CURRENT_YEAR_MS + 1);
    expect(await findContributionSyncsDue(ctx)).toEqual([{ userId: user.id, year: 2026 }]);

    // A sync requested from the dashboard is due right away.
    await database()
      .db.update(contributionSyncs)
      .set({ status: "pending" })
      .where(and(eq(contributionSyncs.userId, user.id), eq(contributionSyncs.year, 2025)));
    expect(await findContributionSyncsDue(ctx)).toEqual([
      { userId: user.id, year: 2026 },
      { userId: user.id, year: 2025 },
    ]);
  });
});

describe("reclassifyRepositories", () => {
  it("recounts contributions when a repository's fork status or owner changes", async () => {
    const { ctx, contributions: github, advance, user } = await setup();
    github.state.contributions = [
      contribution("issue", openSource, "2026-04-01T10:00:00Z"),
      contribution("issue", forked, "2026-04-02T10:00:00Z"),
    ];
    await syncContributionYear(ctx, user.id, 2026);
    expect(await days(user.id)).toEqual([{ date: "2026-04-01", count: 1 }]);

    // A week later: the first repository was transferred to the user, the second is no longer a fork.
    advance(RECLASSIFY_AFTER_MS + 1);
    github.state.repos.set(10, { ...openSource, ownerGithubId: USER_GITHUB_ID });
    github.state.repos.set(11, { ...forked, isFork: false });

    expect(await reclassifyRepositories(ctx)).toEqual({ checked: 2, changed: 2 });

    const stored = await database()
      .db.select()
      .from(contributions)
      .orderBy(asc(contributions.date));
    expect(stored.map((row) => [row.date, row.counted, row.excludedReason])).toEqual([
      ["2026-04-01", false, "own_repo"],
      ["2026-04-02", true, null],
    ]);
    expect(await days(user.id)).toEqual([{ date: "2026-04-02", count: 1 }]);
    // Checked again next week, not before.
    expect(await reclassifyRepositories(ctx)).toEqual({ checked: 0, changed: 0 });
  });
});
