import { and, eq, exists, lte } from "@osg/core/db/query";
import { repositories, subscriptions } from "@osg/core/db/schema";
import type { WorkerContext } from "../context.ts";

/** Repositories due for a poll: active, `next_poll_at` passed, and followed by someone. */
export async function findRepositoriesDue(ctx: WorkerContext, limit = 500): Promise<string[]> {
  const rows = await ctx.db
    .select({ id: repositories.id })
    .from(repositories)
    .where(
      and(
        eq(repositories.status, "active"),
        lte(repositories.nextPollAt, ctx.now()),
        exists(
          ctx.db
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(
              and(eq(subscriptions.repoId, repositories.id), eq(subscriptions.status, "active")),
            ),
        ),
      ),
    )
    .orderBy(repositories.nextPollAt)
    .limit(limit);
  return rows.map((row) => row.id);
}
