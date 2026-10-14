import { z } from "zod";

/** Variables shared by every server-side app (api, worker, migrations). */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

/** The GitHub App used for sign-in and polling (see docs/github-app.md). */
export const githubAppEnvSchema = z.object({
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_CLIENT_ID: z.string().min(1),
  GITHUB_APP_CLIENT_SECRET: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY_PATH: z.string().min(1),
  GITHUB_APP_INSTALLATION_ID: z.coerce.number().int().positive(),
});

/** Sending email and building links in emails. */
export const emailEnvSchema = z.object({
  /** Public URL of the web app, used in links (no trailing slash). */
  WEB_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
  SMTP_URL: z.url({ protocol: /^smtps?$/ }),
  EMAIL_FROM: z.string().min(3),
  /** Secret for signed email links (unsubscribe, address verification). */
  EMAIL_TOKEN_SECRET: z.string().min(32),
});

export class EnvError extends Error {
  override name = "EnvError";
}

/**
 * Validates environment variables against a Zod schema.
 * Throws an `EnvError` listing every invalid variable, so apps fail fast at startup.
 */
export function parseEnv<TSchema extends z.ZodType>(
  schema: TSchema,
  source: Record<string, string | undefined> = process.env,
): z.infer<TSchema> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new EnvError(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
