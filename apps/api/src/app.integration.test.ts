import { eq } from "@osg/core/db/query";
import {
  apikeys,
  deliveries,
  emailSuppressions,
  events,
  notificationChannels,
  repositories,
  subscriptionChannels,
  subscriptions,
  users,
} from "@osg/core/db/schema";
import type { GitHubApi, GitHubRepository } from "@osg/core/github";
import { createEmailLinks } from "@osg/core/links";
import { createMemorySender } from "@osg/core/mail";
import { one, startTestDatabase, type TestDatabase } from "@osg/core/testing";
import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { createAuth } from "./auth.ts";
import type { ApiContext } from "./context.ts";
import { onUserCreated } from "./services/channels.ts";

const AUTH_SECRET = "better-auth-test-secret-0123456789abcdef";
const EMAIL_SECRET = "email-token-test-secret-0123456789abcdef";
const WEB_URL = "http://localhost:3000";

let database: TestDatabase;
beforeAll(async () => {
  database = await startTestDatabase();
});
afterAll(async () => {
  await database?.stop();
});
beforeEach(async () => {
  await database.reset();
});

function fakeGitHub() {
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

async function setup() {
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

  return { app, ctx, github, mailer, signUp };
}

describe("health and authentication", () => {
  it("reports health", async () => {
    const { app } = await setup();
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.json()).toEqual({ status: "ok", database: "ok" });
  });

  it("rejects anonymous requests", async () => {
    const { app } = await setup();
    const response = await app.inject({ method: "GET", url: "/v1/me" });
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe("unauthorized");
  });

  it("sets up new users: active primary email channel and a welcome email", async () => {
    const { app, mailer, signUp } = await setup();
    const { cookie } = await signUp("ada");

    const me = await app.inject({ method: "GET", url: "/v1/me", headers: { cookie } });
    expect(me.json()).toMatchObject({ login: "ada", timezone: "UTC", digestHour: 8 });

    const channels = await app.inject({
      method: "GET",
      url: "/v1/me/channels",
      headers: { cookie },
    });
    expect(channels.json()).toMatchObject([
      { type: "email", address: "ada@example.com", status: "active", label: "Primary email" },
    ]);
    expect(mailer.sent.map((email) => [email.to, email.subject])).toEqual([
      ["ada@example.com", "Welcome to Open Source Guru"],
    ]);
  });

  it("updates settings and validates time zones", async () => {
    const { app, signUp } = await setup();
    const { cookie } = await signUp();

    const ok = await app.inject({
      method: "PATCH",
      url: "/v1/me",
      headers: { cookie },
      payload: { timezone: "Europe/Paris", digestHour: 18 },
    });
    expect(ok.json()).toMatchObject({ timezone: "Europe/Paris", digestHour: 18 });

    const bad = await app.inject({
      method: "PATCH",
      url: "/v1/me",
      headers: { cookie },
      payload: { timezone: "Mars/Olympus_Mons" },
    });
    expect(bad.statusCode).toBe(400);
  });
});

