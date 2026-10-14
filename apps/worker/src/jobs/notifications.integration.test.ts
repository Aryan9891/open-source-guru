import { eq } from "@osg/core/db/query";
import {
  deliveries,
  emailSuppressions,
  events,
  type Frequency,
  notificationChannels,
  repositories,
  subscriptionChannels,
  subscriptions,
  users,
} from "@osg/core/db/schema";
import { type GitHubApi, type IssuesPage, RepositoryNotFoundError } from "@osg/core/github";
import { createEmailLinks } from "@osg/core/links";
import { createMemorySender, PermanentEmailError } from "@osg/core/mail";
import type { GitHubIssue } from "@osg/core/polling";
import { one, startTestDatabase, type TestDatabase } from "@osg/core/testing";
import { verifyEmailToken } from "@osg/core/tokens";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { WorkerContext } from "../context.ts";
import { fanOutEvents } from "./fanout.ts";
import { pollRepository } from "./poll-repo.ts";
import { findRepositoriesDue } from "./schedule-polls.ts";
import { INSTANT_BATCH_WINDOW_MS, sendDueNotifications } from "./send-notifications.ts";

const SECRET = "integration-test-secret-0123456789abcdef";
const helpWanted = { nodeId: "LA_hw", name: "help wanted", color: "008672" };
const goodFirstIssue = { nodeId: "LA_gfi", name: "good first issue", color: "7057ff" };

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

/** A GitHub fake that serves whatever the test sets as the current list of issues. */
function fakeGitHub() {
  const state = {
    issues: [] as GitHubIssue[],
    etag: 'W/"1"',
    notFound: false,
    requests: [] as {
      state: string;
      since: Date | null | undefined;
      etag: string | null | undefined;
    }[],
  };
  const api: GitHubApi = {
    getRepository: async () => null,
    listRepoLabels: async () => [],
    async listIssuesPage(params): Promise<IssuesPage> {
      state.requests.push({ state: params.state, since: params.since, etag: params.etag });
      if (state.notFound) throw new RepositoryNotFoundError("acme/repo");
      if (params.etag && params.etag === state.etag) return { notModified: true };
      const matching = state.issues.filter(
        (issue) =>
          (params.state === "all" || issue.state === "open") &&
          (!params.since || issue.updatedAt >= params.since),
      );
      return { notModified: false, etag: state.etag, issues: matching, hasNextPage: false };
    },
  };
  return { api, state };
}

