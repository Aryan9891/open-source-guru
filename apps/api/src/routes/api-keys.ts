import { and, desc, eq } from "@osg/core/db/query";
import { apikeys } from "@osg/core/db/schema";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ApiContext } from "../context.ts";
import { ApiError, notFound } from "../errors.ts";
import { currentUser, requireSession } from "../plugins/authenticate.ts";

export const MAX_API_KEYS_PER_USER = 10;

const apiKeyResponse = z.object({
  id: z.string(),
  name: z.string().nullable(),
  /** First characters of the key, to recognize it. */
  start: z.string().nullable(),
  createdAt: z.date(),
  expiresAt: z.date().nullable(),
  lastUsedAt: z.date().nullable(),
});

const DAY_S = 24 * 60 * 60;

export const apiKeyRoutes =
  (ctx: ApiContext): FastifyPluginAsyncZod =>
  async (app) => {
    const tags = ["API keys"];
    // Managing keys requires a browser session: a leaked key can't create more keys.
    app.addHook("preHandler", requireSession(ctx));

    const listFor = (userId: string) =>
      ctx.db
        .select()
        .from(apikeys)
        .where(eq(apikeys.referenceId, userId))
        .orderBy(desc(apikeys.createdAt));

    app.get(
      "/v1/me/api-keys",
      {
        schema: {
          tags,
          summary: "Your personal API keys",
          response: { 200: z.array(apiKeyResponse) },
        },
      },
      async (request) => {
        const keys = await listFor(currentUser(request).id);
        return keys.map((key) => ({
          id: key.id,
          name: key.name,
          start: key.start,
          createdAt: key.createdAt,
          expiresAt: key.expiresAt,
          lastUsedAt: key.lastRequest,
        }));
      },
    );

    app.post(
      "/v1/me/api-keys",
      {
        schema: {
          tags,
          summary: "Create a personal API key",
          description:
            "The key acts as you. It is shown only once: store it safely. Send it as `Authorization: Bearer <key>`.",
          body: z.object({
            name: z.string().trim().min(1).max(100),
            expiresInDays: z.number().int().min(1).max(365).optional(),
          }),
          response: { 201: apiKeyResponse.extend({ key: z.string() }) },
        },
      },
      async (request, reply) => {
        const { id: userId } = currentUser(request);
        if ((await listFor(userId)).length >= MAX_API_KEYS_PER_USER) {
          throw new ApiError(
            422,
            "api_key_limit",
            `You can have up to ${MAX_API_KEYS_PER_USER} API keys.`,
          );
        }
        const created = await ctx.auth.api.createApiKey({
          body: {
            userId,
            name: request.body.name,
            expiresIn: request.body.expiresInDays ? request.body.expiresInDays * DAY_S : null,
          },
        });
        return reply.code(201).send({
          id: created.id,
          name: created.name ?? null,
          start: created.start ?? null,
          createdAt: created.createdAt,
          expiresAt: created.expiresAt ?? null,
          lastUsedAt: null,
          key: created.key,
        });
      },
    );

    app.delete(
      "/v1/me/api-keys/:id",
      {
        schema: {
          tags,
          summary: "Revoke an API key",
          params: z.object({ id: z.uuid() }),
          response: { 204: z.null() },
        },
      },
      async (request, reply) => {
        const deleted = await ctx.db
          .delete(apikeys)
          .where(
            and(
              eq(apikeys.id, request.params.id),
              eq(apikeys.referenceId, currentUser(request).id),
            ),
          )
          .returning({ id: apikeys.id });
        if (deleted.length === 0) throw notFound("API key");
        return reply.code(204).send(null);
      },
    );
  };
