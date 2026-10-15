import formbody from "@fastify/formbody";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyServerOptions } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";
import type { ApiContext } from "./context.ts";
import { ApiError } from "./errors.ts";
import { betterAuthRoutes } from "./plugins/better-auth.ts";
import { apiKeyRoutes } from "./routes/api-keys.ts";
import { channelRoutes } from "./routes/channels.ts";
import { contributionRoutes } from "./routes/contributions.ts";
import { feedRoutes } from "./routes/feed.ts";
import { goalRoutes } from "./routes/goals.ts";
import { meRoutes } from "./routes/me.ts";
import { profileRoutes } from "./routes/profiles.ts";
import { publicRoutes } from "./routes/public.ts";
import { statsRoutes } from "./routes/stats.ts";
import { subscriptionRoutes } from "./routes/subscriptions.ts";

export interface AppDependencies extends ApiContext {
  /** Resolves when the database is reachable. */
  pingDatabase: () => Promise<void>;
}

const healthResponse = z.object({
  status: z.enum(["ok", "degraded"]),
  database: z.enum(["ok", "unavailable"]),
});

/** Reference sections, in order. `x-displayName` is the docs sidebar title. */
const openApiTags = [
  { name: "Account", description: "Your profile and settings." },
  { name: "Subscriptions", description: "Repositories and labels you follow." },
  { name: "Channels", description: "Email addresses notifications are sent to." },
  { name: "Feed", description: "Issues that matched your subscriptions." },
  {
    name: "Contributions",
    description: "Your Open Source Contributions, synced from GitHub.",
  },
  { name: "Goals", description: "Targets for your Open Source Contributions." },
  {
    name: "API keys",
    "x-displayName": "API keys",
    description: "Personal API keys. Managing them needs a browser session, not a key.",
  },
  { name: "Public", description: "No authentication needed." },
];

export async function buildApp(deps: AppDependencies, options: FastifyServerOptions = {}) {
  const app = Fastify({ trustProxy: true, ...options }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorateRequest("user", null);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({ error: error.code, message: error.message });
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.code(400).send({
        error: "invalid_request",
        message: "The request is invalid.",
        issues: error.validation.map((issue) => ({
          path: issue.instancePath,
          message: issue.message,
        })),
      });
    }
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    if (statusCode >= 500) request.log.error({ err: error }, "request failed");
    return reply.code(statusCode).send({
      error: statusCode === 429 ? "rate_limited" : statusCode >= 500 ? "internal_error" : "error",
      message: statusCode >= 500 ? "Something went wrong." : (error as Error).message,
    });
  });

  await app.register(helmet, {
    // Swagger UI needs inline scripts and styles.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        formAction: ["'self'"],
      },
    },
  });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    // Per API key when one is sent, per IP otherwise.
    keyGenerator: (request) => request.headers.authorization ?? request.ip,
  });
  // One-click unsubscribe (RFC 8058) posts `List-Unsubscribe=One-Click` as a form.
  await app.register(formbody);

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Open Source Guru API",
        version: "1.0.0",
        description:
          "Follow labels on GitHub repositories and get notified about matching issues. Authenticate with a personal API key created in the dashboard: `Authorization: Bearer <key>`.",
      },
      components: {
        securitySchemes: {
          apiKey: { type: "http", scheme: "bearer", description: "Personal API key (osg_…)" },
          session: {
            type: "apiKey",
            in: "cookie",
            name: "better-auth.session_token",
            description: "Browser session from signing in on the website",
          },
        },
      },
      security: [{ apiKey: [] }],
      tags: openApiTags,
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.get(
    "/health",
    { schema: { hide: true, response: { 200: healthResponse, 503: healthResponse } } },
    async (request, reply) => {
      try {
        await deps.pingDatabase();
        return { status: "ok", database: "ok" } as const;
      } catch (error) {
        request.log.error({ err: error }, "database health check failed");
        return reply.code(503).send({ status: "degraded", database: "unavailable" });
      }
    },
  );

  await app.register(async (scope) => betterAuthRoutes(scope, deps));
  await app.register(meRoutes(deps));
  await app.register(subscriptionRoutes(deps));
  await app.register(channelRoutes(deps));
  await app.register(feedRoutes(deps));
  await app.register(contributionRoutes(deps));
  await app.register(statsRoutes(deps));
  await app.register(goalRoutes(deps));
  await app.register(apiKeyRoutes(deps));
  await app.register(publicRoutes(deps));
  await app.register(profileRoutes(deps));

  return app;
}
