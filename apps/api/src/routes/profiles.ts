import { currentStreakAsOf } from "@osg/core/contributions/streaks";
import { and, asc, desc, eq, inArray, sql, sum } from "@osg/core/db/query";
import {
  contributionDays,
  goalPeriods,
  goals,
  repositories,
  userStreaks,
  users,
} from "@osg/core/db/schema";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ApiContext } from "../context.ts";
import { notFound } from "../errors.ts";
import { badgeMessage, renderBadge } from "../services/badge.ts";
import { daysIn, githubToday, periodFor, periodQuery } from "../services/contributions.ts";
import { computeStats, statsResponse } from "../services/stats.ts";

/** Badges are cached for an hour (GitHub's image proxy caches them too). */
const BADGE_CACHE = "public, max-age=3600";
const BADGE_LABEL = "Open Source Guru";
const loginParams = z.object({ login: z.string().regex(/^[A-Za-z0-9-]{1,39}$/) });

const findPublicUser = async (ctx: ApiContext, login: string) => {
  const user = await ctx.db.query.users.findFirst({
    where: eq(sql`lower(${users.login})`, login.toLowerCase()),
  });
  return user?.profilePublic ? user : null;
};

const publicGoal = z.object({
  id: z.string(),
  metric: z.string(),
  target: z.number().int(),
  recurrence: z.enum(["none", "weekly", "monthly"]),
  endsOn: z.string().nullable(),
  repoScope: z.enum(["all", "subscribed", "repo"]),
  repo: z.object({ fullName: z.string(), url: z.string() }).nullable(),
  current: z
    .object({
      start: z.string(),
      end: z.string(),
      progress: z.number().int(),
      achievedAt: z.date().nullable(),
    })
    .nullable(),
});

/**
 * Public profiles: only data GitHub already shows publicly, never emails,
 * subscriptions or what wasn't counted. Not cached, so turning a profile off is immediate.
 */
export const profileRoutes =
  (ctx: ApiContext): FastifyPluginAsyncZod =>
  async (app) => {
    app.get(
      "/v1/public/profiles/:login",
      {
        schema: {
          tags: ["Public"],
          security: [],
          summary: "A public profile",
          description:
            "Open Source Contributions, streaks and public goals of a user. 404 when the user doesn't exist or turned their profile off.",
          params: loginParams,
          querystring: periodQuery,
          response: {
            200: z.object({
              login: z.string(),
              name: z.string(),
              avatarUrl: z.string().nullable(),
              bio: z.string().nullable(),
              githubUrl: z.string(),
              stats: statsResponse,
              goals: z.array(publicGoal),
            }),
          },
        },
      },
      async (request, reply) => {
        const user = await findPublicUser(ctx, request.params.login);
        if (!user) throw notFound("Profile");

        const [stats, rows] = await Promise.all([
          computeStats(ctx, user, request.query.year),
          ctx.db
            .select({ goal: goals, owner: repositories.owner, name: repositories.name })
            .from(goals)
            .leftJoin(repositories, eq(repositories.id, goals.repoId))
            .where(
              and(eq(goals.userId, user.id), eq(goals.isPublic, true), eq(goals.status, "active")),
            )
            .orderBy(desc(goals.createdAt)),
        ]);
        const periods =
          rows.length === 0
            ? []
            : await ctx.db
                .select()
                .from(goalPeriods)
                .where(
                  inArray(
                    goalPeriods.goalId,
                    rows.map((row) => row.goal.id),
                  ),
                )
                .orderBy(asc(goalPeriods.periodStart));

        reply.header("cache-control", "no-store");
        return {
          login: user.login,
          name: user.name,
          avatarUrl: user.image,
          bio: user.bio,
          githubUrl: `https://github.com/${user.login}`,
          stats,
          goals: rows.map(({ goal, owner, name }) => {
            const current = periods.filter((period) => period.goalId === goal.id).at(-1);
            return {
              id: goal.id,
              metric: goal.metric,
              target: goal.target,
              recurrence: goal.recurrence,
              endsOn: goal.endsOn,
              repoScope: goal.repoScope,
              repo:
                owner && name
                  ? { fullName: `${owner}/${name}`, url: `https://github.com/${owner}/${name}` }
                  : null,
              current: current
                ? {
                    start: current.periodStart,
                    end: current.periodEnd,
                    progress: current.progress,
                    achievedAt: current.achievedAt,
                  }
                : null,
            };
          }),
        };
      },
    );

    app.get(
      "/v1/public/profiles/:login/badge.svg",
      {
        schema: {
          tags: ["Public"],
          security: [],
          summary: "README badge",
          description:
            'An SVG badge with the Open Source Contributions of the last 12 months and the current streak. Cached for an hour. A grey "not available" badge (404) when the profile doesn\'t exist or is off.',
          params: loginParams,
          querystring: z.object({
            color: z
              .string()
              .optional()
              .describe("Background color of the message side (hex or CSS name)"),
            size: z
              .string()
              .optional()
              .describe("Badge size: small (default), medium, large, or height in pixels (15-100)"),
          }),
        },
      },
      async (request, reply) => {
        reply
          .type("image/svg+xml; charset=utf-8")
          .header("cache-control", BADGE_CACHE)
          // Embedded on other sites (READMEs, blogs): allow cross-origin loading.
          .header("cross-origin-resource-policy", "cross-origin");
        const { color, size } = request.query;
        const options = { color, size };
        const user = await findPublicUser(ctx, request.params.login);
        if (!user) {
          // An image, not JSON: READMEs show it instead of a broken image.
          return reply.code(404).send(renderBadge(BADGE_LABEL, "not available", true, options));
        }

        const period = periodFor(ctx, undefined);
        const [[days], [stored]] = await Promise.all([
          ctx.db
            .select({ total: sum(contributionDays.count).mapWith(Number) })
            .from(contributionDays)
            .where(daysIn(user.id, period)),
          ctx.db
            .select()
            .from(userStreaks)
            .where(and(eq(userStreaks.userId, user.id), eq(userStreaks.period, user.streakPeriod))),
        ]);
        const streak = stored
          ? currentStreakAsOf(stored, user.streakPeriod, githubToday(ctx)).currentLength
          : 0;
        return renderBadge(
          BADGE_LABEL,
          badgeMessage(days?.total ?? 0, { length: streak, period: user.streakPeriod }),
          false,
          options,
        );
      },
    );
  };
