// The real "Sign in with GitHub" flow through our app, with GitHub's servers mocked.
import { eq } from "@osg/core/db/query";
import { accounts, notificationChannels, users } from "@osg/core/db/schema";
import { createEmailLinks } from "@osg/core/links";
import { createMemorySender } from "@osg/core/mail";
import { startTestDatabase, type TestDatabase } from "@osg/core/testing";
import { HttpResponse, http } from "msw/http";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { createAuth } from "./auth.ts";
import type { ApiContext } from "./context.ts";
import { onUserCreated } from "./services/channels.ts";

const WEB_URL = "http://localhost:3000";
const AUTH_SECRET = "better-auth-test-secret-0123456789abcdef";

let database: TestDatabase;
// Only GitHub's hosts are mocked; anything else (Testcontainers, Postgres) passes through.
const github = setupServer();

beforeAll(async () => {
  database = await startTestDatabase();
  github.listen({ onUnhandledFrame: "bypass" });
});
afterEach(() => github.resetHandlers());
afterAll(async () => {
  github.close();
  await database?.stop();
});
beforeEach(async () => {
  await database.reset();
});

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  /** Public profile email; null when the user keeps it private (the common case). */
  email: string | null;
  bio?: string | null;
  createdAt?: string;
  emails: { email: string; primary: boolean; verified: boolean }[] | "forbidden";
}

function mockGitHub(user: GitHubUser) {
  github.use(
    http.post("https://github.com/login/oauth/access_token", () =>
      HttpResponse.json({
        access_token: "ghu_user_token",
        token_type: "bearer",
        scope: "",
        expires_in: 28800,
        refresh_token: "ghr_refresh_token",
        refresh_token_expires_in: 15897600,
      }),
    ),
    http.get("https://api.github.com/user", () =>
      HttpResponse.json({
        id: user.id,
        login: user.login,
        name: user.name,
        email: user.email,
        bio: user.bio ?? null,
        created_at: user.createdAt ?? "2015-06-01T10:00:00Z",
        avatar_url: `https://avatars.githubusercontent.com/u/${user.id}`,
      }),
    ),
    http.get("https://api.github.com/user/emails", () =>
      user.emails === "forbidden"
        ? HttpResponse.json({ message: "Resource not accessible by integration" }, { status: 403 })
        : HttpResponse.json(user.emails),
    ),
  );
}

async function setup() {
  const mailer = createMemorySender();
  const ctx = {} as ApiContext;
  Object.assign(ctx, {
    db: database.db,
    auth: createAuth({
      db: database.db,
      secret: AUTH_SECRET,
      webUrl: WEB_URL,
      github: { clientId: "Iv1.test", clientSecret: "secret" },
      onUserCreated: (user) => onUserCreated(ctx, user),
    }),
    github: {
      getRepository: async () => null,
      listRepoLabels: async () => [],
      listIssuesPage: async () => ({ notModified: true }),
    },
    mailer,
    links: createEmailLinks({
      webUrl: WEB_URL,
      secret: "email-token-test-secret-0123456789abcdef",
    }),
    emailTokenSecret: "email-token-test-secret-0123456789abcdef",
    now: () => new Date(),
  } satisfies ApiContext);
  const app = await buildApp({ ...ctx, pingDatabase: database.ping });
  return { app, mailer };
}

const cookiesOf = (setCookie: string | string[] | undefined) =>
  (Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [])
    .map((cookie) => cookie.split(";")[0])
    .join("; ");

/** Clicks "Sign in with GitHub", approves on GitHub, and follows the callback. */
async function signInWithGitHub(app: Awaited<ReturnType<typeof setup>>["app"]) {
  const start = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/social",
    headers: { origin: WEB_URL, "content-type": "application/json" },
    payload: { provider: "github", callbackURL: "/dashboard" },
  });
  expect(start.statusCode).toBe(200);
  const authorizeUrl = new URL(start.json().url);
  expect(authorizeUrl.origin).toBe("https://github.com");
  expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(`${WEB_URL}/api/auth/callback/github`);

  // GitHub redirects back to the callback with a code and the same state.
  const state = authorizeUrl.searchParams.get("state");
  const callback = await app.inject({
    method: "GET",
    url: `/api/auth/callback/github?code=test-code&state=${state}`,
    headers: { cookie: cookiesOf(start.headers["set-cookie"]) },
  });
  return { callback, cookie: cookiesOf(callback.headers["set-cookie"]) };
}