describe("personal API keys", () => {
  it("are created with a session, act as the user, and can be revoked", async () => {
    const { app, signUp } = await setup();
    const { cookie } = await signUp("ada");

    const created = await app.inject({
      method: "POST",
      url: "/v1/me/api-keys",
      headers: { cookie },
      payload: { name: "My script" },
    });
    expect(created.statusCode).toBe(201);
    const { key, id } = created.json();
    expect(key).toMatch(/^osg_/);
    const bearer = { authorization: `Bearer ${key}` };

    // Usable many times (no per-key daily limit).
    for (let i = 0; i < 12; i++) {
      const me = await app.inject({ method: "GET", url: "/v1/me", headers: bearer });
      expect(me.statusCode).toBe(200);
    }

    // A key can't manage keys or delete the account.
    const forbidden = await app.inject({ method: "GET", url: "/v1/me/api-keys", headers: bearer });
    expect(forbidden.statusCode).toBe(403);
    const noDelete = await app.inject({ method: "DELETE", url: "/v1/me", headers: bearer });
    expect(noDelete.statusCode).toBe(403);

    const listed = await app.inject({ method: "GET", url: "/v1/me/api-keys", headers: { cookie } });
    expect(listed.json()).toMatchObject([{ id, name: "My script" }]);
    expect(listed.json()[0]).not.toHaveProperty("key");

    await app.inject({ method: "DELETE", url: `/v1/me/api-keys/${id}`, headers: { cookie } });
    const revoked = await app.inject({ method: "GET", url: "/v1/me", headers: bearer });
    expect(revoked.statusCode).toBe(401);
  });

  it("rejects unknown keys", async () => {
    const { app } = await setup();
    const response = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: { authorization: "Bearer osg_notarealkey" },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("subscriptions", () => {
  it("creates a subscription from a GitHub URL, using the primary email by default", async () => {
    const { app, signUp } = await setup();
    const { cookie } = await signUp();

    const created = await app.inject({
      method: "POST",
      url: "/v1/me/subscriptions",
      headers: { cookie },
      payload: { repo: "https://github.com/ACME/repo", labels: ["help wanted", "help wanted"] },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      repo: { fullName: "acme/repo", url: "https://github.com/acme/repo" },
      labels: ["help wanted"],
      events: ["issue.opened", "issue.labeled"],
      labelMatch: "any",
      status: "active",
      channels: [{ frequency: "instant" }],
    });
    expect(await database.db.select().from(repositories)).toMatchObject([
      { githubId: 99, owner: "acme", name: "repo" },
    ]);
  });

  it("refuses unknown and private repositories", async () => {
    const { app, signUp } = await setup();
    const { cookie } = await signUp();

    for (const repo of ["acme/nope", "acme/secret"]) {
      const response = await app.inject({
        method: "POST",
        url: "/v1/me/subscriptions",
        headers: { cookie },
        payload: { repo },
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe("repository_not_found");
    }
    const invalid = await app.inject({
      method: "POST",
      url: "/v1/me/subscriptions",
      headers: { cookie },
      payload: { repo: "not a repo" },
    });
    expect(invalid.statusCode).toBe(400);
  });

  it("updates, pauses and deletes subscriptions; users can't touch others' subscriptions", async () => {
    const { app, signUp } = await setup();
    const ada = await signUp("ada");
    const bob = await signUp("bob");

    const created = await app.inject({
      method: "POST",
      url: "/v1/me/subscriptions",
      headers: { cookie: ada.cookie },
      payload: { repo: "acme/repo", labels: ["bug"] },
    });
    const { id, channels } = created.json();

    const updated = await app.inject({
      method: "PATCH",
      url: `/v1/me/subscriptions/${id}`,
      headers: { cookie: ada.cookie },
      payload: {
        labels: ["good first issue"],
        status: "paused",
        channels: [{ channelId: channels[0].channelId, frequency: "daily" }],
      },
    });
    expect(updated.json()).toMatchObject({
      labels: ["good first issue"],
      status: "paused",
      channels: [{ frequency: "daily" }],
    });

    const other = await app.inject({
      method: "DELETE",
      url: `/v1/me/subscriptions/${id}`,
      headers: { cookie: bob.cookie },
    });
    expect(other.statusCode).toBe(404);

    const deleted = await app.inject({
      method: "DELETE",
      url: `/v1/me/subscriptions/${id}`,
      headers: { cookie: ada.cookie },
    });
    expect(deleted.statusCode).toBe(204);
    const list = await app.inject({
      method: "GET",
      url: "/v1/me/subscriptions",
      headers: { cookie: ada.cookie },
    });
    expect(list.json()).toEqual([]);
  });
});

describe("email channels", () => {
  it("verifies added addresses with a signed link", async () => {
    const { app, mailer, signUp } = await setup();
    const { cookie } = await signUp();
    mailer.sent.length = 0;

    const created = await app.inject({
      method: "POST",
      url: "/v1/me/channels",
      headers: { cookie },
      payload: { address: "work@example.com", label: "Work" },
    });
    expect(created.json()).toMatchObject({ address: "work@example.com", status: "pending" });

    const [email] = mailer.sent;
    expect(email?.to).toBe("work@example.com");
    const link = email?.html.match(
      /href="(http:\/\/localhost:3000\/api\/v1\/public\/email\/verify\?token=[^"]+)"/,
    )?.[1];
    expect(link).toBeDefined();

    // The web app forwards /api/* to the API without the prefix.
    const url = new URL(link?.replaceAll("&amp;", "&") ?? "");
    const verified = await app.inject({
      method: "GET",
      url: `${url.pathname.replace(/^\/api/, "")}${url.search}`,
    });
    expect(verified.statusCode).toBe(200);
    expect(verified.body).toContain("Email address confirmed");

    const channels = await app.inject({
      method: "GET",
      url: "/v1/me/channels",
      headers: { cookie },
    });
    expect(channels.json().find((c: { label: string }) => c.label === "Work").status).toBe(
      "active",
    );

    const tampered = await app.inject({
      method: "GET",
      url: `/v1/public/email/verify?token=${url.searchParams.get("token")}x`,
    });
    expect(tampered.statusCode).toBe(400);
  });

  it("refuses duplicate addresses", async () => {
    const { app, signUp } = await setup();
    const { cookie } = await signUp("ada");
    const duplicate = await app.inject({
      method: "POST",
      url: "/v1/me/channels",
      headers: { cookie },
      payload: { address: "ADA@example.com" },
    });
    expect(duplicate.statusCode).toBe(409);
  });
});

describe("unsubscribing from emails", () => {
  async function subscribed() {
    const context = await setup();
    const { app, signUp } = context;
    const { cookie, user } = await signUp("ada");
    const created = await app.inject({
      method: "POST",
      url: "/v1/me/subscriptions",
      headers: { cookie },
      payload: { repo: "acme/repo" },
    });
    const subscription = created.json();
    const channelId = subscription.channels[0].channelId as string;
    return { ...context, cookie, user, subscription, channelId };
  }

  it("one-click unsubscribe (RFC 8058) stops every email to the address", async () => {
    const { app, ctx, channelId } = await subscribed();
    const url = new URL(ctx.links.unsubscribe(channelId));

    const response = await app.inject({
      method: "POST",
      url: `/v1/public/email/unsubscribe${url.search}`,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "List-Unsubscribe=One-Click",
    });

    expect(response.statusCode).toBe(200);
    const channel = await database.db.query.notificationChannels.findFirst({
      where: eq(notificationChannels.id, channelId),
    });
    expect(channel).toMatchObject({ status: "disabled", disabledReason: "unsubscribed" });
    expect(await database.db.select().from(subscriptionChannels)).toEqual([]);
    expect(await database.db.select().from(emailSuppressions)).toMatchObject([
      { address: "ada@example.com", reason: "unsubscribed" },
    ]);
  });

  it("the confirmation page changes nothing; its form unsubscribes from one repository", async () => {
    const { app, ctx, channelId, subscription } = await subscribed();
    const url = new URL(ctx.links.unsubscribe(channelId, [subscription.id]));
    const path = `/v1/public/email/unsubscribe${url.search}`;

    const confirm = await app.inject({ method: "GET", url: path });
    expect(confirm.body).toContain("notifications for this repository");
    expect(await database.db.select().from(subscriptionChannels)).toHaveLength(1);

    const done = await app.inject({ method: "POST", url: path });
    expect(done.body).toContain("won't receive notifications for this repository");
    expect(await database.db.select().from(subscriptionChannels)).toEqual([]);
    const channel = await database.db.query.notificationChannels.findFirst();
    expect(channel?.status).toBe("active");
  });
});

describe("repositories and feed", () => {
  it("lists labels by number of open issues, cached", async () => {
    const { app, github } = await setup();

    const first = await app.inject({ method: "GET", url: "/v1/public/repos/acme/repo/labels" });
    const second = await app.inject({ method: "GET", url: "/v1/public/repos/acme/repo/labels" });

    expect(first.json().map((label: { name: string }) => label.name)).toEqual([
      "help wanted",
      "bug",
    ]);
    expect(second.json()).toEqual(first.json());
    expect(github.calls.labels).toBe(1);
  });

  it("shows matched issues with their current state", async () => {
    const { app, signUp } = await setup();
    const { cookie } = await signUp();
    const created = await app.inject({
      method: "POST",
      url: "/v1/me/subscriptions",
      headers: { cookie },
      payload: { repo: "acme/repo" },
    });
    const { id: subscriptionId, channels } = created.json();
    const repo = await database.db.select().from(repositories).then(one);
    const event = await database.db
      .insert(events)
      .values({
        repoId: repo.id,
        issueNumber: 7,
        type: "issue.opened",
        occurredAt: new Date(),
        dedupeKey: "e1",
        issue: {
          number: 7,
          title: "Improve docs",
          htmlUrl: "https://github.com/acme/repo/issues/7",
          labels: [{ nodeId: "LA_2", name: "help wanted", color: "008672" }],
          assignees: [],
          authorLogin: "octocat",
        },
      })
      .returning()
      .then(one);
    await database.db.insert(deliveries).values({
      eventId: event.id,
      subscriptionId,
      channelId: channels[0].channelId,
      frequency: "instant",
    });

    const feed = await app.inject({ method: "GET", url: "/v1/me/feed", headers: { cookie } });

    expect(feed.json()).toMatchObject({
      items: [
        {
          type: "issue.opened",
          repo: { fullName: "acme/repo" },
          issue: { number: 7, title: "Improve docs", state: "open", labels: ["help wanted"] },
        },
      ],
      nextBefore: null,
    });
  });
});

describe("account deletion", () => {
  it("removes the user and everything personal", async () => {
    const { app, signUp } = await setup();
    const { cookie, user } = await signUp();
    await app.inject({
      method: "POST",
      url: "/v1/me/subscriptions",
      headers: { cookie },
      payload: { repo: "acme/repo" },
    });
    await app.inject({
      method: "POST",
      url: "/v1/me/api-keys",
      headers: { cookie },
      payload: { name: "k" },
    });

    const response = await app.inject({ method: "DELETE", url: "/v1/me", headers: { cookie } });

    expect(response.statusCode).toBe(204);
    expect(await database.db.select().from(users).where(eq(users.id, user.id))).toEqual([]);
    expect(await database.db.select().from(subscriptions)).toEqual([]);
    expect(await database.db.select().from(notificationChannels)).toEqual([]);
    expect(await database.db.select().from(apikeys)).toEqual([]);
    // Shared GitHub data stays.
    expect(await database.db.select().from(repositories)).toHaveLength(1);
  });
});
