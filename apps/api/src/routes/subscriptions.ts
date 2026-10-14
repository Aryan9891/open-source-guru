import { and, asc, count, eq, inArray } from "@osg/core/db/query";
import {
  notificationChannels,
  repositories,
  subscriptionChannels,
  subscriptions,
} from "@osg/core/db/schema";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ApiContext } from "../context.ts";
import { ApiError, notFound } from "../errors.ts";
import { currentUser, requireUser } from "../plugins/authenticate.ts";
import { parseRepoReference, resolveRepository } from "../services/repositories.ts";

export const MAX_SUBSCRIPTIONS_PER_USER = 50;

const eventType = z.enum(["issue.opened", "issue.labeled"]);
const frequency = z.enum(["instant", "hourly", "daily"]);
const channelLink = z.object({ channelId: z.uuid(), frequency });

const subscriptionResponse = z.object({
  id: z.string(),
  repo: z.object({ fullName: z.string(), url: z.string() }),
  events: z.array(eventType),
  labels: z.array(z.string()),
  labelMatch: z.enum(["any", "all"]),
  status: z.enum(["active", "paused"]),
  channels: z.array(channelLink),
  createdAt: z.date(),
});

const labelsSchema = z
  .array(z.string().trim().min(1).max(100))
  .max(20)
  .transform((labels) => [...new Set(labels)]);

const idParams = z.object({ id: z.uuid() });

