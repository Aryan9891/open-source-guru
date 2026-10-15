import { Octokit } from "@octokit/rest";
import { HttpResponse, http } from "msw/http";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createGitHubContributionsApi } from "./contributions.ts";

const BASE = "https://api.github.test";
const server = setupServer();
const api = createGitHubContributionsApi(new Octokit({ baseUrl: BASE, auth: "test-token" }));

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const repo = (name: string, extra: Record<string, unknown> = {}) => ({
  databaseId: name.length * 1000,
  name,
  owner: { login: "acme", databaseId: 77 },
  isPrivate: false,
  isFork: false,
  licenseInfo: { spdxId: "MIT" },
  ...extra,
});

const page = <T>(nodes: T[], next: string | null = null) => ({
  pageInfo: { hasNextPage: next !== null, endCursor: next },
  nodes,
});

interface GraphQLRequest {
  query: string;
  variables: Record<string, string | null>;
}

/** Answers GraphQL requests by operation name; records the requests. */
function mockGraphQL(
  handlers: Record<string, (variables: GraphQLRequest["variables"]) => unknown>,
) {
  const requests: GraphQLRequest[] = [];
  server.use(
    http.post(`${BASE}/graphql`, async ({ request }) => {
      const body = (await request.json()) as GraphQLRequest;
      requests.push(body);
      const operation = /query (\w+)/.exec(body.query)?.[1] ?? "";
      const handler = handlers[operation];
      if (!handler) throw new Error(`Unexpected GraphQL operation ${operation}`);
      return HttpResponse.json({ data: handler(body.variables) });
    }),
  );
  return requests;
}

const collection = (fields: unknown) => ({ user: { contributionsCollection: fields } });

describe("fetchContributions", () => {
  it("fetches commits per quarter and every other type with pagination", async () => {
    const requests = mockGraphQL({
      Commits: (variables) =>
        collection({
          restrictedContributionsCount: 2,
          commitContributionsByRepository:
            variables.from === "2026-01-01T00:00:00.000Z"
              ? [
                  {
                    repository: repo("lib"),
                    // Midnight Pacific time on March 3.
                    contributions: {
                      nodes: [{ occurredAt: "2026-03-03T08:00:00Z", commitCount: 4 }],
                    },
                  },
                ]
              : [],
        }),
      Contributions: (variables) => {
        const query = requests.at(-1)?.query ?? "";
        if (query.includes("issueContributions")) {
          return collection({
            issueContributions:
              variables.after === null
                ? page(
                    [
                      {
                        occurredAt: "2026-02-01T23:30:00Z",
                        issue: {
                          id: "I_1",
                          title: "Bug",
                          url: "https://x/i/1",
                          repository: repo("lib"),
                        },
                      },
                    ],
                    "cursor-1",
                  )
                : page([
                    {
                      occurredAt: "2026-02-02T01:00:00Z",
                      issue: {
                        id: "I_2",
                        title: "Idea",
                        url: "https://x/i/2",
                        repository: repo("lib"),
                      },
                    },
                  ]),
          });
        }
        if (query.includes("pullRequestContributions")) {
          return collection({
            pullRequestContributions: page([
              {
                occurredAt: "2026-04-10T10:00:00Z",
                pullRequest: {
                  id: "PR_1",
                  title: "Fix",
                  url: "https://x/pr/1",
                  state: "MERGED",
                  mergedAt: "2026-04-12T09:00:00Z",
                  repository: repo("app", { licenseInfo: null }),
                },
              },
            ]),
          });
        }
        return collection({
          pullRequestReviewContributions: page([
            {
              occurredAt: "2026-05-05T05:00:00Z",
              pullRequestReview: { id: "PRR_1", url: "https://x/pr/2#review" },
              pullRequest: { title: "Feature" },
              repository: repo("app"),
            },
          ]),
        });
      },
    });

    const result = await api.fetchContributions(
      "ada",
      new Date("2026-01-01T00:00:00Z"),
      new Date("2027-01-01T00:00:00Z"),
    );

    // Four quarters of commits, then issues (two pages), pull requests and reviews.
    expect(requests.map((request) => /query (\w+)/.exec(request.query)?.[1])).toEqual([
      "Commits",
      "Commits",
      "Commits",
      "Commits",
      "Contributions",
      "Contributions",
      "Contributions",
      "Contributions",
    ]);
    expect(requests.slice(0, 4).map((request) => request.variables.to)).toEqual([
      "2026-04-01T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z",
      "2027-01-01T00:00:00.000Z",
    ]);
    expect(result.restrictedCount).toBe(8);
    expect(result.contributions).toEqual([
      expect.objectContaining({
        kind: "commit",
        nodeId: null,
        date: "2026-03-03",
        count: 4,
        url: "https://github.com/acme/lib/commits?author=ada&since=2026-03-03&until=2026-03-03",
        repo: {
          githubId: 3000,
          owner: "acme",
          name: "lib",
          ownerGithubId: 77,
          isPrivate: false,
          isFork: false,
          licenseSpdxId: "MIT",
        },
      }),
      expect.objectContaining({ kind: "issue", nodeId: "I_1", title: "Bug", date: "2026-02-01" }),
      expect.objectContaining({ kind: "issue", nodeId: "I_2", date: "2026-02-02" }),
      expect.objectContaining({
        kind: "pull_request",
        nodeId: "PR_1",
        prState: "merged",
        prMergedAt: new Date("2026-04-12T09:00:00Z"),
        repo: expect.objectContaining({ name: "app", licenseSpdxId: null }),
      }),
      expect.objectContaining({
        kind: "review",
        nodeId: "PRR_1",
        title: "Feature",
        url: "https://x/pr/2#review",
      }),
    ]);
  });
});

