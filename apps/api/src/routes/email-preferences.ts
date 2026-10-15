import { eq } from "@osg/core/db/query";
import { users } from "@osg/core/db/schema";
import { type EmailPreference, verifyEmailToken } from "@osg/core/tokens";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ApiContext } from "../context.ts";
import { escapeHtml, htmlPage } from "../services/pages.ts";

const NAMES: Record<EmailPreference, string> = {
  streakReminders: "streak reminders",
  goalEmails: "goal emails",
};

const tokenQuery = z.object({ token: z.string().min(10).max(2000) });

/**
 * Links in streak reminders and goal emails turn them off: a confirmation page (GET, changes
 * nothing) and a POST for the page's button or one-click unsubscribe (RFC 8058).
 */
export const emailPreferenceRoutes =
  (ctx: ApiContext): FastifyPluginAsyncZod =>
  async (app) => {
    const page = (title: string, body: string) => htmlPage(title, body, ctx.links.logo);
    const settings = `<p><a href="${escapeHtml(ctx.links.dashboard)}/settings">Your settings</a></p>`;
    const invalid = page("This link doesn't work", `<p>This link is invalid.</p>${settings}`);

    const read = (token: string) => {
      const payload = verifyEmailToken(token, ctx.emailTokenSecret, ctx.now());
      return payload?.purpose === "email-preference" ? payload : null;
    };

    app.get(
      "/v1/public/email/preferences",
      { schema: { hide: true, querystring: tokenQuery } },
      async (request, reply) => {
        reply.type("text/html; charset=utf-8");
        const payload = read(request.query.token);
        if (!payload) return reply.code(400).send(invalid);
        return page(
          `Stop ${NAMES[payload.preference]}?`,
          `<p>You can turn them on again in your settings.</p>
<form method="post"><button type="submit">Stop ${NAMES[payload.preference]}</button></form>`,
        );
      },
    );

    app.post(
      "/v1/public/email/preferences",
      { schema: { hide: true, querystring: tokenQuery } },
      async (request, reply) => {
        const body = request.body as Record<string, unknown> | undefined;
        const oneClick = body?.["List-Unsubscribe"] === "One-Click";
        const payload = read(request.query.token);
        if (!payload) {
          return oneClick
            ? reply.code(400).type("text/plain").send("Invalid link")
            : reply.code(400).type("text/html; charset=utf-8").send(invalid);
        }
        // Idempotent; a deleted account has nothing left to update.
        await ctx.db
          .update(users)
          .set({ [payload.preference]: false })
          .where(eq(users.id, payload.userId));
        if (oneClick) return reply.type("text/plain").send("Unsubscribed");
        reply.type("text/html; charset=utf-8");
        return page(
          `${NAMES[payload.preference][0]?.toUpperCase()}${NAMES[payload.preference].slice(1)} stopped`,
          `<p>You won't receive ${NAMES[payload.preference]} anymore.</p>${settings}`,
        );
      },
    );
  };
