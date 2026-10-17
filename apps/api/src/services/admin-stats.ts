// Platform-wide numbers for the admin dashboard's overview.
import { addDays, dateInTimeZone } from "@osg/core/contributions/dates";
import { count, countDistinct, desc, eq, gte, sql, sum } from "@osg/core/db/query";
import {
  apikeys,
  contributions,
  deliveries,
  events,
  goals,
  notificationChannels,
  repositories,
  subscriptions,
  users,
} from "@osg/core/db/schema";
import { z } from "zod";
import type { ApiContext } from "../context.ts";
import { followedLabels, labelResponse } from "./admin-lists.ts";

/** Days in the sign-ups chart, today included. */
export const SIGNUP_DAYS = 30;
const TOP = 5;

const deliveryStatus = z.enum(["pending", "sent", "failed", "skipped"]);

export const adminStatsResponse = z.object({
  users: z.object({
    total: z.number().int(),
    admins: z.number().int(),
    publicProfiles: z.number().int(),
    newLast7Days: z.number().int(),
    newLast30Days: z.number().int(),
  }),
  signupsByDay: z
    .array(z.object({ date: z.string(), count: z.number().int() }))
    .describe(`The last ${SIGNUP_DAYS} days (UTC), oldest first`),
  repositories: z.object({
    total: z.number().int(),
    active: z.number().int(),
    followed: z.number().int().describe("With subscriptions: polled for issues"),
    fromContributions: z
      .number()
      .int()
      .describe("Without subscriptions, stored to classify contributions"),
    openSource: z.number().int(),
    withPollError: z.number().int(),
  }),
  subscriptions: z.object({ total: z.number().int(), active: z.number().int() }),
  channels: z.object({ total: z.number().int(), active: z.number().int() }),
  events: z.object({ total: z.number().int(), last7Days: z.number().int() }),
  deliveries: z.record(deliveryStatus, z.number().int()),
  contributions: z.number().int().describe("Open Source Contributions counted, all users"),
  activeGoals: z.number().int(),
  apiKeys: z.number().int(),
  topRepositories: z.array(z.object({ fullName: z.string(), subscribers: z.number().int() })),
  topLabels: z.array(labelResponse),
});

export type AdminStats = z.infer<typeof adminStatsResponse>;

const FOLLOWED = `exists (select 1 from subscriptions s where s.repo_id = "repositories"."id")`;
const CONTRIBUTED = `exists (select 1 from contributions c where c.repo_id = "repositories"."id")`;

const countWhere = (condition: ReturnType<typeof sql>) =>
  sql<number>`count(*) filter (where ${condition})`.mapWith(Number);

export async function computeAdminStats(ctx: ApiContext): Promise<AdminStats> {
  const { db } = ctx;
  const now = ctx.now();
  const today = dateInTimeZone(now, "UTC");
  const firstDay = addDays(today, 1 - SIGNUP_DAYS);
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const signupDay = sql<string>`to_char(${users.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;

  const [
    [userCounts],
    signups,
    [repoCounts],
    [subscriptionCounts],
    [channelCounts],
    [eventCounts],
    deliveryCounts,
    [contributionTotal],
    [goalCount],
    [apiKeyCount],
    topRepositories,
    topLabels,
  ] = await Promise.all([
    db
      .select({
        total: count(),
        admins: countWhere(sql`${users.role} = 'admin'`),
        publicProfiles: countWhere(sql`${users.profilePublic}`),
        newLast7Days: countWhere(sql`${users.createdAt} >= ${daysAgo(7)}`),
        newLast30Days: countWhere(sql`${users.createdAt} >= ${daysAgo(30)}`),
      })
      .from(users),
    db
      .select({ date: signupDay, count: count() })
      .from(users)
      .where(gte(users.createdAt, new Date(`${firstDay}T00:00:00Z`)))
      .groupBy(signupDay),
    db
      .select({
        total: count(),
        active: countWhere(sql`${repositories.status} = 'active'`),
        // Written out: Drizzle leaves out table names in single-table selects.
        followed: countWhere(sql.raw(FOLLOWED)),
        fromContributions: countWhere(sql.raw(`not ${FOLLOWED} and ${CONTRIBUTED}`)),
        openSource: countWhere(sql`${repositories.isOpenSource}`),
        withPollError: countWhere(sql`${repositories.lastPollError} is not null`),
      })
      .from(repositories),
    db
      .select({ total: count(), active: countWhere(sql`${subscriptions.status} = 'active'`) })
      .from(subscriptions),
    db
      .select({
        total: count(),
        active: countWhere(sql`${notificationChannels.status} = 'active'`),
      })
      .from(notificationChannels),
    db
      .select({ total: count(), last7Days: countWhere(sql`${events.createdAt} >= ${daysAgo(7)}`) })
      .from(events),
    db
      .select({ status: deliveries.status, count: count() })
      .from(deliveries)
      .groupBy(deliveries.status),
    db
      .select({ value: sum(contributions.count).mapWith(Number) })
      .from(contributions)
      .where(eq(contributions.counted, true)),
    db.select({ value: count() }).from(goals).where(eq(goals.status, "active")),
    db.select({ value: count() }).from(apikeys),
    db
      .select({
        owner: repositories.owner,
        name: repositories.name,
        subscribers: countDistinct(subscriptions.userId),
      })
      .from(subscriptions)
      .innerJoin(repositories, eq(repositories.id, subscriptions.repoId))
      .groupBy(repositories.id)
      .orderBy(desc(countDistinct(subscriptions.userId)), repositories.owner, repositories.name)
      .limit(TOP),
    followedLabels(ctx, { limit: TOP }),
  ]);

  const signupsOn = new Map(signups.map((row) => [row.date, row.count]));
  const zero = { total: 0, active: 0 };

  return {
    users: userCounts ?? {
      total: 0,
      admins: 0,
      publicProfiles: 0,
      newLast7Days: 0,
      newLast30Days: 0,
    },
    signupsByDay: Array.from({ length: SIGNUP_DAYS }, (_, index) => {
      const date = addDays(firstDay, index);
      return { date, count: signupsOn.get(date) ?? 0 };
    }),
    repositories: repoCounts ?? {
      total: 0,
      active: 0,
      followed: 0,
      fromContributions: 0,
      openSource: 0,
      withPollError: 0,
    },
    subscriptions: subscriptionCounts ?? zero,
    channels: channelCounts ?? zero,
    events: eventCounts ?? { total: 0, last7Days: 0 },
    deliveries: Object.fromEntries(
      deliveryStatus.options.map((status) => [
        status,
        deliveryCounts.find((row) => row.status === status)?.count ?? 0,
      ]),
    ) as AdminStats["deliveries"],
    contributions: contributionTotal?.value ?? 0,
    activeGoals: goalCount?.value ?? 0,
    apiKeys: apiKeyCount?.value ?? 0,
    topRepositories: topRepositories.map((repo) => ({
      fullName: `${repo.owner}/${repo.name}`,
      subscribers: repo.subscribers,
    })),
    topLabels: topLabels.items,
  };
}
