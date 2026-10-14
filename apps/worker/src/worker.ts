import { baseEnvSchema, parseEnv } from "@osg/core/env";
import { PgBoss } from "pg-boss";
import { pino } from "pino";

const env = parseEnv(baseEnvSchema);

const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === "development" && { transport: { target: "pino-pretty" } }),
});

const boss = new PgBoss(env.DATABASE_URL);
boss.on("error", (error) => logger.error({ err: error }, "pg-boss error"));

// Jobs (schedule-polls, poll-repo, fanout, send-instant, …) are registered here in Phase 1.

await boss.start();
logger.info("worker started");

const shutdown = async (signal: NodeJS.Signals) => {
  logger.info({ signal }, "shutting down");
  await boss.stop({ graceful: true });
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
