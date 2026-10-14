import type { FastifyInstance } from "fastify";
import type { ApiContext } from "../context.ts";
import { toWebHeaders } from "./authenticate.ts";

/**
 * Mounts Better Auth at /api/auth/* (sign-in with GitHub, callback, sign-out, session).
 * The web app forwards /api/auth/* here unchanged, so the public URLs are
 * `${WEB_URL}/api/auth/...` (the GitHub App callback URL in docs/github-app.md).
 */
export async function betterAuthRoutes(app: FastifyInstance, ctx: ApiContext) {
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    schema: { hide: true },
    async handler(request, reply) {
      const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
      const body =
        request.method === "POST" && request.body !== undefined
          ? JSON.stringify(request.body)
          : undefined;
      const headers = toWebHeaders(request);
      if (body) headers.set("content-type", "application/json");

      const response = await ctx.auth.handler(
        new Request(url, { method: request.method, headers, body }),
      );

      reply.status(response.status);
      for (const [name, value] of response.headers) {
        if (name.toLowerCase() !== "set-cookie") reply.header(name, value);
      }
      const cookies = response.headers.getSetCookie();
      if (cookies.length > 0) reply.header("set-cookie", cookies);
      return reply.send(response.body ? Buffer.from(await response.arrayBuffer()) : null);
    },
  });
}
