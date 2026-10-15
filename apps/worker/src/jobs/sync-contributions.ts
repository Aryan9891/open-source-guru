import { classifyContribution } from "@osg/core/contributions/classify";
import { and, eq, gte, lt, sql } from "@osg/core/db/query";
import { contributionSyncs, contributions, users } from "@osg/core/db/schema";
import type { FetchedContribution } from "@osg/core/github/contributions";
import type { WorkerContext } from "../context.ts";
import { rebuildContributionDays, upsertRepositories, yearRange } from "./contribution-store.ts";
import { recomputeProgress } from "./recompute-progress.ts";

export type SyncResult =
  | { outcome: "skipped" }
  | { outcome: "synced"; contributions: number; counted: number; restricted: number };

/** Rows per insert statement. */
const CHUNK = 500;

/** Stable identity of a contribution: its node ID, or repository + day for commits. */
const dedupeKey = (item: FetchedContribution) =>
  item.nodeId ?? `commit:${item.repo.githubId}:${item.date}`;

/**
 * Syncs one user's contributions for one calendar year (PLAN.md §4.2): fetches them from
 * GitHub, classifies them (§4.1), replaces what was stored for that year, and rebuilds the
 * daily totals. Idempotent; contributions that disappeared from GitHub are removed.
 */
export async function syncContributionYear(
  ctx: WorkerContext,
  userId: string,
  year: number,
): Promise<SyncResult> {
  const { db } = ctx;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return { outcome: "skipped" };

  const now = ctx.now();
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Math.min(Date.UTC(year + 1, 0, 1), now.getTime()));
  if (from >= to) return { outcome: "skipped" };

  const syncRow = and(eq(contributionSyncs.userId, userId), eq(contributionSyncs.year, year));
  await db
    .insert(contributionSyncs)
    .values({ userId, year, status: "running", lastAttemptAt: now })
    .onConflictDoUpdate({
      target: [contributionSyncs.userId, contributionSyncs.year],
      set: { status: "running", lastAttemptAt: now },
    });

  try {
    const fetched = await ctx.contributions.fetchContributions(user.login, from, to);
    const discussions = await ctx.contributions.fetchDiscussions(user.login, from, to);
    const { start, end } = yearRange(year);
    const items = [
      ...new Map(
        [...fetched.contributions, ...discussions]
          .filter((item) => item.date >= start && item.date < end)
          .map((item) => [dedupeKey(item), item]),
      ).values(),
    ];

    const counted = await db.transaction(async (tx) => {
      const repoIds = await upsertRepositories(
        tx,
        items.map((item) => item.repo),
        now,
      );
      const rows = items.map((item) => {
        const { counted, excludedReason } = classifyContribution(item.repo, user.githubId);
        // Nothing identifying is kept about private repositories.
        const isPrivate = item.repo.isPrivate;
        return {
          userId,
          kind: item.kind,
          dedupeKey: dedupeKey(item),
          githubNodeId: item.nodeId,
          repoId: isPrivate ? null : (repoIds.get(item.repo.githubId) ?? null),
          repoOwnerIsUser: item.repo.ownerGithubId === user.githubId,
          title: isPrivate ? null : item.title,
          url: isPrivate ? null : item.url,
          occurredAt: item.occurredAt,
          date: item.date,
          count: item.count,
          prState: item.prState,
          prMergedAt: item.prMergedAt,
          counted,
          excludedReason,
          syncedAt: now,
        };
      });
      for (let index = 0; index < rows.length; index += CHUNK) {
        await tx
          .insert(contributions)
          .values(rows.slice(index, index + CHUNK))
          .onConflictDoUpdate({
            target: [contributions.userId, contributions.dedupeKey],
            set: {
              repoId: sql`excluded.repo_id`,
              repoOwnerIsUser: sql`excluded.repo_owner_is_user`,
              title: sql`excluded.title`,
              url: sql`excluded.url`,
              occurredAt: sql`excluded.occurred_at`,
              date: sql`excluded.date`,
              count: sql`excluded.count`,
              prState: sql`excluded.pr_state`,
              prMergedAt: sql`excluded.pr_merged_at`,
              counted: sql`excluded.counted`,
              excludedReason: sql`excluded.excluded_reason`,
              syncedAt: sql`excluded.synced_at`,
            },
          });
      }
      // Gone from GitHub since the last sync (deleted issues, rewritten history, …).
      await tx
        .delete(contributions)
        .where(
          and(
            eq(contributions.userId, userId),
            gte(contributions.date, start),
            lt(contributions.date, end),
            lt(contributions.syncedAt, now),
          ),
        );
      await rebuildContributionDays(tx, userId, year, now);
      await tx
        .update(contributionSyncs)
        .set({
          status: "done",
          lastSyncedAt: now,
          lastError: null,
          restrictedCount: fetched.restrictedCount,
        })
        .where(syncRow);
      return rows.filter((row) => row.counted).length;
    });

    await recomputeProgress(ctx, userId);
    return {
      outcome: "synced",
      contributions: items.length,
      counted,
      restricted: fetched.restrictedCount,
    };
  } catch (error) {
    await db
      .update(contributionSyncs)
      .set({ status: "failed", lastError: error instanceof Error ? error.message : String(error) })
      .where(syncRow);
    throw error;
  }
}