const issue = (number: number, overrides: Partial<GitHubIssue> = {}): GitHubIssue => ({
  githubId: 5000 + number,
  number,
  title: `Issue ${number}`,
  htmlUrl: `https://github.com/acme/repo/issues/${number}`,
  state: "open",
  labels: [],
  assignees: [],
  authorLogin: "octocat",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

async function setup(
  options: { frequency?: Frequency; timezone?: string; digestHour?: number } = {},
) {
  const github = fakeGitHub();
  const mailer = createMemorySender();
  let now = new Date("2026-10-14T10:00:00Z");
  const ctx: WorkerContext = {
    db: database.db,
    github: github.api,
    mailer,
    links: createEmailLinks({ webUrl: "https://osg.test", secret: SECRET }),
    log: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    now: () => now,
  };
  const advance = (ms: number) => {
    now = new Date(now.getTime() + ms);
    return now;
  };

  const user = await database.db
    .insert(users)
    .values({
      name: "Ada",
      email: "ada@example.com",
      emailVerified: true,
      githubId: 1,
      login: "ada",
      timezone: options.timezone ?? "UTC",
      digestHour: options.digestHour ?? 8,
    })
    .returning()
    .then(one);
  const channel = await database.db
    .insert(notificationChannels)
    .values({
      userId: user.id,
      type: "email",
      label: "Primary email",
      config: { address: "ada@example.com" },
      status: "active",
      verifiedAt: now,
    })
    .returning()
    .then(one);
  const repo = await database.db
    .insert(repositories)
    .values({ githubId: 99, owner: "acme", name: "repo", nextPollAt: now })
    .returning()
    .then(one);
  // Subscribed before anything happens in this test.
  const subscription = await database.db
    .insert(subscriptions)
    .values({
      userId: user.id,
      repoId: repo.id,
      eventTypes: ["issue.opened", "issue.labeled"],
      labels: ["Help Wanted"],
      createdAt: new Date("2026-10-14T09:00:00Z"),
    })
    .returning()
    .then(one);
  await database.db.insert(subscriptionChannels).values({
    subscriptionId: subscription.id,
    channelId: channel.id,
    frequency: options.frequency ?? "instant",
  });

  return {
    ctx,
    github,
    mailer,
    advance,
    repo: repo,
    channel: channel,
    subscription: subscription,
  };
}

describe("polling", () => {
  it("stores a snapshot on the first poll without creating events", async () => {
    const { ctx, github, repo } = await setup();
    github.state.issues = [issue(1, { labels: [helpWanted] }), issue(2, { state: "closed" })];

    const result = await pollRepository(ctx, repo.id);

    expect(result).toEqual({ outcome: "initialized", issues: 1 });
    expect(github.state.requests[0]).toMatchObject({ state: "open", since: undefined });
    expect(await database.db.select().from(events)).toEqual([]);
    const saved = await database.db.query.repositories.findFirst({
      where: eq(repositories.id, repo.id),
    });
    expect(saved?.initializedAt).toEqual(ctx.now());
  });

  it("detects new issues and added labels on later polls", async () => {
    const { ctx, github, advance, repo } = await setup();
    github.state.issues = [issue(1)];
    await pollRepository(ctx, repo.id);

    const later = advance(2 * 60 * 1000);
    github.state.etag = 'W/"2"';
    github.state.issues = [
      issue(1, { labels: [helpWanted], updatedAt: later }),
      issue(2, { labels: [goodFirstIssue], createdAt: later, updatedAt: later }),
    ];
    const result = await pollRepository(ctx, repo.id);

    expect(result).toEqual({ outcome: "updated", issues: 2, events: 2 });
    const saved = await database.db.select().from(events);
    expect(saved.map((event) => [event.type, event.issueNumber, event.label]).sort()).toEqual([
      ["issue.labeled", 1, "help wanted"],
      ["issue.opened", 2, null],
    ]);

    // Polling the same data again creates nothing new.
    github.state.etag = 'W/"3"';
    expect(await pollRepository(ctx, repo.id)).toMatchObject({ outcome: "updated", events: 0 });
  });

  it("uses the ETag and handles 304 Not Modified", async () => {
    const { ctx, github, repo } = await setup();
    await pollRepository(ctx, repo.id);
    await pollRepository(ctx, repo.id); // stores ETag W/"1"

    expect(await pollRepository(ctx, repo.id)).toEqual({ outcome: "not_modified" });
    expect(github.state.requests.at(-1)?.etag).toBe('W/"1"');
  });

  it("stops polling repositories that no longer exist", async () => {
    const { ctx, github, repo } = await setup();
    await pollRepository(ctx, repo.id);
    github.state.notFound = true;

    expect(await pollRepository(ctx, repo.id)).toEqual({ outcome: "not_found" });
    expect(await findRepositoriesDue(ctx)).toEqual([]);
  });

  it("only schedules repositories that are due and followed", async () => {
    const { ctx, advance, repo } = await setup();
    expect(await findRepositoriesDue(ctx)).toEqual([repo.id]);

    await pollRepository(ctx, repo.id);
    expect(await findRepositoriesDue(ctx)).toEqual([]);

    advance(repo.pollIntervalSeconds * 1000);
    expect(await findRepositoriesDue(ctx)).toEqual([repo.id]);
  });
});

/** Polls once to initialize, then once more with a new matching issue. */
async function produceMatchingEvent(context: Awaited<ReturnType<typeof setup>>) {
  const { ctx, github, advance, repo } = context;
  await pollRepository(ctx, repo.id);
  const later = advance(60 * 1000);
  github.state.etag = 'W/"2"';
  github.state.issues = [
    issue(7, { title: "Improve docs", labels: [helpWanted], createdAt: later, updatedAt: later }),
    issue(8, { labels: [goodFirstIssue], createdAt: later, updatedAt: later }),
  ];
  await pollRepository(ctx, repo.id);
  await fanOutEvents(ctx);
}

describe("fanout and instant emails", () => {
  it("emails matching issues once the batch window has passed", async () => {
    const context = await setup();
    await produceMatchingEvent(context);
    const { ctx, mailer, advance, channel, subscription } = context;

    // Only #7 matches "help wanted".
    expect(await database.db.select().from(deliveries)).toHaveLength(1);

    expect(await sendDueNotifications(ctx, "instant")).toEqual({ emails: 0, failed: 0 });
    advance(INSTANT_BATCH_WINDOW_MS);
    expect(await sendDueNotifications(ctx, "instant")).toEqual({ emails: 1, failed: 0 });

    const [email] = mailer.sent;
    expect(email?.to).toBe("ada@example.com");
    expect(email?.subject).toBe("acme/repo#7: Improve docs");
    expect(email?.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    const unsubscribeUrl = email?.headers?.["List-Unsubscribe"]?.slice(1, -1) ?? "";
    const token = new URL(unsubscribeUrl).searchParams.get("token") ?? "";
    expect(verifyEmailToken(token, SECRET)).toEqual({
      purpose: "unsubscribe",
      channelId: channel.id,
    });
    expect(email?.html).toContain(encodeURIComponent(token).slice(0, 20));
    expect(email?.html).not.toContain("#8");

    const [delivery] = await database.db.select().from(deliveries);
    expect(delivery).toMatchObject({
      status: "sent",
      subscriptionId: subscription.id,
      attempts: 1,
    });

    // Nothing is sent twice.
    advance(INSTANT_BATCH_WINDOW_MS);
    expect(await sendDueNotifications(ctx, "instant")).toEqual({ emails: 0, failed: 0 });
  });

  it("doesn't replay events detected before the subscription existed", async () => {
    const context = await setup();
    await database.db
      .update(subscriptions)
      .set({ createdAt: new Date("2026-10-15T00:00:00Z") })
      .where(eq(subscriptions.id, context.subscription.id));

    await produceMatchingEvent(context);

    expect(await database.db.select().from(deliveries)).toEqual([]);
  });

  it("skips deliveries of paused subscriptions", async () => {
    const context = await setup();
    await produceMatchingEvent(context);
    await database.db
      .update(subscriptions)
      .set({ status: "paused" })
      .where(eq(subscriptions.id, context.subscription.id));

    context.advance(INSTANT_BATCH_WINDOW_MS);
    await sendDueNotifications(context.ctx, "instant");

    expect(context.mailer.sent).toEqual([]);
    expect((await database.db.select().from(deliveries))[0]?.status).toBe("skipped");
  });

  it("disables the channel and suppresses the address on a permanent rejection", async () => {
    const context = await setup();
    await produceMatchingEvent(context);
    context.ctx.mailer.send = async () => {
      throw new PermanentEmailError("550 mailbox unavailable");
    };

    context.advance(INSTANT_BATCH_WINDOW_MS);
    expect(await sendDueNotifications(context.ctx, "instant")).toEqual({ emails: 0, failed: 1 });

    const channel = await database.db.query.notificationChannels.findFirst();
    expect(channel).toMatchObject({ status: "disabled", disabledReason: "bounced" });
    expect(await database.db.select().from(emailSuppressions)).toMatchObject([
      { address: "ada@example.com", reason: "bounce" },
    ]);
  });

  it("retries temporary failures later", async () => {
    const context = await setup();
    await produceMatchingEvent(context);
    const send = context.ctx.mailer.send;
    context.ctx.mailer.send = async () => {
      throw new Error("connection timed out");
    };

    context.advance(INSTANT_BATCH_WINDOW_MS);
    expect(await sendDueNotifications(context.ctx, "instant")).toEqual({ emails: 0, failed: 1 });
    expect((await database.db.select().from(deliveries))[0]).toMatchObject({
      status: "pending",
      attempts: 1,
      lastError: "connection timed out",
    });

    context.ctx.mailer.send = send;
    expect(await sendDueNotifications(context.ctx, "instant")).toEqual({ emails: 0, failed: 0 });
    context.advance(60 * 1000);
    expect(await sendDueNotifications(context.ctx, "instant")).toEqual({ emails: 1, failed: 0 });
  });
});

describe("digests", () => {
  it("sends daily digests during the user's chosen local hour", async () => {
    // 10:00 UTC is 12:00 in Paris; the user wants their digest at 13:00.
    const context = await setup({ frequency: "daily", timezone: "Europe/Paris", digestHour: 13 });
    await produceMatchingEvent(context);

    expect(await sendDueNotifications(context.ctx, "daily")).toEqual({ emails: 0, failed: 0 });

    context.advance(60 * 60 * 1000);
    expect(await sendDueNotifications(context.ctx, "daily")).toEqual({ emails: 1, failed: 0 });
    expect(context.mailer.sent[0]?.subject).toBe("Daily digest: acme/repo#7: Improve docs");
  });

  it("sends hourly digests whenever deliveries are pending", async () => {
    const context = await setup({ frequency: "hourly" });
    await produceMatchingEvent(context);

    expect(await sendDueNotifications(context.ctx, "instant")).toEqual({ emails: 0, failed: 0 });
    expect(await sendDueNotifications(context.ctx, "hourly")).toEqual({ emails: 1, failed: 0 });
  });
});