describe("sign in with GitHub", () => {
  it("creates the user from the GitHub profile, with a private email (via /user/emails)", async () => {
    const { app, mailer } = await setup();
    mockGitHub({
      id: 4_000_000_001,
      login: "ada",
      name: "Ada Lovelace",
      email: null,
      bio: "Writes programs for engines.",
      createdAt: "2012-03-04T05:06:07Z",
      emails: [
        { email: "old@example.com", primary: false, verified: true },
        { email: "ada@example.com", primary: true, verified: true },
      ],
    });

    const { callback, cookie } = await signInWithGitHub(app);

    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe("/dashboard");

    const me = await app.inject({ method: "GET", url: "/v1/me", headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      login: "ada",
      name: "Ada Lovelace",
      email: "ada@example.com",
    });

    const [user] = await database.db.select().from(users);
    expect(user).toMatchObject({
      githubId: 4_000_000_001,
      bio: "Writes programs for engines.",
      githubCreatedAt: new Date("2012-03-04T05:06:07Z"),
      // Phase 2 settings start with their defaults.
      profilePublic: true,
      streakPeriod: "week",
      streakReminders: false,
      goalEmails: false,
    });
    const channels = await database.db.select().from(notificationChannels);
    expect(channels).toMatchObject([{ status: "active", config: { address: "ada@example.com" } }]);
    expect(mailer.sent.map((email) => email.subject)).toEqual(["Welcome to Open Source Guru"]);

    // GitHub tokens are stored encrypted.
    const [account] = await database.db.select().from(accounts);
    expect(account?.accessToken).toBeTruthy();
    expect(account?.accessToken).not.toContain("ghu_user_token");
  });

  it("updates the login when it changed on GitHub, without creating another user", async () => {
    const { app } = await setup();
    const profile: GitHubUser = {
      id: 42,
      login: "ada",
      name: null,
      email: "ada@example.com",
      emails: [{ email: "ada@example.com", primary: true, verified: true }],
    };
    mockGitHub(profile);
    await signInWithGitHub(app);

    mockGitHub({ ...profile, login: "ada-lovelace" });
    await signInWithGitHub(app);

    const all = await database.db.select().from(users);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ login: "ada-lovelace", githubId: 42 });
  });

  it("fails clearly when the app can't read the user's email addresses", async () => {
    const { app } = await setup();
    mockGitHub({ id: 7, login: "bob", name: null, email: null, emails: "forbidden" });

    const { callback } = await signInWithGitHub(app);

    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toContain("error=email_not_found");
    expect(await database.db.select().from(users).where(eq(users.githubId, 7))).toEqual([]);
  });
});

describe("Better Auth endpoints that are turned off", () => {
  it("don't let clients change the GitHub-backed profile or manage API keys", async () => {
    const { app } = await setup();
    mockGitHub({
      id: 9,
      login: "eve",
      name: null,
      email: "eve@example.com",
      emails: [{ email: "eve@example.com", primary: true, verified: true }],
    });
    const { cookie } = await signInWithGitHub(app);

    for (const [url, payload] of [
      ["/api/auth/update-user", { login: "someone-else", githubId: 1 }],
      ["/api/auth/api-key/create", { name: "sneaky" }],
      ["/api/auth/sign-up/email", { email: "x@example.com", password: "password123", name: "x" }],
    ] as const) {
      const response = await app.inject({
        method: "POST",
        url,
        headers: { cookie, origin: WEB_URL, "content-type": "application/json" },
        payload,
      });
      expect(response.statusCode, url).toBe(404);
    }

    const [user] = await database.db.select().from(users);
    expect(user).toMatchObject({ login: "eve", githubId: 9 });
  });
});
