import { classifyContribution, repoExclusion } from "@osg/core/contributions/classify";
import { and, eq, exists, isNull, lt, or, sql } from "@osg/core/db/query";
import { contributions, repositories, users } from "@osg/core/db/schema";
import type { WorkerContext } from "../context.ts";
import { rebuildContributionDays, upsertRepositories } from "./contribution-store.ts";
import { recomputeProgress } from "./recompute-progress.ts";

/** Repositories are re-checked weekly. */
export const RECLASSIFY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Re-checks repositories people contributed to: license changes, visibility changes and
 * transfers (a new owner can make contributions start or stop counting). When the outcome
 * changes, contributions are reclassified and the daily totals rebuilt.
 */
export async function reclassifyRepositories(
  ctx: WorkerContext,
  limit = 200,
): Promise<{ checked: number; changed: number }> {
  const { db } = ctx;
  const now = ctx.now();
  const due = await db
    .select()
    .from(repositories)
    .where(
      and(
        or(
          isNull(repositories.classifiedAt),
          lt(repositories.classifiedAt, new Date(now.getTime() - RECLASSIFY_AFTER_MS)),
        ),
        exists(
          db
            .select({ id: contributions.id })
            .from(contributions)
            .where(eq(contributions.repoId, repositories.id)),
        ),
      ),
    )
    .orderBy(repositories.classifiedAt)
    .limit(limit);

  let changed = 0;
  for (const repo of due) {
    const facts = await ctx.contributions.getRepositoryById(repo.githubId);
    if (!facts) {
      // Deleted or blocked: its contributions disappear at the next sync of their year.
      await db.update(repositories).set({ classifiedAt: now }).where(eq(repositories.id, repo.id));
      continue;
    }
    const isOpenSource = repoExclusion(facts) === null;
    const outcomeChanged =
      facts.ownerGithubId !== repo.ownerGithubId ||
      facts.isPrivate !== repo.isPrivate ||
      facts.isFork !== repo.isFork ||
      isOpenSource !== repo.isOpenSource;

    const recounted = await db.transaction(async (tx) => {
      if (facts.isPrivate) {
        await tx
          .update(repositories)
          .set({ isPrivate: true, isOpenSource: false, classifiedAt: now })
          .where(eq(repositories.id, repo.id));
      } else {
        await upsertRepositories(tx, [facts], now);
      }
      if (!outcomeChanged) return [];
      changed++;

      // Classification depends on the user (ownership): update per contributor.
      const affected = await tx
        .selectDistinct({
          userId: contributions.userId,
          githubId: users.githubId,
          year: sql<number>`extract(year from ${contributions.date})::int`,
        })
        .from(contributions)
        .innerJoin(users, eq(users.id, contributions.userId))
        .where(eq(contributions.repoId, repo.id));

      for (const userId of new Set(affected.map((row) => row.userId))) {
        const githubId = affected.find((row) => row.userId === userId)?.githubId ?? 0;
        const { counted, excludedReason } = classifyContribution(facts, githubId);
        await tx
          .update(contributions)
          .set({
            counted,
            excludedReason,
            repoOwnerIsUser: facts.ownerGithubId === githubId,
            // Now private: nothing identifying is kept.
            ...(facts.isPrivate && { repoId: null, title: null, url: null }),
          })
          .where(and(eq(contributions.repoId, repo.id), eq(contributions.userId, userId)));
      }
      for (const { userId, year } of affected) {
        await rebuildContributionDays(tx, userId, year, now);
      }
      return [...new Set(affected.map((row) => row.userId))];
    });
    for (const userId of recounted) await recomputeProgress(ctx, userId);
  }
  return { checked: due.length, changed };
}
