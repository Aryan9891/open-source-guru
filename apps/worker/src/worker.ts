import { readFileSync } from "node:fs";
import { createDatabase } from "@osg/core/db";
import { createGitHubApi, createInstallationOctokit } from "@osg/core/github";
import { createGitHubContributionsApi } from "@osg/core/github/contributions";
import { createEmailLinks } from "@osg/core/links";
import { createSmtpSender } from "@osg/core/mail";
import { PgBoss } from "pg-boss";
import { pino } from "pino";
import type { WorkerContext } from "./context.ts";
import { loadWorkerEnv } from "./env.ts";
import { reclassifyRepositories } from "./jobs/classify-repos.ts";
import { cleanup } from "./jobs/cleanup.ts";
import { fanOutEvents } from "./jobs/fanout.ts";
import { pollRepository } from "./jobs/poll-repo.ts";
import { findContributionSyncsDue } from "./jobs/schedule-contribution-syncs.ts";
import { findRepositoriesDue } from "./jobs/schedule-polls.ts";
import { sendDueNotifications } from "./jobs/send-notifications.ts";
import { syncContributionYear } from "./jobs/sync-contributions.ts";

const env = loadWorkerEnv();

const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === "development" && { transport: { target: "pino-pretty" } }),
});

const database = createDatabase(env.DATABASE_URL);
const mailer = createSmtpSender({ url: env.SMTP_URL, from: env.EMAIL_FROM });
const octokit = createInstallationOctokit(
  {
    appId: env.GITHUB_APP_ID,
    privateKey: readFileSync(env.GITHUB_APP_PRIVATE_KEY_PATH, "utf8"),
    installationId: env.GITHUB_APP_INSTALLATION_ID,
  },
  { log: logger },
);

const ctx: WorkerContext = {
  db: database.db,
  github: createGitHubApi(octokit),
  // Contributions are public data: the installation token sees every one that can count.
  contributions: createGitHubContributionsApi(octokit),
  mailer,
  links: createEmailLinks({ webUrl: env.WEB_URL, secret: env.EMAIL_TOKEN_SECRET }),
  log: logger,
  now: () => new Date(),
};

const boss = new PgBoss(env.DATABASE_URL);
boss.on("error", (error) => logger.error({ err: error }, "pg-boss error"));
await boss.start();

const Queue = {
  schedulePolls: "schedule-polls",
  pollRepo: "poll-repo",
  fanout: "fanout",
  sendInstant: "send-instant",
  sendDigests: "send-digests",
  cleanup: "cleanup",
  scheduleContributionSyncs: "schedule-contribution-syncs",
  syncContributions: "sync-contributions",
  classifyRepos: "classify-repos",
} as const;

// Scheduled jobs: never more than one queued or running at a time.
for (const name of [
  Queue.schedulePolls,
  Queue.fanout,
  Queue.sendInstant,
  Queue.sendDigests,
  Queue.cleanup,
  Queue.scheduleContributionSyncs,
  Queue.classifyRepos,
]) {
  await boss.createQueue(name, { policy: "exclusive" });
}
// One poll per repository at a time (singletonKey = repository ID).
await boss.createQueue(Queue.pollRepo, { policy: "stately", retryLimit: 2, retryBackoff: true });
// One sync per user and year at a time (singletonKey = `${userId}:${year}`). Failures are
// retried by the scheduler, from `contribution_syncs`.
await boss.createQueue(Queue.syncContributions, { policy: "stately" });

await boss.schedule(Queue.schedulePolls, "* * * * *");
await boss.schedule(Queue.fanout, "* * * * *");
await boss.schedule(Queue.sendInstant, "* * * * *");
await boss.schedule(Queue.sendDigests, "5 * * * *");
await boss.schedule(Queue.cleanup, "30 3 * * *");
await boss.schedule(Queue.scheduleContributionSyncs, "* * * * *");
await boss.schedule(Queue.classifyRepos, "15 4 * * *");

await boss.work(Queue.schedulePolls, async () => {
  const repoIds = await findRepositoriesDue(ctx);
  for (const repoId of repoIds) {
    await boss.send(Queue.pollRepo, { repoId }, { singletonKey: repoId });
  }
  if (repoIds.length > 0) logger.debug({ count: repoIds.length }, "polls queued");
});

await boss.work<{ repoId: string }>(Queue.pollRepo, { batchSize: 5 }, async (jobs) => {
  for (const job of jobs) {
    const result = await pollRepository(ctx, job.data.repoId);
    if (result.outcome === "updated" && result.events > 0) {
      // Don't wait for the next scheduled run to match the new events.
      await boss.send(Queue.fanout, null, { singletonKey: "fanout" });
    }
  }
});

await boss.work(Queue.fanout, async () => {
  let total = 0;
  for (;;) {
    const { events, deliveries } = await fanOutEvents(ctx);
    total += deliveries;
    if (events === 0) break;
  }
  if (total > 0) logger.info({ deliveries: total }, "deliveries created");
});

await boss.work(Queue.sendInstant, async () => {
  const result = await sendDueNotifications(ctx, "instant");
  if (result.emails + result.failed > 0) logger.info(result, "instant notifications sent");
});

await boss.work(Queue.sendDigests, async () => {
  for (const frequency of ["hourly", "daily"] as const) {
    const result = await sendDueNotifications(ctx, frequency);
    if (result.emails + result.failed > 0) logger.info({ frequency, ...result }, "digests sent");
  }
});

await boss.work(Queue.scheduleContributionSyncs, async () => {
  const due = await findContributionSyncsDue(ctx);
  for (const { userId, year } of due) {
    await boss.send(
      Queue.syncContributions,
      { userId, year },
      { singletonKey: `${userId}:${year}` },
    );
  }
  if (due.length > 0) logger.debug({ count: due.length }, "contribution syncs queued");
});

await boss.work<{ userId: string; year: number }>(Queue.syncContributions, async ([job]) => {
  if (!job) return;
  const result = await syncContributionYear(ctx, job.data.userId, job.data.year);
  if (result.outcome === "synced") logger.info({ ...job.data, ...result }, "contributions synced");
});

await boss.work(Queue.classifyRepos, async () => {
  const result = await reclassifyRepositories(ctx);
  if (result.checked > 0) logger.info(result, "repositories reclassified");
});

await boss.work(Queue.cleanup, async () => {
  logger.info(await cleanup(ctx), "cleanup done");
});

logger.info("worker started");

const shutdown = async (signal: NodeJS.Signals) => {
  logger.info({ signal }, "shutting down");
  await boss.stop({ graceful: true });
  await mailer.close();
  await database.close();
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
