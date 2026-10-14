import Fastify, { type FastifyServerOptions } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";

export interface AppDependencies {
  /** Resolves when the database is reachable. */
  pingDatabase: () => Promise<void>;
}

const healthResponse = z.object({
  status: z.enum(["ok", "degraded"]),
  database: z.enum(["ok", "unavailable"]),
});

export function buildApp(deps: AppDependencies, options: FastifyServerOptions = {}) {
  const app = Fastify(options).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.get(
    "/health",
    { schema: { response: { 200: healthResponse, 503: healthResponse } } },
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

  return app;
}
