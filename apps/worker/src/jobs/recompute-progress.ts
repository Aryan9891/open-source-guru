import { dateInTimeZone } from "@osg/core/contributions/dates";
import { type AchievedPeriod, refreshGoalProgress } from "@osg/core/contributions/goal-progress";
import { computeStreak } from "@osg/core/contributions/streaks";
import { eq, sql } from "@osg/core/db/query";
import { contributionDays, type StreakPeriod, userStreaks } from "@osg/core/db/schema";
import type { WorkerContext } from "../context.ts";
import { sendGoalAchievedEmail } from "./progress-emails.ts";

/**
 * Recomputes a user's streaks, both periods, from their daily totals, so
 * switching the period in Settings needs no recount; then their goals' progress (§4.5),
 * emailing congratulations when goal emails are on. Returns the goal periods achieved just now.
 */
export async function recomputeProgress(
  ctx: WorkerContext,
  userId: string,
): Promise<AchievedPeriod[]> {
  const rows = await ctx.db
    .select({ date: contributionDays.date })
    .from(contributionDays)
    .where(eq(contributionDays.userId, userId));
  // Contribution dates follow GitHub's graph, which is in UTC.
  const today = dateInTimeZone(ctx.now(), "UTC");
  const dates = rows.map((row) => row.date);

  const values = (["week", "day"] as StreakPeriod[]).map((period) => ({
    userId,
    period,
    ...computeStreak(dates, period, today),
  }));
  await ctx.db
    .insert(userStreaks)
    .values(values)
    .onConflictDoUpdate({
      target: [userStreaks.userId, userStreaks.period],
      set: {
        currentLength: sql`excluded.current_length`,
        longestLength: sql`excluded.longest_length`,
        currentStart: sql`excluded.current_start`,
        lastCountedPeriod: sql`excluded.last_counted_period`,
        updatedAt: ctx.now(),
      },
    });

  const achieved = await refreshGoalProgress(ctx.db, userId, ctx.now());
  await sendGoalAchievedEmail(ctx, userId, achieved);
  return achieved;
}
