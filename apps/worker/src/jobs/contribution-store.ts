// Storage shared by the contribution jobs: repositories we classify, and daily totals.
import { repoExclusion } from "@osg/core/contributions/classify";
import type { DatabaseOrTransaction } from "@osg/core/db";
import { and, eq, gte, inArray, lt, sql, sum } from "@osg/core/db/query";
import { contributionDays, contributions, repositories } from "@osg/core/db/schema";
import type { GitHubRepoFacts } from "@osg/core/github/contributions";

/** First day of `year` and of the next one, as `date` column values. */
export const yearRange = (year: number) => ({ start: `${year}-01-01`, end: `${year + 1}-01-01` });

/** The classification columns of `repositories` for these facts. */
export const classificationOf = (repo: GitHubRepoFacts, now: Date) => ({
  owner: repo.owner,
  name: repo.name,
  ownerGithubId: repo.ownerGithubId,
  isPrivate: repo.isPrivate,
  isFork: repo.isFork,
  licenseSpdxId: repo.licenseSpdxId,
  isOpenSource: repoExclusion(repo) === null,
  classifiedAt: now,
});

/**
 * Stores public repositories by GitHub ID (rename-proof) with their classification, and returns
 * their IDs. Nothing is stored about private repositories.
 */
export async function upsertRepositories(
  tx: DatabaseOrTransaction,
  repos: GitHubRepoFacts[],
  now: Date,
): Promise<Map<number, string>> {
  const unique = [
    ...new Map(repos.filter((repo) => !repo.isPrivate).map((r) => [r.githubId, r])).values(),
  ];
  if (unique.length === 0) return new Map();

  // A name is unique: free it when another repository held it (renamed away, or deleted and
  // recreated). That row keeps its GitHub ID; its next classification restores its real name.
  const fullName = sql<string>`lower(${repositories.owner}) || '/' || lower(${repositories.name})`;
  const names = unique.map((repo) => `${repo.owner}/${repo.name}`.toLowerCase());
  const held = await tx
    .select({ id: repositories.id, githubId: repositories.githubId, fullName })
    .from(repositories)
    .where(inArray(fullName, names));
  const owners = new Map(unique.map((repo) => [`${repo.owner}/${repo.name}`.toLowerCase(), repo]));
  for (const row of held) {
    if (owners.get(row.fullName)?.githubId === row.githubId) continue;
    await tx
      .update(repositories)
      .set({ status: "moved", name: sql`${repositories.name} || '~' || ${repositories.githubId}` })
      .where(eq(repositories.id, row.id));
  }

  const rows = await tx
    .insert(repositories)
    .values(unique.map((repo) => ({ githubId: repo.githubId, ...classificationOf(repo, now) })))
    .onConflictDoUpdate({
      target: repositories.githubId,
      set: {
        owner: sql`excluded.owner`,
        name: sql`excluded.name`,
        ownerGithubId: sql`excluded.owner_github_id`,
        isPrivate: sql`excluded.is_private`,
        isFork: sql`excluded.is_fork`,
        licenseSpdxId: sql`excluded.license_spdx_id`,
        isOpenSource: sql`excluded.is_open_source`,
        classifiedAt: sql`excluded.classified_at`,
      },
    })
    .returning({ id: repositories.id, githubId: repositories.githubId });
  return new Map(rows.map((row) => [row.githubId, row.id]));
}

/** Rebuilds a user's daily totals of counted contributions for one year. */
export async function rebuildContributionDays(
  tx: DatabaseOrTransaction,
  userId: string,
  year: number,
  now: Date,
): Promise<void> {
  const { start, end } = yearRange(year);
  const inYear = (column: typeof contributionDays.date | typeof contributions.date) =>
    and(gte(column, start), lt(column, end));

  await tx
    .delete(contributionDays)
    .where(and(eq(contributionDays.userId, userId), inYear(contributionDays.date)));
  const totals = await tx
    .select({ date: contributions.date, count: sum(contributions.count).mapWith(Number) })
    .from(contributions)
    .where(
      and(
        eq(contributions.userId, userId),
        eq(contributions.counted, true),
        inYear(contributions.date),
      ),
    )
    .groupBy(contributions.date);
  if (totals.length === 0) return;
  await tx
    .insert(contributionDays)
    .values(totals.map((day) => ({ userId, date: day.date, count: day.count, syncedAt: now })));
}
