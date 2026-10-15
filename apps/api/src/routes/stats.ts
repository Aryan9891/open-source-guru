import { addDays } from "@osg/core/contributions/dates";
import { currentStreakAsOf, type Streak } from "@osg/core/contributions/streaks";
import { and, asc, desc, eq, gte, lt, sum } from "@osg/core/db/query";
import {
  contributionDays,
  contributionSyncs,
  contributions,
  repositories,
  type StreakPeriod,
  userStreaks,
  users,
} from "@osg/core/db/schema";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ApiContext } from "../context.ts";
import { notFound } from "../errors.ts";
import { currentUser, requireUser } from "../plugins/authenticate.ts";
import {
  contributionKind,
  contributionsIn,
  daysIn,
  githubToday,
  periodFor,
  periodQuery,
  periodResponse,
  repoResponse,
  toRepo,
} from "../services/contributions.ts";

const streakResponse = z.object({
  current: z.number().int(),
  longest: z.number().int(),
  currentStart: z.string().nullable(),
  lastCountedPeriod: z.string().nullable(),
});

const toStreak = (streak: Streak) => ({
  current: streak.currentLength,
  longest: streak.longestLength,
  currentStart: streak.currentStart,
  lastCountedPeriod: streak.lastCountedPeriod,
});

const NO_STREAK: Streak = {
  currentLength: 0,
  longestLength: 0,
  currentStart: null,
  lastCountedPeriod: null,
};

/** Repositories and merged pull requests listed under the graph. */
const TOP_REPOS = 10;
const RECENT_MERGED_PRS = 5;

export const statsRoutes =
  (ctx: ApiContext): FastifyPluginAsyncZod =>
  async (app) => {
    app.get(
      "/v1/me/stats",
      {
        preHandler: requireUser(ctx),
        schema: {
          tags: ["Contributions"],
          summary: "Your Open Source Contributions at a glance",
          description:
            "Totals, the daily graph, breakdowns by type and repository, recent merged pull requests, streaks and the years available. Only Open Source Contributions count: public, OSI-licensed repositories you don't own.",
          querystring: periodQuery,
          response: {
            200: z.object({
              period: periodResponse,
              total: z.number().int(),
              days: z.array(z.object({ date: z.string(), count: z.number().int() })),
              byKind: z.record(contributionKind, z.number().int()),
              byRepo: z.array(repoResponse.extend({ count: z.number().int() })),
              mergedPullRequests: z.array(
                z.object({
                  title: z.string().nullable(),
                  url: z.string().nullable(),
                  repo: repoResponse,
                  mergedAt: z.date(),
                }),
              ),
              streaks: z.object({
                period: z.enum(["week", "day"]).describe("The period chosen in Settings"),
                week: streakResponse,
                day: streakResponse,
              }),
              years: z.array(z.number().int()).describe("Newest first"),
              lastSyncedAt: z.date().nullable(),
            }),
          },
        },
      },
      async (request) => {
        const { id: userId } = currentUser(request);
        const { db } = ctx;
        const period = periodFor(ctx, request.query.year);
        const counted = and(contributionsIn(userId, period), eq(contributions.counted, true));
        const total = sum(contributions.count).mapWith(Number);

        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user) throw notFound("User");

        const [days, kinds, repos, merged, streaks, syncs] = await Promise.all([
          db
            .select({ date: contributionDays.date, count: contributionDays.count })
            .from(contributionDays)
            .where(daysIn(userId, period))
            .orderBy(asc(contributionDays.date)),
          db
            .select({ kind: contributions.kind, count: total })
            .from(contributions)
            .where(counted)
            .groupBy(contributions.kind),
          db
            .select({
              owner: repositories.owner,
              name: repositories.name,
              licenseSpdxId: repositories.licenseSpdxId,
              count: total,
            })
            .from(contributions)
            .innerJoin(repositories, eq(repositories.id, contributions.repoId))
            .where(counted)
            .groupBy(repositories.id)
            .orderBy(desc(total), asc(repositories.owner), asc(repositories.name))
            .limit(TOP_REPOS),
          db
            .select({
              title: contributions.title,
              url: contributions.url,
              mergedAt: contributions.prMergedAt,
              owner: repositories.owner,
              name: repositories.name,
              licenseSpdxId: repositories.licenseSpdxId,
            })
            .from(contributions)
            .innerJoin(repositories, eq(repositories.id, contributions.repoId))
            .where(
              and(
                eq(contributions.userId, userId),
                eq(contributions.counted, true),
                eq(contributions.prState, "merged"),
                gte(contributions.prMergedAt, new Date(`${period.from}T00:00:00Z`)),
                lt(contributions.prMergedAt, new Date(`${addDays(period.to, 1)}T00:00:00Z`)),
              ),
            )
            .orderBy(desc(contributions.prMergedAt))
            .limit(RECENT_MERGED_PRS),
          db.select().from(userStreaks).where(eq(userStreaks.userId, userId)),
          db
            .select({ year: contributionSyncs.year, lastSyncedAt: contributionSyncs.lastSyncedAt })
            .from(contributionSyncs)
            .where(eq(contributionSyncs.userId, userId)),
        ]);

        const today = githubToday(ctx);
        const streakFor = (period: StreakPeriod) => {
          const stored = streaks.find((row) => row.period === period);
          return toStreak(currentStreakAsOf(stored ?? NO_STREAK, period, today));
        };
        const currentYear = Number(today.slice(0, 4));
        const years = [...new Set([currentYear, ...syncs.map((row) => row.year)])].sort(
          (a, b) => b - a,
        );
        const synced = syncs.flatMap((row) => (row.lastSyncedAt ? [row.lastSyncedAt] : []));

        return {
          period,
          total: days.reduce((sum, day) => sum + day.count, 0),
          days,
          byKind: Object.fromEntries(
            contributionKind.options.map((kind) => [
              kind,
              kinds.find((row) => row.kind === kind)?.count ?? 0,
            ]),
          ) as Record<z.infer<typeof contributionKind>, number>,
          byRepo: repos.map((repo) => ({ ...toRepo(repo), count: repo.count })),
          mergedPullRequests: merged.flatMap((pr) =>
            pr.mergedAt
              ? [{ title: pr.title, url: pr.url, repo: toRepo(pr), mergedAt: pr.mergedAt }]
              : [],
          ),
          streaks: { period: user.streakPeriod, week: streakFor("week"), day: streakFor("day") },
          years,
          lastSyncedAt: synced.length ? new Date(Math.max(...synced.map(Number))) : null,
        };
      },
    );
  };