const discussion = (id: string, createdAt: string, title = "A discussion") => ({
  id,
  title,
  url: `https://x/d/${id}`,
  createdAt,
  repository: repo("lib"),
});

const answer = (id: string, createdAt: string, title: string) => ({
  id,
  url: `https://x/a/${id}`,
  createdAt,
  discussion: { title, repository: repo("app") },
});

describe("fetchDiscussions", () => {
  it("keeps discussions opened and answers given in the window", async () => {
    const requests = mockGraphQL({
      // Newest first; the first page already reaches before the window, so no second page.
      Discussions: () => ({
        user: {
          repositoryDiscussions: page(
            [
              discussion("D_new", "2027-02-01T00:00:00Z"),
              discussion("D_in", "2026-06-01T00:00:00Z", "Roadmap"),
              discussion("D_old", "2025-06-01T00:00:00Z"),
            ],
            "more",
          ),
        },
      }),
      Answers: () => ({
        user: {
          repositoryDiscussionComments: page([
            answer("DC_in", "2026-07-01T00:00:00Z", "How?"),
            answer("DC_old", "2024-01-01T00:00:00Z", "Why?"),
          ]),
        },
      }),
    });

    const result = await api.fetchDiscussions(
      "ada",
      new Date("2026-01-01T00:00:00Z"),
      new Date("2027-01-01T00:00:00Z"),
    );

    expect(requests).toHaveLength(2);
    expect(result).toEqual([
      expect.objectContaining({
        kind: "discussion",
        nodeId: "D_in",
        title: "Roadmap",
        date: "2026-06-01",
      }),
      expect.objectContaining({
        kind: "discussion",
        nodeId: "DC_in",
        title: "How?",
        url: "https://x/a/DC_in",
      }),
    ]);
  });
});

describe("getRepositoryById", () => {
  it("returns the repository's current facts, or null when it's gone", async () => {
    server.use(
      http.get(`${BASE}/repositories/:id`, ({ params }) =>
        params.id === "42"
          ? HttpResponse.json({
              id: 42,
              name: "renamed",
              owner: { login: "new-owner", id: 9 },
              private: false,
              fork: false,
              license: { spdx_id: "Apache-2.0" },
            })
          : HttpResponse.json({ message: "Not Found" }, { status: 404 }),
      ),
    );

    expect(await api.getRepositoryById(42)).toEqual({
      githubId: 42,
      owner: "new-owner",
      name: "renamed",
      ownerGithubId: 9,
      isPrivate: false,
      isFork: false,
      licenseSpdxId: "Apache-2.0",
    });
    expect(await api.getRepositoryById(43)).toBeNull();
  });
});
