import { eq } from "@osg/core/db/query";
import { apikeys, users } from "@osg/core/db/schema";
import { isValidTimezone } from "@osg/core/notifications/schedule";
import { renderAccountDeletedEmail } from "@osg/emails";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ApiContext } from "../context.ts";
import { notFound } from "../errors.ts";
import { currentUser, requireSession, requireUser } from "../plugins/authenticate.ts";

const userResponse = z.object({
  id: z.string(),
  login: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  timezone: z.string(),
  digestHour: z.number().int(),
  streakPeriod: z.enum(["week", "day"]).describe("Streaks count weeks (default) or days"),
  profilePublic: z.boolean().describe("Whether /u/{login} shows your profile (default: yes)"),
  streakReminders: z
    .boolean()
    .describe("Email when your streak needs a contribution: Fridays (weekly) or evenings (daily)"),
  goalEmails: z.boolean().describe("Email when you reach a goal"),
  role: z.enum(["user", "admin"]).describe("Admins can open the admin dashboard"),
  createdAt: z.date(),
});

/** The role is stored only for admins (null means a regular user). */
const withRole = <T extends { role: "admin" | null }>(user: T) => ({
  ...user,
  role: user.role ?? ("user" as const),
});

export const meRoutes =
  (ctx: ApiContext): FastifyPluginAsyncZod =>
  async (app) => {
    const tags = ["Account"];

    app.get(
      "/v1/me",
      {
        preHandler: requireUser(ctx),
        schema: { tags, summary: "Your profile and settings", response: { 200: userResponse } },
      },
      async (request) => {
        const user = await ctx.db.query.users.findFirst({
          where: eq(users.id, currentUser(request).id),
        });
        if (!user) throw notFound("User");
        return withRole(user);
      },
    );

    app.patch(
      "/v1/me",
      {
        preHandler: requireUser(ctx),
        schema: {
          tags,
          summary: "Update your settings",
          body: z
            .object({
              timezone: z
                .string()
                .refine(isValidTimezone, "Must be an IANA time zone, e.g. Europe/Paris")
                .optional(),
              digestHour: z.number().int().min(0).max(23).optional(),
              streakPeriod: z.enum(["week", "day"]).optional(),
              profilePublic: z.boolean().optional(),
              streakReminders: z.boolean().optional(),
              goalEmails: z.boolean().optional(),
            })
            .strict(),
          response: { 200: userResponse },
        },
      },
      async (request) => {
        const [user] = await ctx.db
          .update(users)
          .set(request.body)
          .where(eq(users.id, currentUser(request).id))
          .returning();
        if (!user) throw notFound("User");
        return withRole(user);
      },
    );

    app.delete(
      "/v1/me",
      {
        preHandler: requireSession(ctx),
        schema: {
          tags,
          summary: "Delete your account and all your data",
          security: [{ session: [] }],
          description: "Only available from the web app (not with an API key).",
          response: { 204: z.null() },
        },
      },
      async (request, reply) => {
        const { id, login } = currentUser(request);
        const user = await ctx.db.query.users.findFirst({
          columns: { email: true },
          where: eq(users.id, id),
        });
        await ctx.db.transaction(async (tx) => {
          // API keys reference the user without a foreign key (Better Auth plugin table).
          await tx.delete(apikeys).where(eq(apikeys.referenceId, id));
          // Everything else is removed by ON DELETE CASCADE.
          await tx.delete(users).where(eq(users.id, id));
        });
        if (user?.email) {
          const email = await renderAccountDeletedEmail({
            login,
            logoUrl: ctx.links.logo,
          });
          await ctx.mailer.send({ to: user.email, ...email });
        }
        return reply.code(204).send(null);
      },
    );
  };
