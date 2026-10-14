import { z } from "zod";

/** Variables shared by every server-side app (api, worker, migrations). */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
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
