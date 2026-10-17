import type { ExcludedReason } from "../db/schema/contributions.ts";

/** What we know about a repository from GitHub. */
export interface RepoFacts {
  isPrivate: boolean;
  isFork: boolean;
  ownerGithubId: number;
  /** GitHub's SPDX identifier for the detected license; null without one. */
  licenseSpdxId: string | null;
}

/**
 * Why a repository's contributions can't count for anyone: private, or a fork.
 * Null for an open-source repository. Cached as `repositories.is_open_source`.
 */
export function repoExclusion(repo: RepoFacts): ExcludedReason | null {
  if (repo.isPrivate) return "private";
  if (repo.isFork) return "fork";
  return null;
}

export type Classification =
  | { counted: true; excludedReason: null }
  | { counted: false; excludedReason: ExcludedReason };

/**
 * Whether a contribution is an Open Source Contribution: made in a public,
 * non-fork, OSI-licensed repository that isn't owned by the user's own account.
 *
 * Ownership is checked before the license, so the user's own projects are reported as such
 * ("in your own repositories") rather than by their license. Organization repositories count,
 * even when the user is a member or admin.
 */
export function classifyContribution(repo: RepoFacts, userGithubId: number): Classification {
  const reason =
    repo.isPrivate || repo.isFork || repo.ownerGithubId !== userGithubId
      ? repoExclusion(repo)
      : "own_repo";
  return reason
    ? { counted: false, excludedReason: reason }
    : { counted: true, excludedReason: null };
}
