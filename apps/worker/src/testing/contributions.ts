// A scripted GitHub for the contribution jobs: tests set the contributions and repositories.
import { githubContributionDate } from "@osg/core/contributions/dates";
import type { ContributionKind } from "@osg/core/db/schema";
import type {
  FetchedContribution,
  GitHubContributionsApi,
  GitHubRepoFacts,
} from "@osg/core/github/contributions";

/** The test user's GitHub ID (see `createWorkerTest`). */
export const USER_GITHUB_ID = 1;

export const ghRepo = (githubId: number, overrides: Partial<GitHubRepoFacts> = {}) => ({
  githubId,
  owner: "acme",
  name: `lib-${githubId}`,
  ownerGithubId: 500,
  isPrivate: false,
  isFork: false,
  licenseSpdxId: "MIT",
  ...overrides,
});

export const contribution = (
  kind: ContributionKind,
  repo: GitHubRepoFacts,
  occurredAt: string,
  overrides: Partial<FetchedContribution> = {},
): FetchedContribution => {
  const at = new Date(occurredAt);
  return {
    kind,
    nodeId: kind === "commit" ? null : `${kind}-${repo.githubId}-${occurredAt}`,
    repo,
    title: kind === "commit" ? null : `A ${kind}`,
    url: `https://github.com/${repo.owner}/${repo.name}`,
    occurredAt: at,
    date: githubContributionDate(kind === "commit" ? "commit" : "other", at),
    count: 1,
    prState: kind === "pull_request" ? "open" : null,
    prMergedAt: null,
    ...overrides,
  };
};

export function fakeContributions() {
  const state = {
    contributions: [] as FetchedContribution[],
    discussions: [] as FetchedContribution[],
    restrictedCount: 0,
    /** Current repository facts, for reclassification; missing = gone. */
    repos: new Map<number, GitHubRepoFacts>(),
    failure: null as Error | null,
    windows: [] as { from: Date; to: Date }[],
  };
  const inWindow = (from: Date, to: Date) => (item: FetchedContribution) =>
    item.occurredAt >= from && item.occurredAt < to;
  const api: GitHubContributionsApi = {
    async fetchContributions(_login, from, to) {
      state.windows.push({ from, to });
      if (state.failure) throw state.failure;
      return {
        contributions: state.contributions.filter(inWindow(from, to)),
        restrictedCount: state.restrictedCount,
      };
    },
    fetchDiscussions: async (_login, from, to) => state.discussions.filter(inWindow(from, to)),
    getRepositoryById: async (githubId) => state.repos.get(githubId) ?? null,
  };
  return { api, state };
}
