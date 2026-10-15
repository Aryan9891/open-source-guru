import { and, eq } from "@osg/core/db/query";
import { contributionSyncs } from "@osg/core/db/schema";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ApiContext } from "../context.ts";
import { currentUser, requireUser } from "../plugins/authenticate.ts";

/** A sync can be requested again once the last one is this old (PLAN.md §4.2). */
export const SYNC_COOLDOWN_MS = 15 * 60 * 1000;

export const contributionRoutes =
  (ctx: ApiContext): FastifyPluginAsyncZod =>
  async (app) => {
    const tags = ["Contributions"];
    app.addHook("preHandler", requireUser(ctx));

    app.post(
      "/v1/me/sync",
      {
        schema: {
          tags,
          summary: "Refresh your contributions from GitHub",
          description:
            "Asks for this year's contributions to be fetched again, within a minute or so. Ignored when the last refresh is less than 15 minutes old or one is already on its way.",
          response: {
            202: z.object({
              requested: z
                .boolean()
                .describe("False when a recent or pending sync makes it unnecessary"),
              lastSyncedAt: z.date().nullable(),
            }),
          },
        },
      },
      async (request, reply) => {
        const userId = currentUser(request).id;
        const now = ctx.now();
        const year = now.getUTCFullYear();
        const sync = await ctx.db.query.contributionSyncs.findFirst({
          where: and(eq(contributionSyncs.userId, userId), eq(contributionSyncs.year, year)),
        });
        const lastSyncedAt = sync?.lastSyncedAt ?? null;
        const recent =
          lastSyncedAt !== null && now.getTime() - lastSyncedAt.getTime() < SYNC_COOLDOWN_MS;
        const onItsWay = sync?.status === "pending" || sync?.status === "running";
        if (recent || onItsWay) return reply.code(202).send({ requested: false, lastSyncedAt });

        // The worker's scheduler picks pending syncs up every minute.
        await ctx.db
          .insert(contributionSyncs)
          .values({ userId, year, status: "pending" })
          .onConflictDoUpdate({
            target: [contributionSyncs.userId, contributionSyncs.year],
            set: { status: "pending" },
          });
        return reply.code(202).send({ requested: true, lastSyncedAt });
      },
    );
  };
