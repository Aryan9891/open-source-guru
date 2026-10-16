// Opt-in motivation emails: streak reminders and goals achieved.
import { addDays, dateInTimeZone, daysBetween, weekStart } from "@osg/core/contributions/dates";
import type { AchievedPeriod } from "@osg/core/contributions/goal-progress";
import { describeGoal, describePeriod } from "@osg/core/contributions/goals";
import { and, asc, eq, inArray } from "@osg/core/db/query";
import {
  contributionSyncs,
  goalPeriods,
  goals,
  notificationChannels,
  repositories,
  userStreaks,
  users,
} from "@osg/core/db/schema";
import type { EmailPreference } from "@osg/core/tokens";
import { renderGoalAchievedEmail, renderStreakReminderEmail } from "@osg/emails";
import type { WorkerContext } from "../context.ts";

/** Reminders go out in the evening, user's time (18:00–21:59), Fridays for weekly streaks. */
export const REMINDER_HOURS = [18, 19, 20, 21];
/** A reminder waits for contributions synced this recently, so it isn't sent by mistake. */
export const FRESH_SYNC_MS = 60 * 60 * 1000;
/** Goal periods that ended longer ago than this aren't celebrated by email. */
const RECENT_DAYS = 7;

/** The user's first active email address: bounced or unsubscribed ones are skipped. */
async function recipient(ctx: WorkerContext, userId: string): Promise<string | null> {
  const [channel] = await ctx.db
    .select({ config: notificationChannels.config })
    .from(notificationChannels)
    .where(
      and(
        eq(notificationChannels.userId, userId),
        eq(notificationChannels.type, "email"),
        eq(notificationChannels.status, "active"),
      ),
    )
    .orderBy(asc(notificationChannels.createdAt))
    .limit(1);
  return channel?.config.address ?? null;
}

const pages = (ctx: WorkerContext) => ({
  settingsUrl: `${ctx.links.dashboard}/settings`,
  goalsUrl: `${ctx.links.dashboard}/goals`,
  contributionsUrl: `${ctx.links.dashboard}/contributions`,
});

async function send(
  ctx: WorkerContext,
  to: string,
  userId: string,
  preference: EmailPreference,
  email: { subject: string; html: string; text: string },
) {
  const stopUrl = ctx.links.stopEmails(userId, preference);
  await ctx.mailer.send({
    to,
    ...email,
    headers: {
      "List-Unsubscribe": `<${stopUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

/** Congratulates on goal periods achieved just now (recent ones), when goal emails are on. */
export async function sendGoalAchievedEmail(
  ctx: WorkerContext,
  userId: string,
  achieved: AchievedPeriod[],
): Promise<boolean> {
  if (achieved.length === 0) return false;
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.goalEmails) return false;
  const to = await recipient(ctx, userId);
  if (!to) return false;

  const today = dateInTimeZone(ctx.now(), "UTC");
  const rows = await ctx.db
    .select({
      goal: goals,
      period: goalPeriods,
      owner: repositories.owner,
      name: repositories.name,
    })
    .from(goalPeriods)
    .innerJoin(goals, eq(goals.id, goalPeriods.goalId))
    .leftJoin(repositories, eq(repositories.id, goals.repoId))
    .where(
      inArray(
        goalPeriods.goalId,
        achieved.map((item) => item.goalId),
      ),
    );
  const list = achieved.flatMap(({ goalId, periodStart }) => {
    const row = rows.find((r) => r.goal.id === goalId && r.period.periodStart === periodStart);
    if (!row || daysBetween(row.period.periodEnd, today) > RECENT_DAYS) return [];
    return [
      {
        title: describeGoal({
          ...row.goal,
          repoFullName: row.owner && row.name ? `${row.owner}/${row.name}` : null,
        }),
        progress: row.period.progress,
        target: row.goal.target,
        periodLabel: describePeriod(row.goal.recurrence, {
          start: row.period.periodStart,
          end: row.period.periodEnd,
        }),
      },
    ];
  });
  if (list.length === 0) return false;

  const { settingsUrl, goalsUrl } = pages(ctx);
  const stopUrl = ctx.links.stopEmails(userId, "goalEmails");
  const email = await renderGoalAchievedEmail({
    goals: list,
    goalsUrl,
    settingsUrl,
    stopUrl,
    logoUrl: ctx.links.logo,
  });
  await send(ctx, to, userId, "goalEmails", email);
  return true;
}

/**
 * Hourly: reminds users who opted in when their streak needs a contribution in the current
 * period (none yet, the previous one counted). Weekly streaks on Friday evening, daily ones
 * every evening, user's time; once per period. Waits for a fresh sync (requesting one).
 */
export async function sendStreakReminders(ctx: WorkerContext): Promise<{ sent: number }> {
  const now = ctx.now();
  const today = dateInTimeZone(now, "UTC");
  const rows = await ctx.db
    .select({ user: users, streak: userStreaks, sync: contributionSyncs })
    .from(users)
    .innerJoin(
      userStreaks,
      and(eq(userStreaks.userId, users.id), eq(userStreaks.period, users.streakPeriod)),
    )
    .leftJoin(
      contributionSyncs,
      and(
        eq(contributionSyncs.userId, users.id),
        eq(contributionSyncs.year, Number(today.slice(0, 4))),
      ),
    )
    .where(eq(users.streakReminders, true));

  let sent = 0;
  for (const { user, streak, sync } of rows) {
    const period = user.streakPeriod;
    const local = new Intl.DateTimeFormat("en-US", {
      timeZone: user.timezone,
      weekday: "short",
      hour: "numeric",
      hourCycle: "h23",
    }).formatToParts(now);
    const hour = Number(local.find((part) => part.type === "hour")?.value);
    const weekday = local.find((part) => part.type === "weekday")?.value;
    if (!REMINDER_HOURS.includes(hour) || (period === "week" && weekday !== "Fri")) continue;

    const current = period === "week" ? weekStart(today) : today;
    const previous = addDays(current, period === "week" ? -7 : -1);
    const needsOne =
      streak.currentLength > 0 &&
      streak.lastCountedPeriod === previous &&
      streak.reminderSentFor !== current;
    if (!needsOne) continue;

    // Contributions made today may not be synced yet: ask for a sync, try next hour.
    if (!sync?.lastSyncedAt || now.getTime() - sync.lastSyncedAt.getTime() > FRESH_SYNC_MS) {
      if (sync?.status === "done") {
        await ctx.db
          .update(contributionSyncs)
          .set({ status: "pending" })
          .where(and(eq(contributionSyncs.userId, user.id), eq(contributionSyncs.year, sync.year)));
      }
      continue;
    }

    const to = await recipient(ctx, user.id);
    if (!to) continue;
    const { settingsUrl, contributionsUrl } = pages(ctx);
    const email = await renderStreakReminderEmail({
      period,
      length: streak.currentLength,
      contributionsUrl,
      settingsUrl,
      stopUrl: ctx.links.stopEmails(user.id, "streakReminders"),
      logoUrl: ctx.links.logo,
    });
    await send(ctx, to, user.id, "streakReminders", email);
    await ctx.db
      .update(userStreaks)
      .set({ reminderSentFor: current })
      .where(and(eq(userStreaks.userId, user.id), eq(userStreaks.period, period)));
    sent++;
  }
  return { sent };
}
