import type { DatabaseOrTransaction } from "../db/index.ts";
import { and, eq, gte, inArray, or, sql } from "../db/query.ts";
import { contributions, goalPeriods, goals } from "../db/schema/contributions.ts";
import { subscriptions } from "../db/schema/notifications.ts";
import { dateInTimeZone } from "./dates.ts";
import { type GoalContribution, measure, goalPeriods as periodsOf } from "./goals.ts";

export interface AchievedPeriod {
  goalId: string;
  periodStart: string;
}

/**
 * Recomputes the progress of a user's active goals (or some of them) over each of their periods,
 * from counted contributions (PLAN.md §4.5). A period reaching its target records `achieved_at`
 * once; it stays achieved even if a recount lowers the progress later. Returns the periods
 * achieved by this call, for congratulation emails.
 */
export async function refreshGoalProgress(
  db: DatabaseOrTransaction,
  userId: string,
  now: Date,
  goalIds?: string[],
): Promise<AchievedPeriod[]> {
  const today = dateInTimeZone(now, "UTC");
  const active = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.userId, userId),
        eq(goals.status, "active"),
        goalIds ? inArray(goals.id, goalIds) : undefined,
      ),
    );
  const planned = active
    .map((goal) => ({ goal, periods: periodsOf(goal, today) }))
    .filter(({ periods }) => periods.length > 0);
  if (planned.length === 0) return [];

  const earliest = planned.map(({ periods }) => periods[0]?.start ?? today).sort()[0] ?? today;
  const rows = await db
    .select({
      kind: contributions.kind,
      date: contributions.date,
      count: contributions.count,
      prMergedAt: contributions.prMergedAt,
      repoId: contributions.repoId,
    })
    .from(contributions)
    .where(
      and(
        eq(contributions.userId, userId),
        eq(contributions.counted, true),
        // Pull requests merged in a period may have been opened before it.
        or(
          gte(contributions.date, earliest),
          gte(contributions.prMergedAt, new Date(`${earliest}T00:00:00Z`)),
        ),
      ),
    );
  const items: GoalContribution[] = rows.map((row) => ({
    ...row,
    mergedOn: row.prMergedAt ? dateInTimeZone(row.prMergedAt, "UTC") : null,
  }));

  const subscribed = planned.some(({ goal }) => goal.repoScope === "subscribed")
    ? new Set(
        (
          await db
            .select({ repoId: subscriptions.repoId })
            .from(subscriptions)
            .where(eq(subscriptions.userId, userId))
        ).map((row) => row.repoId),
      )
    : new Set<string>();

  const previouslyAchieved = new Set(
    (
      await db
        .select({ goalId: goalPeriods.goalId, periodStart: goalPeriods.periodStart })
        .from(goalPeriods)
        .where(
          and(
            inArray(
              goalPeriods.goalId,
              planned.map(({ goal }) => goal.id),
            ),
            sql`${goalPeriods.achievedAt} is not null`,
          ),
        )
    ).map((row) => `${row.goalId}|${row.periodStart}`),
  );

  const values = planned.flatMap(({ goal, periods }) => {
    const scoped = items.filter((item) =>
      goal.repoScope === "repo"
        ? item.repoId === goal.repoId
        : goal.repoScope === "subscribed"
          ? item.repoId !== null && subscribed.has(item.repoId)
          : true,
    );
    return periods.map((period) => {
      const progress = measure(goal.metric, scoped, period);
      return {
        goalId: goal.id,
        periodStart: period.start,
        periodEnd: period.end,
        progress,
        achievedAt: progress >= goal.target ? now : null,
      };
    });
  });

  await db
    .insert(goalPeriods)
    .values(values)
    .onConflictDoUpdate({
      target: [goalPeriods.goalId, goalPeriods.periodStart],
      set: {
        periodEnd: sql`excluded.period_end`,
        progress: sql`excluded.progress`,
        achievedAt: sql`coalesce(${goalPeriods.achievedAt}, excluded.achieved_at)`,
      },
    });

  return values
    .filter(
      (value) =>
        value.achievedAt !== null &&
        !previouslyAchieved.has(`${value.goalId}|${value.periodStart}`),
    )
    .map(({ goalId, periodStart }) => ({ goalId, periodStart }));
}
