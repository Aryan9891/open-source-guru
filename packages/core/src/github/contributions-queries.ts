// GraphQL queries for contributions, and the raw shapes they return.
import type { GitHubRepoFacts } from "./contributions.ts";

export const REPO = /* GraphQL */ `
  fragment Repo on Repository {
    databaseId
    name
    owner { login ... on User { databaseId } ... on Organization { databaseId } }
    isPrivate
    isFork
    licenseInfo { spdxId }
  }
`;

export interface RawRepo {
  databaseId: number;
  name: string;
  owner: { login: string; databaseId?: number };
  isPrivate: boolean;
  isFork: boolean;
  licenseInfo: { spdxId: string | null } | null;
}

export interface Page<T> {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: T[];
}

export const toRepo = (raw: RawRepo): GitHubRepoFacts => ({
  githubId: raw.databaseId,
  owner: raw.owner.login,
  name: raw.name,
  ownerGithubId: raw.owner.databaseId ?? 0,
  isPrivate: raw.isPrivate,
  isFork: raw.isFork,
  licenseSpdxId: raw.licenseInfo?.spdxId ?? null,
});

export const COMMITS_QUERY = /* GraphQL */ `
  query Commits($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        restrictedContributionsCount
        commitContributionsByRepository(maxRepositories: 100) {
          repository { ...Repo }
          contributions(first: 100) { nodes { occurredAt commitCount } }
        }
      }
    }
  }
  ${REPO}
`;

/** One query per contribution type, paginated with `after`. */
export const CONNECTIONS = {
  issue: /* GraphQL */ `
    issueContributions(first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { occurredAt issue { id title url repository { ...Repo } } }
    }`,
  pull_request: /* GraphQL */ `
    pullRequestContributions(first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        occurredAt
        pullRequest { id title url state mergedAt repository { ...Repo } }
      }
    }`,
  review: /* GraphQL */ `
    pullRequestReviewContributions(first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        occurredAt
        pullRequestReview { id url }
        pullRequest { title }
        repository { ...Repo }
      }
    }`,
} as const;

export const connectionQuery = (field: string) => /* GraphQL */ `
  query Contributions($login: String!, $from: DateTime!, $to: DateTime!, $after: String) {
    user(login: $login) { contributionsCollection(from: $from, to: $to) { ${field} } }
  }
  ${REPO}
`;

export interface RawConnectionNode {
  occurredAt: string;
  issue?: { id: string; title: string; url: string; repository: RawRepo };
  /** The full pull request for PR contributions; only its title for reviews. */
  pullRequest?: {
    title: string;
    id?: string;
    url?: string;
    state?: "OPEN" | "CLOSED" | "MERGED";
    mergedAt?: string | null;
    repository?: RawRepo;
  };
  pullRequestReview?: { id: string; url: string };
  repository?: RawRepo;
}

export const DISCUSSIONS_QUERY = /* GraphQL */ `
  query Discussions($login: String!, $after: String) {
    user(login: $login) {
      repositoryDiscussions(first: 100, after: $after, orderBy: { field: CREATED_AT, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
        nodes { id title url createdAt repository { ...Repo } }
      }
    }
  }
  ${REPO}
`;

export const ANSWERS_QUERY = /* GraphQL */ `
  query Answers($login: String!, $after: String) {
    user(login: $login) {
      repositoryDiscussionComments(first: 100, after: $after, onlyAnswers: true) {
        pageInfo { hasNextPage endCursor }
        nodes { id url createdAt discussion { title repository { ...Repo } } }
      }
    }
  }
  ${REPO}
`;
