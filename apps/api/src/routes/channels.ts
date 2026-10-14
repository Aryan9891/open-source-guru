import { and, asc, eq } from "@osg/core/db/query";
import { notificationChannels } from "@osg/core/db/schema";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ApiContext } from "../context.ts";
import { ApiError, notFound } from "../errors.ts";
import { currentUser, requireUser } from "../plugins/authenticate.ts";
import { addEmailChannel, type Channel, sendVerificationEmail } from "../services/channels.ts";

const channelResponse = z.object({
  id: z.string(),
  type: z.enum(["email", "discord", "slack", "webhook", "ntfy"]),
  label: z.string(),
  address: z.string(),
  status: z.enum(["pending", "active", "disabled"]),
  disabledReason: z.string().nullable(),
  verifiedAt: z.date().nullable(),
  createdAt: z.date(),
});

const toResponse = (channel: Channel) => ({
  id: channel.id,
  type: channel.type,
  label: channel.label,
  address: channel.config.address,
  status: channel.status,
  disabledReason: channel.disabledReason,
  verifiedAt: channel.verifiedAt,
  createdAt: channel.createdAt,
});

const idParams = z.object({ id: z.uuid() });

export const channelRoutes =
  (ctx: ApiContext): FastifyPluginAsyncZod =>
  async (app) => {
    const tags = ["Channels"];
    app.addHook("preHandler", requireUser(ctx));

    async function findOwned(userId: string, id: string) {
      const channel = await ctx.db.query.notificationChannels.findFirst({
        where: and(eq(notificationChannels.id, id), eq(notificationChannels.userId, userId)),
      });
      if (!channel) throw notFound("Channel");
      return channel;
    }

    app.get(
      "/v1/me/channels",
      {
        schema: {
          tags,
          summary: "Where your notifications are sent",
          response: { 200: z.array(channelResponse) },
        },
      },
      async (request) => {
        const channels = await ctx.db
          .select()
          .from(notificationChannels)
          .where(eq(notificationChannels.userId, currentUser(request).id))
          .orderBy(asc(notificationChannels.createdAt));
        return channels.map(toResponse);
      },
    );

    app.post(
      "/v1/me/channels",
      {
        schema: {
          tags,
          summary: "Add an email address",
          description: "A verification email is sent; nothing else is sent to it until confirmed.",
          body: z.object({
            address: z.email().max(254),
            label: z.string().trim().min(1).max(100).optional(),
          }),
          response: { 201: channelResponse },
        },
      },
      async (request, reply) => {
        const channel = await addEmailChannel(ctx, currentUser(request).id, request.body);
        return reply.code(201).send(toResponse(channel));
      },
    );

    app.post(
      "/v1/me/channels/:id/resend-verification",
      {
        schema: {
          tags,
          summary: "Send the verification email again",
          params: idParams,
          response: { 204: z.null() },
        },
      },
      async (request, reply) => {
        const channel = await findOwned(currentUser(request).id, request.params.id);
        if (channel.status !== "pending") {
          throw new ApiError(409, "already_verified", "This address is already verified.");
        }
        await sendVerificationEmail(ctx, channel);
        return reply.code(204).send(null);
      },
    );

    app.patch(
      "/v1/me/channels/:id",
      {
        schema: {
          tags,
          summary: "Rename a channel",
          params: idParams,
          body: z.object({ label: z.string().trim().min(1).max(100) }).strict(),
          response: { 200: channelResponse },
        },
      },
      async (request) => {
        const channel = await findOwned(currentUser(request).id, request.params.id);
        const [updated] = await ctx.db
          .update(notificationChannels)
          .set({ label: request.body.label })
          .where(eq(notificationChannels.id, channel.id))
          .returning();
        return toResponse(updated ?? channel);
      },
    );

    app.delete(
      "/v1/me/channels/:id",
      {
        schema: {
          tags,
          summary: "Remove a channel",
          description:
            "Subscriptions stop sending to it; pending notifications for it are dropped.",
          params: idParams,
          response: { 204: z.null() },
        },
      },
      async (request, reply) => {
        const channel = await findOwned(currentUser(request).id, request.params.id);
        await ctx.db.delete(notificationChannels).where(eq(notificationChannels.id, channel.id));
        return reply.code(204).send(null);
      },
    );
  };
