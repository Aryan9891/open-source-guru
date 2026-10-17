// Paginated lists for the admin dashboard: users, repositories and followed labels.
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  or,
  type SQL,
  sql,
} from "@osg/core/db/query";
import {
  contributions,
  repositories,
  subscriptions,
  type UserRole,
  users,
} from "@osg/core/db/schema";
import { z } from "zod";
import type { ApiContext } from "../context.ts";

export const PAGE_SIZE = 25;

export const listQuery = z.object({
  q: z.string().trim().max(100).optional().describe("Case-insensitive search"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

type ListQuery = z.infer<typeof listQuery>;

const page = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  });

/** `%q%` for ILIKE, with the wildcards in `q` matched literally. */
const contains = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

const offset = (query: ListQuery) => (query.page - 1) * PAGE_SIZE;

// Users

export const userRole = z.enum(["user", "admin"]);

export const adminUserResponse = z.object({
  id: z.string(),
  login: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  role: userRole,
  profilePublic: z.boolean(),
  subscriptions: z.number().int(),
  createdAt: z.date(),
});

export const adminUsersQuery = listQuery.extend({ role: userRole.optional() });
export const adminUsersResponse = page(adminUserResponse);

// Joined (not correlated subqueries): Drizzle leaves out table names in single-table selects.
const userColumns = {
  id: users.id,
  login: users.login,
  name: users.name,
  email: users.email,
  image: users.image,
  role: sql<UserRole>`coalesce(${users.role}, 'user')`,
  profilePublic: users.profilePublic,
  subscriptions: count(subscriptions.id),
  createdAt: users.createdAt,
};

const selectUsers = (ctx: ApiContext) =>
  ctx.db
    .select(userColumns)
    .from(users)
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .groupBy(users.id);

/** One user as listed in the admin dashboard, or undefined. */
export async function findAdminUser(ctx: ApiContext, id: string) {
  const [user] = await selectUsers(ctx).where(eq(users.id, id));
  return user;
}

export async function listUsers(ctx: ApiContext, query: z.infer<typeof adminUsersQuery>) {
  const filters: (SQL | undefined)[] = [];
  if (query.q) {
    const pattern = contains(query.q);
    filters.push(
      or(ilike(users.login, pattern), ilike(users.name, pattern), ilike(users.email, pattern)),
    );
  }
  if (query.role) {
    filters.push(query.role === "admin" ? eq(users.role, "admin") : isNull(users.role));
  }
  const where = and(...filters);

  const [items, [total]] = await Promise.all([
    selectUsers(ctx)
      .where(where)
      .orderBy(desc(users.createdAt), users.login)
      .limit(PAGE_SIZE)
      .offset(offset(query)),
    ctx.db.select({ value: count() }).from(users).where(where),
  ]);
  return { items, total: total?.value ?? 0, page: query.page, pageSize: PAGE_SIZE };
}

// Repositories

/**
 * Where a repository comes from. Followed repositories are polled for issues; the others were
 * only stored by the contribution sync, to classify (license, fork, owner) contributions to them.
 */
export const repositorySource = z.enum(["followed", "contributions"]);

export const adminRepositoryResponse = z.object({
  id: z.string(),
  fullName: z.string(),
  url: z.string(),
  status: z.enum(["active", "not_found", "moved"]),
  isOpenSource: z.boolean().nullable().describe("Null until classified"),
  license: z.string().nullable(),
  followers: z.number().int().describe("Users with a subscription to it"),
  contributors: z.number().int().describe("Users with contributions to it"),
  lastPolledAt: z.date().nullable(),
  lastPollError: z.string().nullable(),
  createdAt: z.date(),
});

export const adminRepositoriesQuery = listQuery.extend({
  source: repositorySource
    .optional()
    .describe("`followed`: has subscriptions (polled); `contributions`: only from contributions"),
});
export const adminRepositoriesResponse = page(adminRepositoryResponse);

export async function listRepositories(
  ctx: ApiContext,
  query: z.infer<typeof adminRepositoriesQuery>,
) {
  // Counted per repository first, then joined: joining both tables directly multiplies rows.
  // Aliases are unique: Drizzle refers to them without the subquery name.
  const followers = ctx.db
    .select({
      repoId: subscriptions.repoId,
      count: countDistinct(subscriptions.userId).as("follower_count"),
    })
    .from(subscriptions)
    .groupBy(subscriptions.repoId)
    .as("repo_followers");
  const contributors = ctx.db
    .select({
      repoId: contributions.repoId,
      count: countDistinct(contributions.userId).as("contributor_count"),
    })
    .from(contributions)
    .where(isNotNull(contributions.repoId))
    .groupBy(contributions.repoId)
    .as("repo_contributors");

  const filters: (SQL | undefined)[] = [];
  if (query.q) {
    filters.push(
      sql`${repositories.owner} || '/' || ${repositories.name} ilike ${contains(query.q)}`,
    );
  }
  if (query.source === "followed") filters.push(isNotNull(followers.repoId));
  if (query.source === "contributions") {
    filters.push(isNull(followers.repoId), isNotNull(contributors.repoId));
  }
  const where = and(...filters);
  const followerCount = sql<number>`coalesce(${followers.count}, 0)`.mapWith(Number);
  const contributorCount = sql<number>`coalesce(${contributors.count}, 0)`.mapWith(Number);

  const [rows, [total]] = await Promise.all([
    ctx.db
      .select({
        id: repositories.id,
        owner: repositories.owner,
        name: repositories.name,
        status: repositories.status,
        isOpenSource: repositories.isOpenSource,
        license: repositories.licenseSpdxId,
        followers: followerCount,
        contributors: contributorCount,
        lastPolledAt: repositories.lastPolledAt,
        lastPollError: repositories.lastPollError,
        createdAt: repositories.createdAt,
      })
      .from(repositories)
      .leftJoin(followers, eq(followers.repoId, repositories.id))
      .leftJoin(contributors, eq(contributors.repoId, repositories.id))
      .where(where)
      .orderBy(desc(followerCount), desc(contributorCount), repositories.owner, repositories.name)
      .limit(PAGE_SIZE)
      .offset(offset(query)),
    ctx.db
      .select({ value: count() })
      .from(repositories)
      .leftJoin(followers, eq(followers.repoId, repositories.id))
      .leftJoin(contributors, eq(contributors.repoId, repositories.id))
      .where(where),
  ]);
  const items = rows.map(({ owner, name, ...repo }) => ({
    ...repo,
    fullName: `${owner}/${name}`,
    url: `https://github.com/${owner}/${name}`,
  }));
  return { items, total: total?.value ?? 0, page: query.page, pageSize: PAGE_SIZE };
}

// Labels

export const labelResponse = z.object({
  name: z.string().describe("Lowercased: subscriptions match labels case-insensitively"),
  subscriptions: z.number().int(),
  users: z.number().int(),
  repositories: z.number().int(),
});

export const adminLabelsResponse = page(labelResponse);

/** Labels named in subscriptions, most followed first. */
export async function followedLabels(
  ctx: ApiContext,
  query: { q?: string; page?: number; limit?: number },
) {
  const limit = query.limit ?? PAGE_SIZE;
  const pageNumber = query.page ?? 1;
  const filter = query.q ? sql`where lower(label) ilike ${contains(query.q)}` : sql``;
  const labels = sql`
    select lower(label) as name, ${subscriptions.id} as subscription_id,
      ${subscriptions.userId} as user_id, ${subscriptions.repoId} as repo_id
    from ${subscriptions} cross join lateral unnest(${subscriptions.labels}) as label
    ${filter}
  `;

  const [rows, totals] = await Promise.all([
    ctx.db.execute<{ name: string; subscriptions: number; users: number; repositories: number }>(
      sql`
        select name,
          count(distinct subscription_id)::int as subscriptions,
          count(distinct user_id)::int as users,
          count(distinct repo_id)::int as repositories
        from (${labels}) as followed
        group by name
        order by subscriptions desc, name
        limit ${limit} offset ${(pageNumber - 1) * limit}
      `,
    ),
    ctx.db.execute<{ total: number }>(
      sql`select count(distinct name)::int as total from (${labels}) as followed`,
    ),
  ]);
  return {
    items: rows.rows,
    total: totals.rows[0]?.total ?? 0,
    page: pageNumber,
    pageSize: limit,
  };
}
