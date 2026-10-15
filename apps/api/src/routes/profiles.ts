import { and, asc, desc, eq, inArray, sql } from "@osg/core/db/query";
import { goalPeriods, goals, repositories, users } from "@osg/core/db/schema";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ApiContext } from "../context.ts";
import { notFound } from "../errors.ts";
import { periodQuery } from "../services/contributions.ts";
import { computeStats, statsResponse } from "../services/stats.ts";

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
 * Public profiles (PLAN.md §4.6): only data GitHub already shows publicly, never emails,
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
          params: z.object({ login: z.string().regex(/^[A-Za-z0-9-]{1,39}$/) }),
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
        const user = await ctx.db.query.users.findFirst({
          where: eq(sql`lower(${users.login})`, request.params.login.toLowerCase()),
        });
        if (!user?.profilePublic) throw notFound("Profile");

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
  };
