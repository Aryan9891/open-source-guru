import { readFileSync } from "node:fs";
import { createDatabase } from "@osg/core/db";
import { createGitHubApi, createInstallationOctokit } from "@osg/core/github";
import { createEmailLinks } from "@osg/core/links";
import { createSmtpSender } from "@osg/core/mail";
import { buildApp } from "./app.ts";
import { createAuth } from "./auth.ts";
import type { ApiContext } from "./context.ts";
import { loadApiEnv } from "./env.ts";
import { onUserCreated } from "./services/channels.ts";

const env = loadApiEnv();
const database = createDatabase(env.DATABASE_URL);
const mailer = createSmtpSender({ url: env.SMTP_URL, from: env.EMAIL_FROM });

const logger = {
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === "development" && { transport: { target: "pino-pretty" } }),
};

// `ctx` is complete before any request arrives; the auth hook needs it for first sign-ins.
const ctx = {} as ApiContext;
Object.assign(ctx, {
  db: database.db,
  auth: createAuth({
    db: database.db,
    secret: env.BETTER_AUTH_SECRET,
    webUrl: env.WEB_URL,
    github: { clientId: env.GITHUB_APP_CLIENT_ID, clientSecret: env.GITHUB_APP_CLIENT_SECRET },
    onUserCreated: async (user) => {
      try {
        await onUserCreated(ctx, user);
      } catch (error) {
        app.log.error({ err: error, userId: user.id }, "setting up a new user failed");
      }
    },
  }),
  github: createGitHubApi(
    createInstallationOctokit({
      appId: env.GITHUB_APP_ID,
      privateKey: readFileSync(env.GITHUB_APP_PRIVATE_KEY_PATH, "utf8"),
      installationId: env.GITHUB_APP_INSTALLATION_ID,
    }),
  ),
  mailer,
  links: createEmailLinks({ webUrl: env.WEB_URL, secret: env.EMAIL_TOKEN_SECRET }),
  emailTokenSecret: env.EMAIL_TOKEN_SECRET,
  now: () => new Date(),
} satisfies ApiContext);

const app = await buildApp({ ...ctx, pingDatabase: database.ping }, { logger });

const shutdown = async (signal: NodeJS.Signals) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await mailer.close();
  await database.close();
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

await app.listen({ host: env.API_HOST, port: env.API_PORT });
