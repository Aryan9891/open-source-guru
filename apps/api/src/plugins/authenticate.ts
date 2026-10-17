import { eq } from "@osg/core/db/query";
import { type UserRole, users } from "@osg/core/db/schema";
import type { FastifyReply, FastifyRequest } from "fastify";
import { API_KEY_PREFIX } from "../auth.ts";
import type { ApiContext } from "../context.ts";

export interface AuthenticatedUser {
  id: string;
  login: string;
  role: UserRole;
  /** How the request was authenticated. Some actions require a browser session. */
  via: "session" | "api_key";
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthenticatedUser | null;
  }
}

/** Converts Fastify's headers to the Web `Headers` Better Auth expects. */
export function toWebHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
  }
  return headers;
}

function bearerApiKey(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const key = header.slice("Bearer ".length).trim();
  return key.startsWith(API_KEY_PREFIX) ? key : null;
}

async function resolveUser(
  ctx: ApiContext,
  request: FastifyRequest,
): Promise<AuthenticatedUser | null> {
  const apiKey = bearerApiKey(request);
  if (apiKey) {
    const result = await ctx.auth.api.verifyApiKey({ body: { key: apiKey } });
    if (!result.valid || !result.key) return null;
    const user = await ctx.db.query.users.findFirst({
      columns: { id: true, login: true, role: true },
      where: eq(users.id, result.key.referenceId),
    });
    return user ? { ...user, role: user.role ?? "user", via: "api_key" } : null;
  }

  const session = await ctx.auth.api.getSession({ headers: toWebHeaders(request) });
  if (!session) return null;
  return {
    id: session.user.id,
    login: session.user.login,
    role: session.user.role === "admin" ? "admin" : "user",
    via: "session",
  };
}

const unauthorized = (reply: FastifyReply) =>
  reply.code(401).send({
    error: "unauthorized",
    message: "Sign in, or send a personal API key as `Authorization: Bearer <key>`.",
  });

/** preHandler: requires a signed-in user (session cookie or personal API key). */
export const requireUser = (ctx: ApiContext) =>
  async function requireUserHandler(request: FastifyRequest, reply: FastifyReply) {
    request.user = await resolveUser(ctx, request);
    if (!request.user) return unauthorized(reply);
  };

/** preHandler: requires a browser session. API keys can't manage API keys or delete accounts. */
export const requireSession = (ctx: ApiContext) =>
  async function requireSessionHandler(request: FastifyRequest, reply: FastifyReply) {
    request.user = await resolveUser(ctx, request);
    if (!request.user) return unauthorized(reply);
    if (request.user.via !== "session") {
      return reply.code(403).send({
        error: "session_required",
        message: "This action is only available from the web app, not with an API key.",
      });
    }
  };

/** preHandler: requires an admin's browser session. Others get a 404, as if nothing was there. */
export const requireAdmin = (ctx: ApiContext) =>
  async function requireAdminHandler(request: FastifyRequest, reply: FastifyReply) {
    request.user = await resolveUser(ctx, request);
    if (!request.user) return unauthorized(reply);
    if (request.user.via !== "session" || request.user.role !== "admin") {
      return reply.code(404).send({ error: "not_found", message: "Not found." });
    }
  };

/** The authenticated user; only call in routes protected by `requireUser`/`requireSession`. */
export function currentUser(request: FastifyRequest): AuthenticatedUser {
  if (!request.user) throw new Error("currentUser() called on an unauthenticated route");
  return request.user;
}
