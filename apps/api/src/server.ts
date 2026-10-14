import { createDatabase } from "@osg/core/db";
import { buildApp } from "./app.ts";
import { loadApiEnv } from "./env.ts";

const env = loadApiEnv();
const database = createDatabase(env.DATABASE_URL);

const app = buildApp(
  { pingDatabase: database.ping },
  {
    logger: {
      level: env.LOG_LEVEL,
      ...(env.NODE_ENV === "development" && { transport: { target: "pino-pretty" } }),
    },
  },
);

const shutdown = async (signal: NodeJS.Signals) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await database.close();
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

await app.listen({ host: env.API_HOST, port: env.API_PORT });
