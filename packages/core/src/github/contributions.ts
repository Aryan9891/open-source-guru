// Fetching a user's contributions from GitHub's GraphQL API (PLAN.md §4.2).

import { RequestError } from "@octokit/request-error";
import type { Octokit } from "@octokit/rest";
import type { RepoFacts } from "../contributions/classify.ts";
import { githubContributionDate, type IsoDate } from "../contributions/dates.ts";
import type { ContributionKind, PullRequestState } from "../db/schema/contributions.ts";
import {
  ANSWERS_QUERY,
  COMMITS_QUERY,
  CONNECTIONS,
  connectionQuery,
  DISCUSSIONS_QUERY,
  type Page,
  type RawConnectionNode,
  type RawRepo,
  toRepo,
} from "./contributions-queries.ts";

export interface GitHubRepoFacts extends RepoFacts {
  githubId: number;
  owner: string;
  name: string;
}

export interface FetchedContribution {
  kind: ContributionKind;
  /** GitHub node ID; null for commits (reported as a count per repository per day). */
  nodeId: string | null;
  repo: GitHubRepoFacts;
  title: string | null;
  url: string;
  occurredAt: Date;
  /** The day it shows on GitHub's graph. */
  date: IsoDate;
  count: number;
  prState: PullRequestState | null;
  prMergedAt: Date | null;
}

export interface GitHubContributionsApi {
  /** Commits, issues, pull requests and reviews in [from, to), at most one year. */
  fetchContributions(
    login: string,
    from: Date,
    to: Date,
  ): Promise<{ contributions: FetchedContribution[]; restrictedCount: number }>;
  /** Discussions opened and accepted answers in [from, to). */
  fetchDiscussions(login: string, from: Date, to: Date): Promise<FetchedContribution[]>;
  /** Current facts about a repository, by GitHub ID (rename-proof); null when it's gone. */
  getRepositoryById(githubId: number): Promise<GitHubRepoFacts | null>;
}

/** Safety limit on pages per connection (100 items each). */
const MAX_PAGES = 50;

function item(
  kind: ContributionKind,
  fields: Omit<FetchedContribution, "kind" | "date" | "count" | "prState" | "prMergedAt"> &
    Partial<Pick<FetchedContribution, "count" | "prState" | "prMergedAt">>,
): FetchedContribution {
  return {
    kind,
    count: 1,
    prState: null,
    prMergedAt: null,
    ...fields,
    date: githubContributionDate(kind === "commit" ? "commit" : "other", fields.occurredAt),
  };
}

function fromConnectionNode(
  kind: keyof typeof CONNECTIONS,
  node: RawConnectionNode,
): FetchedContribution | null {
  const occurredAt = new Date(node.occurredAt);
  if (kind === "issue" && node.issue) {
    const { id, title, url, repository } = node.issue;
    return item(kind, { nodeId: id, repo: toRepo(repository), title, url, occurredAt });
  }
  const pr = node.pullRequest;
  if (kind === "pull_request" && pr?.id && pr.url && pr.repository) {
    const { id, title, url, state, mergedAt, repository } = pr;
    return item(kind, {
      nodeId: id,
      repo: toRepo(repository),
      title,
      url,
      occurredAt,
      prState: state === "MERGED" ? "merged" : state === "CLOSED" ? "closed" : "open",
      prMergedAt: mergedAt ? new Date(mergedAt) : null,
    });
  }
  if (kind === "review" && node.pullRequestReview && node.repository) {
    return item(kind, {
      nodeId: node.pullRequestReview.id,
      repo: toRepo(node.repository),
      title: node.pullRequest?.title ?? null,
      url: node.pullRequestReview.url,
      occurredAt,
    });
  }
  return null;
}

/** Follows `after` cursors until `keepGoing` says stop or there are no more pages. */
async function paginate<T>(
  fetchPage: (after: string | null) => Promise<Page<T> | null>,
  keepGoing: (nodes: T[]) => boolean = () => true,
): Promise<T[]> {
  const all: T[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetchPage(after);
    if (!result) break;
    all.push(...result.nodes);
    if (!result.pageInfo.hasNextPage || !keepGoing(result.nodes)) break;
    after = result.pageInfo.endCursor;
  }
  return all;
}

/** Commits are fetched per quarter: a repository then has at most ~92 days, under the 100 limit. */
function quarters(from: Date, to: Date): [Date, Date][] {
  const windows: [Date, Date][] = [];
  let start = from;
  while (start < to) {
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 3);
    windows.push([start, end < to ? end : to]);
    start = end;
  }
  return windows;
}

