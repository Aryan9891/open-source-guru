import { baseEnvSchema, emailEnvSchema, githubAppEnvSchema, parseEnv } from "@osg/core/env";
import { z } from "zod";

export const apiEnvSchema = baseEnvSchema
  .extend(githubAppEnvSchema.shape)
  .extend(emailEnvSchema.shape)
  .extend({
    API_HOST: z.string().default("0.0.0.0"),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    /** Signs sessions and encrypts stored OAuth tokens. Generate with `openssl rand -base64 32`. */
    BETTER_AUTH_SECRET: z.string().min(32),
    /**
     * Comma-separated GitHub logins made admins at startup and on first sign-in, to create the
     * first admin. Other admins are then granted from the admin dashboard.
     */
    ADMIN_LOGINS: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((login) => login.trim().toLowerCase())
          .filter(Boolean),
      ),
  });

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const loadApiEnv = () => parseEnv(apiEnvSchema);
