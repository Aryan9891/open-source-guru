import { and, eq, sql } from "@osg/core/db/query";
import { type RepoLabel, repoLabelsCache, repositories } from "@osg/core/db/schema";
import type { ApiContext } from "../context.ts";
import { ApiError } from "../errors.ts";

/** Labels fetched from GitHub are reused for this long. */
export const LABELS_CACHE_TTL_MS = 60 * 60 * 1000;

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;

/** Accepts `owner/name` or a GitHub URL (`https://github.com/owner/name[/...]`). */
export function parseRepoReference(input: string): { owner: string; name: string } | null {
  let path = input.trim();
  const url = path.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/(.+)$/i);
  if (url?.[1]) path = url[1];
  const [owner, rawName] = path.replace(/\/+$/, "").split("/");
  const name = rawName?.replace(/\.git$/, "");
  if (!owner || !name || !NAME.test(owner) || !NAME.test(name)) return null;
  return { owner, name };
}

export type Repository = typeof repositories.$inferSelect;

/**
 * Finds a repository we already know, or looks it up on GitHub and stores it.
 * Only public repositories with issues enabled can be followed.
 */
export async function resolveRepository(
  ctx: ApiContext,
  owner: string,
  name: string,
): Promise<Repository> {
  const known = await ctx.db.query.repositories.findFirst({
    where: and(
      sql`lower(${repositories.owner}) = lower(${owner})`,
      sql`lower(${repositories.name}) = lower(${name})`,
    ),
  });
  if (known && known.status === "active") return known;

  const found = await ctx.github.getRepository(owner, name);
  if (!found || found.private) {
    throw new ApiError(
      404,
      "repository_not_found",
      `Repository ${owner}/${name} not found on GitHub.`,
    );
  }
  if (!found.hasIssues) {
    throw new ApiError(
      422,
      "issues_disabled",
      `Repository ${found.owner}/${found.name} has issues turned off.`,
    );
  }

  // GitHub follows renames: store the current owner and name.
  const [saved] = await ctx.db
    .insert(repositories)
    .values({ githubId: found.githubId, owner: found.owner, name: found.name })
    .onConflictDoUpdate({
      target: repositories.githubId,
      set: { owner: found.owner, name: found.name, status: "active" },
    })
    .returning();
  if (!saved) throw new Error("Upserting the repository returned nothing");
  return saved;
}

/** Labels of a repository with open-issue counts, cached for an hour. */
export async function getRepositoryLabels(ctx: ApiContext, repo: Repository): Promise<RepoLabel[]> {
  const cached = await ctx.db.query.repoLabelsCache.findFirst({
    where: eq(repoLabelsCache.repoId, repo.id),
  });
  const now = ctx.now();
  if (cached && now.getTime() - cached.fetchedAt.getTime() < LABELS_CACHE_TTL_MS) {
    return cached.labels;
  }

  const labels = await ctx.github.listRepoLabels(repo.owner, repo.name);
  await ctx.db
    .insert(repoLabelsCache)
    .values({ repoId: repo.id, labels, fetchedAt: now })
    .onConflictDoUpdate({ target: repoLabelsCache.repoId, set: { labels, fetchedAt: now } });
  return labels;
}
