import { eq } from "@osg/core/db/query";
import { users } from "@osg/core/db/schema";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { ApiContext } from "../context.ts";
import { notFound } from "../errors.ts";
import { currentUser, requireUser } from "../plugins/authenticate.ts";
import { periodQuery } from "../services/contributions.ts";
import { computeStats, statsResponse } from "../services/stats.ts";

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
          response: { 200: statsResponse },
        },
      },
      async (request) => {
        const user = await ctx.db.query.users.findFirst({
          where: eq(users.id, currentUser(request).id),
        });
        if (!user) throw notFound("User");
        return computeStats(ctx, user, request.query.year);
      },
    );
  };
