import { createAppAuth } from "@octokit/auth-app";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { RequestError } from "@octokit/request-error";
import { Octokit } from "@octokit/rest";
import type { RepoLabel } from "../db/schema/github.ts";
import type { GitHubIssue } from "../polling/detect-events.ts";

export interface GitHubRepository {
  githubId: number;
  owner: string;
  name: string;
  private: boolean;
  hasIssues: boolean;
}

export type IssuesPage =
  | { notModified: true }
  | { notModified: false; etag: string | null; issues: GitHubIssue[]; hasNextPage: boolean };

export interface ListIssuesParams {
  owner: string;
  name: string;
  state: "open" | "all";
  since?: Date | null;
  page: number;
  /** Sent as `If-None-Match`; a `304 Not Modified` doesn't count against the rate limit. */
  etag?: string | null;
}

/** The GitHub calls open-source-guru makes. Implemented with Octokit; faked in tests. */
export interface GitHubApi {
  /** Null when the repository doesn't exist or isn't visible. Follows renames. */
  getRepository(owner: string, name: string): Promise<GitHubRepository | null>;
  /** Every label of a repository, with its number of open issues. */
  listRepoLabels(owner: string, name: string): Promise<RepoLabel[]>;
  /** One page (100 items) of issues, most recently updated first. Pull requests are left out. */
  listIssuesPage(params: ListIssuesParams): Promise<IssuesPage>;
}

export class RepositoryNotFoundError extends Error {
  override name = "RepositoryNotFoundError";
}

const PER_PAGE = 100;

interface RawIssue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  labels: (string | { node_id?: string; name?: string; color?: string | null })[];
  assignees?: { login: string }[] | null;
  user: { login: string } | null;
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
}

/** Normalizes an issue from the REST API. Returns null for pull requests. */
export function toGitHubIssue(raw: RawIssue): GitHubIssue | null {
  if (raw.pull_request) return null;
  return {
    githubId: raw.id,
    number: raw.number,
    title: raw.title,
    htmlUrl: raw.html_url,
    state: raw.state === "closed" ? "closed" : "open",
    labels: raw.labels.flatMap((label) =>
      typeof label === "object" && label.node_id && label.name
        ? [{ nodeId: label.node_id, name: label.name, color: label.color ?? "ededed" }]
        : [],
    ),
    assignees: (raw.assignees ?? []).map((assignee) => assignee.login),
    authorLogin: raw.user?.login ?? null,
    createdAt: new Date(raw.created_at),
    updatedAt: new Date(raw.updated_at),
  };
}

const LABELS_QUERY = /* GraphQL */ `
  query RepoLabels($owner: String!, $name: String!, $after: String) {
    repository(owner: $owner, name: $name) {
      labels(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { id name color description issues(states: OPEN) { totalCount } }
      }
    }
  }
`;

interface LabelsQueryResult {
  repository: {
    labels: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: {
        id: string;
        name: string;
        color: string;
        description: string | null;
        issues: { totalCount: number };
      }[];
    };
  } | null;
}

export function createGitHubApi(octokit: Octokit): GitHubApi {
  return {
    async getRepository(owner, name) {
      try {
        const { data } = await octokit.rest.repos.get({ owner, repo: name });
        return {
          githubId: data.id,
          owner: data.owner.login,
          name: data.name,
          private: data.private,
          hasIssues: data.has_issues,
        };
      } catch (error) {
        if (error instanceof RequestError && error.status === 404) return null;
        throw error;
      }
    },

    async listRepoLabels(owner, name) {
      const labels: RepoLabel[] = [];
      let after: string | null = null;
      do {
        const result: LabelsQueryResult = await octokit.graphql(LABELS_QUERY, {
          owner,
          name,
          after,
        });
        if (!result.repository) throw new RepositoryNotFoundError(`${owner}/${name}`);
        const page = result.repository.labels;
        for (const node of page.nodes) {
          labels.push({
            nodeId: node.id,
            name: node.name,
            color: node.color,
            description: node.description,
            openIssues: node.issues.totalCount,
          });
        }
        after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
      } while (after);
      return labels;
    },

    async listIssuesPage({ owner, name, state, since, page, etag }) {
      try {
        const response = await octokit.rest.issues.listForRepo({
          owner,
          repo: name,
          state,
          sort: "updated",
          direction: "desc",
          per_page: PER_PAGE,
          page,
          ...(since && { since: since.toISOString() }),
          headers: etag ? { "if-none-match": etag } : {},
        });
        return {
          notModified: false,
          etag: response.headers.etag ?? null,
          issues: response.data.flatMap((raw) => toGitHubIssue(raw as RawIssue) ?? []),
          hasNextPage: /rel="next"/.test(response.headers.link ?? ""),
        };
      } catch (error) {
        if (error instanceof RequestError && error.status === 304) return { notModified: true };
        if (error instanceof RequestError && (error.status === 404 || error.status === 410)) {
          throw new RepositoryNotFoundError(`${owner}/${name}`);
        }
        throw error;
      }
    },
  };
}

const ThrottledOctokit = Octokit.plugin(throttling, retry);

export interface GitHubAppCredentials {
  appId: string;
  privateKey: string;
  installationId: number;
}

/**
 * An Octokit client authenticated as our GitHub App installation (PLAN.md §2). Installation
 * tokens are created and refreshed automatically. Rate limits are respected: requests wait
 * and retry once when GitHub asks to slow down.
 */
export function createInstallationOctokit(
  credentials: GitHubAppCredentials,
  options: { baseUrl?: string; log?: Pick<Console, "warn"> } = {},
): Octokit {
  return new ThrottledOctokit({
    authStrategy: createAppAuth,
    auth: {
      appId: credentials.appId,
      privateKey: credentials.privateKey,
      installationId: credentials.installationId,
    },
    baseUrl: options.baseUrl,
    userAgent: "open-source-guru",
    throttle: {
      onRateLimit: (retryAfter, requestOptions, _octokit, retryCount) => {
        options.log?.warn(
          `GitHub rate limit hit for ${requestOptions.url}; retrying in ${retryAfter}s`,
        );
        return retryCount < 1;
      },
      onSecondaryRateLimit: (retryAfter, requestOptions, _octokit, retryCount) => {
        options.log?.warn(
          `GitHub secondary rate limit hit for ${requestOptions.url}; retrying in ${retryAfter}s`,
        );
        return retryCount < 1;
      },
    },
  });
}
