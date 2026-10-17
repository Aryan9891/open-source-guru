// Shared setup for the API integration tests: a throwaway PostgreSQL per test file,
// the real app with Better Auth, a fake GitHub and an in-memory mailer.
import { eq } from "@osg/core/db/query";
import { users } from "@osg/core/db/schema";
import type { GitHubApi, GitHubRepository } from "@osg/core/github";
import { createEmailLinks } from "@osg/core/links";
import { createMemorySender } from "@osg/core/mail";
import type { TestDatabase } from "@osg/core/testing";

export { useTestDatabase } from "@osg/core/testing";

import { makeSignature } from "better-auth/crypto";
import { buildApp } from "../app.ts";
import { createAuth } from "../auth.ts";
import type { ApiContext } from "../context.ts";
import { onUserCreated } from "../services/channels.ts";

export const AUTH_SECRET = "better-auth-test-secret-0123456789abcdef";
export const EMAIL_SECRET = "email-token-test-secret-0123456789abcdef";
export const WEB_URL = "http://localhost:3000";

/** A GitHub with two repositories: public `acme/repo` and private `acme/secret`. */
export function fakeGitHub() {
  const repos = new Map<string, GitHubRepository>([
    ["acme/repo", { githubId: 99, owner: "acme", name: "repo", private: false, hasIssues: true }],
    [
      "acme/secret",
      { githubId: 98, owner: "acme", name: "secret", private: true, hasIssues: true },
    ],
  ]);
  const calls = { labels: 0 };
  const api: GitHubApi = {
    getRepository: async (owner, name) => repos.get(`${owner}/${name}`.toLowerCase()) ?? null,
    listRepoLabels: async () => {
      calls.labels++;
      return [
        { nodeId: "LA_1", name: "bug", color: "d73a4a", description: null, openIssues: 3 },
        { nodeId: "LA_2", name: "help wanted", color: "008672", description: null, openIssues: 37 },
      ];
    },
    listIssuesPage: async () => ({ notModified: true }),
  };
  return { api, calls };
}

/** Builds the app against the test database, with helpers to sign users up. */
export async function createTestApi(database: TestDatabase) {
  const github = fakeGitHub();
  const mailer = createMemorySender();
  const ctx = {} as ApiContext;
  Object.assign(ctx, {
    db: database.db,
    auth: createAuth({
      db: database.db,
      secret: AUTH_SECRET,
      webUrl: WEB_URL,
      github: { clientId: "client-id", clientSecret: "client-secret" },
      onUserCreated: (user) => onUserCreated(ctx, user),
    }),
    github: github.api,
    mailer,
    links: createEmailLinks({ webUrl: WEB_URL, secret: EMAIL_SECRET }),
    emailTokenSecret: EMAIL_SECRET,
    now: () => new Date(),
  } satisfies ApiContext);
  const app = await buildApp({ ...ctx, pingDatabase: database.ping });

  /** Signs a user up the way the GitHub callback does, and returns a session cookie. */
  async function signUp(login = "ada", email = `${login}@example.com`) {
    const authContext = await ctx.auth.$context;
    const user = await authContext.internalAdapter.createUser(
      {
        name: login,
        email,
        emailVerified: true,
        githubId: Math.floor(Math.random() * 1e9),
        login,
      },
      { method: "oauth", oauth: { providerId: "github" } },
    );
    const session = await authContext.internalAdapter.createSession(user.id);
    const signature = await makeSignature(session.token, AUTH_SECRET);
    const cookie = `better-auth.session_token=${encodeURIComponent(`${session.token}.${signature}`)}`;
    return { user, cookie };
  }

  /** Signs a user up with the admin role. */
  async function signUpAdmin(login = "root") {
    const account = await signUp(login);
    await database.db.update(users).set({ role: "admin" }).where(eq(users.id, account.user.id));
    return account;
  }

  /** Signs up and follows `acme/repo` with the default channel. */
  async function signUpAndSubscribe(login = "ada") {
    const { user, cookie } = await signUp(login);
    const created = await app.inject({
      method: "POST",
      url: "/v1/me/subscriptions",
      headers: { cookie },
      payload: { repo: "acme/repo" },
    });
    const subscription = created.json() as {
      id: string;
      channels: { channelId: string; frequency: string }[];
    };
    const channelId = subscription.channels[0]?.channelId;
    if (!channelId) throw new Error("The new subscription has no channel");
    return { user, cookie, subscription, channelId };
  }

  return { app, ctx, github, mailer, signUp, signUpAdmin, signUpAndSubscribe };
}
