// Shared setup for the worker integration tests: one user following `acme/repo`,
// a scripted GitHub, an in-memory mailer and a clock the test controls.
import {
  type Frequency,
  notificationChannels,
  repositories,
  subscriptionChannels,
  subscriptions,
  users,
} from "@osg/core/db/schema";
import { type GitHubApi, type IssuesPage, RepositoryNotFoundError } from "@osg/core/github";
import { createEmailLinks } from "@osg/core/links";
import { createMemorySender } from "@osg/core/mail";
import type { GitHubIssue } from "@osg/core/polling";
import { one, type TestDatabase } from "@osg/core/testing";
import type { WorkerContext } from "../context.ts";
import { fanOutEvents } from "../jobs/fanout.ts";
import { pollRepository } from "../jobs/poll-repo.ts";

export { useTestDatabase } from "@osg/core/testing";

export const SECRET = "integration-test-secret-0123456789abcdef";
export const helpWanted = { nodeId: "LA_hw", name: "help wanted", color: "008672" };
export const goodFirstIssue = { nodeId: "LA_gfi", name: "good first issue", color: "7057ff" };

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

export const issue = (number: number, overrides: Partial<GitHubIssue> = {}): GitHubIssue => ({
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

export async function createWorkerTest(
  database: TestDatabase,
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

  return { ctx, github, mailer, advance, repo, channel, subscription };
}

/** Polls once to initialize, then once more with a new matching issue (#7) and another (#8). */
export async function produceMatchingEvent(context: Awaited<ReturnType<typeof createWorkerTest>>) {
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
