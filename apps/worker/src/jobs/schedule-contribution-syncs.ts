import { and, desc, eq, isNull, lt, or, sql } from "@osg/core/db/query";
import { contributionSyncs, users } from "@osg/core/db/schema";
import type { WorkerContext } from "../context.ts";

const HOUR_MS = 60 * 60 * 1000;

/** How often each year is refreshed once synced (PLAN.md §4.2). */
export const REFRESH_CURRENT_YEAR_MS = 6 * HOUR_MS;
export const REFRESH_PAST_YEAR_MS = 30 * 24 * HOUR_MS;
/** A failed sync is retried after this long; a running one is considered stuck after it. */
export const RETRY_AFTER_MS = HOUR_MS;

export interface SyncDue {
  userId: string;
  year: number;
}

/**
 * The user-years to sync now, newest years first:
 * - years never synced, including the backfill of new users (one row per year since the
 *   GitHub account was created is added here),
 * - years whose sync was requested (`pending`, e.g. from the dashboard),
 * - the current year every 6 hours, past years every month,
 * - failed or stuck syncs after an hour.
 */
export async function findContributionSyncsDue(ctx: WorkerContext, limit = 50): Promise<SyncDue[]> {
  const now = ctx.now();
  const currentYear = now.getUTCFullYear();
  const ago = (ms: number) => new Date(now.getTime() - ms);

  await ctx.db.execute(sql`
    insert into ${contributionSyncs} (user_id, year)
    select ${users.id}, year
    from ${users},
      generate_series(
        extract(year from coalesce(${users.githubCreatedAt}, ${users.createdAt}))::int,
        ${currentYear}::int
      ) as year
    on conflict do nothing
  `);

  const { status, year, lastSyncedAt, lastAttemptAt } = contributionSyncs;
  return ctx.db
    .select({ userId: contributionSyncs.userId, year })
    .from(contributionSyncs)
    .where(
      or(
        eq(status, "pending"),
        and(
          or(eq(status, "failed"), eq(status, "running")),
          or(isNull(lastAttemptAt), lt(lastAttemptAt, ago(RETRY_AFTER_MS))),
        ),
        and(
          eq(status, "done"),
          or(
            and(eq(year, currentYear), lt(lastSyncedAt, ago(REFRESH_CURRENT_YEAR_MS))),
            and(lt(year, currentYear), lt(lastSyncedAt, ago(REFRESH_PAST_YEAR_MS))),
          ),
        ),
      ),
    )
    .orderBy(desc(year), sql`${lastSyncedAt} asc nulls first`)
    .limit(limit);
}