export function createGitHubContributionsApi(octokit: Octokit): GitHubContributionsApi {
  const commitsIn = async (login: string, from: Date, to: Date) => {
    type Result = {
      user: {
        contributionsCollection: {
          restrictedContributionsCount: number;
          commitContributionsByRepository: {
            repository: RawRepo;
            contributions: { nodes: { occurredAt: string; commitCount: number }[] };
          }[];
        };
      } | null;
    };
    const result: Result = await octokit.graphql(COMMITS_QUERY, {
      login,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    const collection = result.user?.contributionsCollection;
    const contributions = (collection?.commitContributionsByRepository ?? []).flatMap((entry) => {
      const repo = toRepo(entry.repository);
      return entry.contributions.nodes.map((node) => {
        const occurredAt = new Date(node.occurredAt);
        const day = githubContributionDate("commit", occurredAt);
        return item("commit", {
          nodeId: null,
          repo,
          title: null,
          // The user's commits in that repository on that day.
          url: `https://github.com/${repo.owner}/${repo.name}/commits?author=${login}&since=${day}&until=${day}`,
          occurredAt,
          count: node.commitCount,
        });
      });
    });
    return { contributions, restrictedCount: collection?.restrictedContributionsCount ?? 0 };
  };

  return {
    async fetchContributions(login, from, to) {
      const contributions: FetchedContribution[] = [];
      let restrictedCount = 0;
      for (const [start, end] of quarters(from, to)) {
        const result = await commitsIn(login, start, end);
        contributions.push(...result.contributions);
        restrictedCount += result.restrictedCount;
      }
      for (const kind of Object.keys(CONNECTIONS) as (keyof typeof CONNECTIONS)[]) {
        const query = connectionQuery(CONNECTIONS[kind]);
        const nodes = await paginate<RawConnectionNode>(async (after) => {
          const result: {
            user: { contributionsCollection: Record<string, Page<RawConnectionNode>> } | null;
          } = await octokit.graphql(query, {
            login,
            from: from.toISOString(),
            to: to.toISOString(),
            after,
          });
          const collection = result.user?.contributionsCollection;
          return collection ? (Object.values(collection)[0] ?? null) : null;
        });
        for (const node of nodes) {
          const contribution = fromConnectionNode(kind, node);
          if (contribution) contributions.push(contribution);
        }
      }
      return { contributions, restrictedCount };
    },

    async fetchDiscussions(login, from, to) {
      const inRange = (createdAt: string) => {
        const time = new Date(createdAt);
        return time >= from && time < to;
      };
      type Discussion = {
        id: string;
        title: string;
        url: string;
        createdAt: string;
        repository: RawRepo;
      };
      // Newest first: stop once a page reaches discussions older than the window.
      const opened = await paginate<Discussion>(
        async (after) => {
          const result: { user: { repositoryDiscussions: Page<Discussion> } | null } =
            await octokit.graphql(DISCUSSIONS_QUERY, { login, after });
          return result.user?.repositoryDiscussions ?? null;
        },
        (nodes) => nodes.every((node) => new Date(node.createdAt) >= from),
      );
      type Answer = {
        id: string;
        url: string;
        createdAt: string;
        discussion: { title: string; repository: RawRepo };
      };
      // Answers can't be ordered or filtered by date: all of them are read.
      const answers = await paginate<Answer>(async (after) => {
        const result: { user: { repositoryDiscussionComments: Page<Answer> } | null } =
          await octokit.graphql(ANSWERS_QUERY, { login, after });
        return result.user?.repositoryDiscussionComments ?? null;
      });
      return [
        ...opened
          .filter((node) => inRange(node.createdAt))
          .map((node) =>
            item("discussion", {
              nodeId: node.id,
              repo: toRepo(node.repository),
              title: node.title,
              url: node.url,
              occurredAt: new Date(node.createdAt),
            }),
          ),
        ...answers
          .filter((node) => inRange(node.createdAt))
          .map((node) =>
            item("discussion", {
              nodeId: node.id,
              repo: toRepo(node.discussion.repository),
              title: node.discussion.title,
              url: node.url,
              occurredAt: new Date(node.createdAt),
            }),
          ),
      ];
    },

    async getRepositoryById(githubId) {
      try {
        const { data } = await octokit.request("GET /repositories/{id}", { id: githubId });
        return {
          githubId: data.id,
          owner: data.owner.login,
          name: data.name,
          ownerGithubId: data.owner.id,
          isPrivate: data.private,
          isFork: data.fork,
          licenseSpdxId: data.license?.spdx_id ?? null,
        };
      } catch (error) {
        if (error instanceof RequestError && (error.status === 404 || error.status === 451)) {
          return null;
        }
        throw error;
      }
    },
  };
}
