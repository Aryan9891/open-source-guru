import { apiKey } from "@better-auth/api-key";
import type { Database } from "@osg/core/db";
import * as schema from "@osg/core/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export interface AuthConfig {
  db: Database;
  secret: string;
  /** Public URL of the web app; auth routes are served under `${webUrl}/api/auth`. */
  webUrl: string;
  github: { clientId: string; clientSecret: string };
  /** Runs once, after a user signs in for the first time. */
  onUserCreated?: (user: { id: string; email: string; emailVerified: boolean }) => Promise<void>;
}

export const API_KEY_PREFIX = "osg_";

/** Better Auth endpoints that are not exposed over HTTP. */
export const DISABLED_AUTH_PATHS = [
  // No email/password accounts.
  "/sign-up/email",
  "/sign-in/email",
  "/change-password",
  "/request-password-reset",
  "/reset-password",
  "/verify-password",
  "/send-verification-email",
  "/verify-email",
  // The user record mirrors GitHub; settings are changed through /v1/me.
  "/update-user",
  "/change-email",
  "/delete-user",
  "/delete-user/callback",
  // GitHub is the only provider.
  "/link-social",
  "/unlink-account",
  // API keys are managed through /v1/me/api-keys (session only, limited per user).
  "/api-key/create",
  "/api-key/get",
  "/api-key/update",
  "/api-key/delete",
  "/api-key/list",
  "/api-key/delete-all-expired-api-keys",
];

export function createAuth(config: AuthConfig) {
  return betterAuth({
    appName: "Open Source Guru",
    baseURL: config.webUrl,
    basePath: "/api/auth",
    secret: config.secret,
    trustedOrigins: [config.webUrl],
    database: drizzleAdapter(config.db, { provider: "pg", schema, usePlural: true }),
    advanced: {
      database: { generateId: "uuid" },
    },
    // GitHub is the only way to sign in (PLAN.md §3).
    emailAndPassword: { enabled: false },
    socialProviders: {
      github: {
        clientId: config.github.clientId,
        clientSecret: config.github.clientSecret,
        // Keep login and avatar up to date when they change on GitHub.
        overrideUserInfoOnSignIn: true,
        mapProfileToUser: (profile) => ({
          githubId: Number(profile.id),
          login: profile.login,
        }),
      },
    },
    // Only the endpoints we use are exposed over HTTP. Our own code calls `auth.api.*` directly.
    // Profile and settings changes go through /v1/me; API keys through /v1/me/api-keys.
    disabledPaths: DISABLED_AUTH_PATHS,
    user: {
      additionalFields: {
        // `input: true` is required for values from `mapProfileToUser` to be kept: Better Auth
        // drops profile fields marked `input: false`. Clients can't set them anyway, because
        // /update-user is disabled.
        githubId: { type: "number", required: true, input: true },
        login: { type: "string", required: true, input: true },
        timezone: { type: "string", required: true, defaultValue: "UTC", input: false },
        digestHour: { type: "number", required: true, defaultValue: 8, input: false },
      },
    },
    account: {
      encryptOAuthTokens: true,
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await config.onUserCreated?.(user);
          },
        },
      },
    },
    plugins: [
      apiKey({
        defaultPrefix: API_KEY_PREFIX,
        requireName: true,
        // Request limits are enforced by @fastify/rate-limit for every client.
        rateLimit: { enabled: false },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
