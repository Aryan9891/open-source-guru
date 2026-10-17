import { and, desc, eq, inArray, isNull, lt, ne, or, sql } from "@osg/core/db/query";
import {
  deliveries,
  events,
  issueSnapshots,
  repositories,
  subscriptions,
} from "@osg/core/db/schema";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ApiContext } from "../context.ts";
import { currentUser, requireUser } from "../plugins/authenticate.ts";

const feedItem = z.object({
  eventId: z.string(),
  type: z.enum(["issue.opened", "issue.labeled"]),
  label: z.string().nullable(),
  occurredAt: z.date(),
  repo: z.object({ fullName: z.string(), url: z.string() }),
  issue: z.object({
    number: z.number().int(),
    title: z.string(),
    url: z.string(),
    /** Current state on GitHub (from the latest poll). */
    state: z.enum(["open", "closed"]),
    labels: z.array(z.string()),
    assignees: z.array(z.string()),
  }),
});

export const feedRoutes =
  (ctx: ApiContext): FastifyPluginAsyncZod =>
  async (app) => {
    app.get(
      "/v1/me/feed",
      {
        preHandler: requireUser(ctx),
        schema: {
          tags: ["Feed"],
          summary: "Issues that matched your subscriptions, newest first",
          querystring: z.object({
            limit: z.coerce.number().int().min(1).max(100).default(30),
            before: z.coerce.date().optional().describe("Return items detected before this time"),
          }),
          response: {
            200: z.object({ items: z.array(feedItem), nextBefore: z.date().nullable() }),
          },
        },
      },
      async (request) => {
        const { limit, before } = request.query;
        const matched = ctx.db
          .selectDistinct({ eventId: deliveries.eventId })
          .from(deliveries)
          .innerJoin(subscriptions, eq(subscriptions.id, deliveries.subscriptionId))
          .where(eq(subscriptions.userId, currentUser(request).id));

        const rows = await ctx.db
          .select({
            event: events,
            owner: repositories.owner,
            name: repositories.name,
            snapshot: issueSnapshots,
          })
          .from(events)
          .innerJoin(repositories, eq(repositories.id, events.repoId))
          .leftJoin(
            issueSnapshots,
            and(
              eq(issueSnapshots.repoId, events.repoId),
              eq(issueSnapshots.issueNumber, events.issueNumber),
            ),
          )
          .where(
            and(
              inArray(events.id, matched),
              before ? lt(events.createdAt, before) : undefined,
              or(isNull(issueSnapshots.state), ne(issueSnapshots.state, "closed")),
            ),
          )
          .orderBy(desc(events.createdAt), desc(sql`${events.id}`))
          .limit(limit + 1);

        const items = rows.slice(0, limit).map(({ event, owner, name, snapshot }) => ({
          eventId: event.id,
          type: event.type,
          label: event.label,
          occurredAt: event.occurredAt,
          repo: { fullName: `${owner}/${name}`, url: `https://github.com/${owner}/${name}` },
          issue: {
            number: event.issueNumber,
            title: snapshot?.title ?? event.issue.title,
            url: snapshot?.htmlUrl ?? event.issue.htmlUrl,
            state: snapshot?.state ?? "open",
            labels: (snapshot?.labels ?? event.issue.labels).map((label) => label.name),
            assignees: snapshot?.assignees ?? event.issue.assignees,
          },
        }));
        const last = rows[limit - 1];
        return { items, nextBefore: rows.length > limit && last ? last.event.createdAt : null };
      },
    );
  };