export const subscriptionRoutes =
  (ctx: ApiContext): FastifyPluginAsyncZod =>
  async (app) => {
    const tags = ["Subscriptions"];
    app.addHook("preHandler", requireUser(ctx));

    async function load(userId: string, ids?: string[]) {
      const rows = await ctx.db
        .select({ subscription: subscriptions, owner: repositories.owner, name: repositories.name })
        .from(subscriptions)
        .innerJoin(repositories, eq(repositories.id, subscriptions.repoId))
        .where(
          and(eq(subscriptions.userId, userId), ids ? inArray(subscriptions.id, ids) : undefined),
        )
        .orderBy(asc(subscriptions.createdAt));
      const links =
        rows.length === 0
          ? []
          : await ctx.db
              .select()
              .from(subscriptionChannels)
              .where(
                inArray(
                  subscriptionChannels.subscriptionId,
                  rows.map((row) => row.subscription.id),
                ),
              );
      return rows.map(({ subscription, owner, name }) => ({
        id: subscription.id,
        repo: { fullName: `${owner}/${name}`, url: `https://github.com/${owner}/${name}` },
        events: subscription.eventTypes,
        labels: subscription.labels,
        labelMatch: subscription.labelMatch,
        status: subscription.status,
        channels: links
          .filter((link) => link.subscriptionId === subscription.id)
          .map((link) => ({ channelId: link.channelId, frequency: link.frequency })),
        createdAt: subscription.createdAt,
      }));
    }

    /** Checks the channels belong to the user; defaults to the primary email, instant. */
    async function resolveChannels(userId: string, requested?: z.infer<typeof channelLink>[]) {
      const owned = await ctx.db
        .select()
        .from(notificationChannels)
        .where(eq(notificationChannels.userId, userId))
        .orderBy(asc(notificationChannels.createdAt));
      if (!requested) {
        const primary = owned.find((channel) => channel.status !== "disabled");
        if (!primary) {
          throw new ApiError(422, "no_channel", "Add an email address before subscribing.");
        }
        return [{ channelId: primary.id, frequency: "instant" as const }];
      }
      const ids = new Set(owned.map((channel) => channel.id));
      const unknown = requested.find((link) => !ids.has(link.channelId));
      if (unknown) throw notFound(`Channel ${unknown.channelId}`);
      return [...new Map(requested.map((link) => [link.channelId, link])).values()];
    }

    app.get(
      "/v1/me/subscriptions",
      {
        schema: {
          tags,
          summary: "Your subscriptions",
          response: { 200: z.array(subscriptionResponse) },
        },
      },
      async (request) => load(currentUser(request).id),
    );

    app.post(
      "/v1/me/subscriptions",
      {
        schema: {
          tags,
          summary: "Follow labels on a repository",
          description:
            "Emails you when an issue is opened with one of the labels, or when one of the labels is added to an issue. With no labels, every new issue matches.",
          body: z.object({
            repo: z.string().describe("`owner/name` or a GitHub URL"),
            labels: labelsSchema.default([]),
            events: z.array(eventType).min(1).default(["issue.opened", "issue.labeled"]),
            labelMatch: z.enum(["any", "all"]).default("any"),
            channels: z
              .array(channelLink)
              .min(1)
              .optional()
              .describe("Defaults to your primary email, instant"),
          }),
          response: { 201: subscriptionResponse },
        },
      },
      async (request, reply) => {
        const { id: userId } = currentUser(request);
        const reference = parseRepoReference(request.body.repo);
        if (!reference) {
          throw new ApiError(400, "invalid_repo", "Use `owner/name` or a GitHub repository URL.");
        }

        const [{ value: existing } = { value: 0 }] = await ctx.db
          .select({ value: count() })
          .from(subscriptions)
          .where(eq(subscriptions.userId, userId));
        if (existing >= MAX_SUBSCRIPTIONS_PER_USER) {
          throw new ApiError(
            422,
            "subscription_limit",
            `You can have up to ${MAX_SUBSCRIPTIONS_PER_USER} subscriptions.`,
          );
        }

        const channels = await resolveChannels(userId, request.body.channels);
        const repo = await resolveRepository(ctx, reference.owner, reference.name);

        const id = await ctx.db.transaction(async (tx) => {
          const [created] = await tx
            .insert(subscriptions)
            .values({
              userId,
              repoId: repo.id,
              eventTypes: request.body.events,
              labels: request.body.labels,
              labelMatch: request.body.labelMatch,
              createdAt: ctx.now(),
            })
            .returning({ id: subscriptions.id });
          if (!created) throw new Error("Creating the subscription returned nothing");
          await tx
            .insert(subscriptionChannels)
            .values(channels.map((link) => ({ ...link, subscriptionId: created.id })));
          return created.id;
        });

        const [subscription] = await load(userId, [id]);
        if (!subscription) throw new Error("The new subscription could not be loaded");
        return reply.code(201).send(subscription);
      },
    );

    app.patch(
      "/v1/me/subscriptions/:id",
      {
        schema: {
          tags,
          summary: "Change a subscription",
          params: idParams,
          body: z
            .object({
              labels: labelsSchema.optional(),
              events: z.array(eventType).min(1).optional(),
              labelMatch: z.enum(["any", "all"]).optional(),
              status: z.enum(["active", "paused"]).optional(),
              channels: z.array(channelLink).optional().describe("Replaces the current channels"),
            })
            .strict(),
          response: { 200: subscriptionResponse },
        },
      },
      async (request) => {
        const { id: userId } = currentUser(request);
        const { channels: requested, events, ...fields } = request.body;
        const channels = requested && (await resolveChannels(userId, requested));

        await ctx.db.transaction(async (tx) => {
          const [updated] = await tx
            .update(subscriptions)
            .set({ ...fields, ...(events && { eventTypes: events }) })
            .where(and(eq(subscriptions.id, request.params.id), eq(subscriptions.userId, userId)))
            .returning({ id: subscriptions.id });
          if (!updated) throw notFound("Subscription");
          if (channels) {
            await tx
              .delete(subscriptionChannels)
              .where(eq(subscriptionChannels.subscriptionId, updated.id));
            if (channels.length > 0) {
              await tx
                .insert(subscriptionChannels)
                .values(channels.map((link) => ({ ...link, subscriptionId: updated.id })));
            }
          }
        });

        const [subscription] = await load(userId, [request.params.id]);
        if (!subscription) throw notFound("Subscription");
        return subscription;
      },
    );

    app.delete(
      "/v1/me/subscriptions/:id",
      {
        schema: {
          tags,
          summary: "Delete a subscription",
          params: idParams,
          response: { 204: z.null() },
        },
      },
      async (request, reply) => {
        const deleted = await ctx.db
          .delete(subscriptions)
          .where(
            and(
              eq(subscriptions.id, request.params.id),
              eq(subscriptions.userId, currentUser(request).id),
            ),
          )
          .returning({ id: subscriptions.id });
        if (deleted.length === 0) throw notFound("Subscription");
        return reply.code(204).send(null);
      },
    );
  };
