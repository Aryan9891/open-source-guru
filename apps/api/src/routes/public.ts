import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ApiContext } from "../context.ts";
import { ApiError } from "../errors.ts";
import { describeUnsubscribe, unsubscribe, verifyEmailChannel } from "../services/channels.ts";
import { getRepositoryLabels, resolveRepository } from "../services/repositories.ts";

const repoParams = z.object({
  owner: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/),
  repo: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/),
});

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/**
 * Minimal pages for the links in emails. They work without the web app; Phase 1b can replace
 * them with web pages.
 */
function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} | Open Source Guru</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; line-height: 1.5; color: #1f2328; }
  button { font: inherit; padding: .5rem 1rem; border-radius: .375rem; border: 1px solid #d1d9e0; background: #1f2328; color: #fff; cursor: pointer; }
  a { color: #0969da; }
  @media (prefers-color-scheme: dark) { body { background: #0d1117; color: #e6edf3; } button { background: #e6edf3; color: #0d1117; } a { color: #4493f8; } }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${body}
</body>
</html>`;
}

export const publicRoutes =
  (ctx: ApiContext): FastifyPluginAsyncZod =>
  async (app) => {
    const tags = ["Public"];
    const dashboardLink = `<p><a href="${escapeHtml(ctx.links.dashboard)}">Go to your dashboard</a></p>`;

    app.get(
      "/v1/public/repos/:owner/:repo",
      {
        schema: {
          tags,
          security: [],
          summary: "Check that a repository can be followed",
          params: repoParams,
          response: {
            200: z.object({ fullName: z.string(), url: z.string(), githubId: z.number() }),
          },
        },
      },
      async (request) => {
        const repo = await resolveRepository(ctx, request.params.owner, request.params.repo);
        const fullName = `${repo.owner}/${repo.name}`;
        return { fullName, url: `https://github.com/${fullName}`, githubId: repo.githubId };
      },
    );

    app.get(
      "/v1/public/repos/:owner/:repo/labels",
      {
        schema: {
          tags,
          security: [],
          summary: "Labels of a repository, with their number of open issues",
          params: repoParams,
          response: {
            200: z.array(
              z.object({
                name: z.string(),
                color: z.string(),
                description: z.string().nullable(),
                openIssues: z.number().int(),
              }),
            ),
          },
        },
      },
      async (request, reply) => {
        const repo = await resolveRepository(ctx, request.params.owner, request.params.repo);
        const labels = await getRepositoryLabels(ctx, repo);
        reply.header("cache-control", "public, max-age=300");
        return labels
          .map(({ name, color, description, openIssues }) => ({
            name,
            color,
            description,
            openIssues,
          }))
          .sort((a, b) => b.openIssues - a.openIssues || a.name.localeCompare(b.name));
      },
    );

    const tokenQuery = z.object({ token: z.string().min(10).max(2000) });

    app.get(
      "/v1/public/email/verify",
      {
        schema: {
          // Opened from emails, not part of the API reference.
          hide: true,
          tags,
          summary: "Confirm an email address (link in email)",
          querystring: tokenQuery,
        },
      },
      async (request, reply) => {
        reply.type("text/html; charset=utf-8");
        try {
          const channel = await verifyEmailChannel(ctx, request.query.token);
          return page(
            "Email address confirmed",
            `<p>Notifications can now be sent to <strong>${escapeHtml(channel.config.address)}</strong>.</p>${dashboardLink}`,
          );
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          reply.code(error.statusCode);
          return page(
            "This link doesn't work",
            `<p>${escapeHtml(error.message)}</p>${dashboardLink}`,
          );
        }
      },
    );

    app.get(
      "/v1/public/email/unsubscribe",
      {
        schema: {
          // Opened from emails, not part of the API reference.
          hide: true,
          tags,
          summary: "Unsubscribe confirmation page (link in email)",
          description: "Shows what will stop; nothing changes until the form is submitted.",
          querystring: tokenQuery,
        },
      },
      async (request, reply) => {
        reply.type("text/html; charset=utf-8");
        try {
          const target = await describeUnsubscribe(ctx, request.query.token);
          const what = target.subscriptionIds
            ? "notifications for this repository"
            : "every notification from Open Source Guru";
          return page(
            "Unsubscribe",
            `<p>Stop sending ${what} to <strong>${escapeHtml(target.address)}</strong>?</p>
<form method="post"><button type="submit">Unsubscribe</button></form>`,
          );
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          reply.code(error.statusCode);
          return page(
            "This link doesn't work",
            `<p>${escapeHtml(error.message)}</p>${dashboardLink}`,
          );
        }
      },
    );

    app.post(
      "/v1/public/email/unsubscribe",
      {
        schema: {
          // Opened from emails, not part of the API reference.
          hide: true,
          tags,
          summary: "Unsubscribe (one-click, RFC 8058, or confirmation form)",
          querystring: tokenQuery,
        },
      },
      async (request, reply) => {
        const body = request.body as Record<string, unknown> | undefined;
        const oneClick = body?.["List-Unsubscribe"] === "One-Click";
        try {
          const target = await unsubscribe(ctx, request.query.token);
          if (oneClick) return reply.code(200).type("text/plain").send("Unsubscribed");
          reply.type("text/html; charset=utf-8");
          return page(
            "You're unsubscribed",
            `<p>${
              target.subscriptionIds
                ? "You won't receive notifications for this repository at this address anymore."
                : "You won't receive any more notifications at this address."
            }</p>${dashboardLink}`,
          );
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          if (oneClick) return reply.code(error.statusCode).type("text/plain").send(error.message);
          reply.code(error.statusCode).type("text/html; charset=utf-8");
          return page("This link doesn't work", `<p>${escapeHtml(error.message)}</p>`);
        }
      },
    );
  };
