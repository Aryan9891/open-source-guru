import { and, desc, eq, isNotNull, sql, sum } from "@osg/core/db/query";
import { contributionSyncs, contributions, repositories } from "@osg/core/db/schema";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ApiContext } from "../context.ts";
import { ApiError } from "../errors.ts";
import { currentUser, requireUser } from "../plugins/authenticate.ts";
import {
  contributionKind,
  contributionsIn,
  periodFor,
  periodQuery,
  periodResponse,
  repoResponse,
  toRepo,
} from "../services/contributions.ts";
import { parseRepoReference } from "../services/repositories.ts";

/** A sync can be requested again once the last one is this old. */
export const SYNC_COOLDOWN_MS = 15 * 60 * 1000;

/** Repositories listed by `/v1/me/contributions/excluded`. */
const EXCLUDED_REPOS = 20;

const excludedReason = z.enum([
  "private",
  "fork",
  "own_repo",
  "no_license",
  "not_osi_approved",
  "unknown_license",
]);

/** Opaque page cursor: the last item's time and ID (commits can share a time). */
const encodeCursor = (item: { occurredAt: Date; id: string }) =>
  Buffer.from(`${item.occurredAt.toISOString()}|${item.id}`).toString("base64url");

function decodeCursor(cursor: string) {
  const [time = "", id = ""] = Buffer.from(cursor, "base64url").toString().split("|");
  const occurredAt = new Date(time);
  if (Number.isNaN(occurredAt.getTime()) || !/^[0-9a-f-]{36}$/.test(id)) {
    throw new ApiError(400, "invalid_cursor", "This cursor is invalid.");
  }
  return { occurredAt, id };
}

export const contributionRoutes =
  (ctx: ApiContext): FastifyPluginAsyncZod =>
  async (app) => {
    const tags = ["Contributions"];
    app.addHook("preHandler", requireUser(ctx));

    app.get(
      "/v1/me/contributions",
      {
        schema: {
          tags,
          summary: "Your Open Source Contributions, newest first",
          description:
            "Commits are reported per repository and day, with their number in `count`. Page with `cursor` (the previous response's `nextCursor`).",
          querystring: periodQuery.extend({
            kind: contributionKind.optional(),
            repo: z.string().optional().describe("`owner/name`"),
            limit: z.coerce.number().int().min(1).max(100).default(50),
            cursor: z.string().optional(),
          }),
          response: {
            200: z.object({
              period: periodResponse,
              items: z.array(
                z.object({
                  id: z.string(),
                  kind: contributionKind,
                  date: z.string(),
                  occurredAt: z.date(),
                  count: z.number().int(),
                  title: z.string().nullable(),
                  url: z.string().nullable(),
                  repo: repoResponse,
                  pullRequest: z
                    .object({
                      state: z.enum(["open", "closed", "merged"]),
                      mergedAt: z.date().nullable(),
                    })
                    .nullable(),
                }),
              ),
              nextCursor: z.string().nullable(),
            }),
          },
        },
      },
      async (request) => {
        const { year, kind, repo, limit, cursor } = request.query;
        const period = periodFor(ctx, year);
        const reference = repo === undefined ? undefined : parseRepoReference(repo);
        if (reference === null) {
          throw new ApiError(400, "invalid_repo", "Use `owner/name` for `repo`.");
        }
        const after = cursor === undefined ? undefined : decodeCursor(cursor);

        const rows = await ctx.db
          .select({ contribution: contributions, repo: repositories })
          .from(contributions)
          .innerJoin(repositories, eq(repositories.id, contributions.repoId))
          .where(
            and(
              contributionsIn(currentUser(request).id, period),
              eq(contributions.counted, true),
              kind ? eq(contributions.kind, kind) : undefined,
              reference
                ? and(
                    sql`lower(${repositories.owner}) = ${reference.owner.toLowerCase()}`,
                    sql`lower(${repositories.name}) = ${reference.name.toLowerCase()}`,
                  )
                : undefined,
              after
                ? sql`(${contributions.occurredAt}, ${contributions.id}) < (${after.occurredAt}, ${after.id})`
                : undefined,
            ),
          )
          .orderBy(desc(contributions.occurredAt), desc(contributions.id))
          .limit(limit + 1);

        const items = rows.slice(0, limit).map(({ contribution: item, repo: itemRepo }) => ({
          id: item.id,
          kind: item.kind,
          date: item.date,
          occurredAt: item.occurredAt,
          count: item.count,
          title: item.title,
          url: item.url,
          repo: toRepo(itemRepo),
          pullRequest: item.prState ? { state: item.prState, mergedAt: item.prMergedAt } : null,
        }));
        const last = rows[limit - 1]?.contribution;
        return {
          period,
          items,
          nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
        };
      },
    );

    app.get(
      "/v1/me/contributions/excluded",
      {
        schema: {
          tags,
          summary: "What wasn't counted, and why",
          description:
            "Contributions GitHub counts but that aren't Open Source Contributions: in your own repositories, in forks, or in repositories without an OSI-approved license. Private contributions are only known as a number per calendar year (`private`, null for the last 12 months). Never shown publicly.",
          querystring: periodQuery,
          response: {
            200: z.object({
              period: periodResponse,
              reasons: z.array(z.object({ reason: excludedReason, count: z.number().int() })),
              repos: z.array(
                repoResponse.extend({ reason: excludedReason, count: z.number().int() }),
              ),
              private: z.number().int().nullable(),
            }),
          },
        },
      },
      async (request) => {
        const userId = currentUser(request).id;
        const period = periodFor(ctx, request.query.year);
        const excluded = and(
          contributionsIn(userId, period),
          eq(contributions.counted, false),
          isNotNull(contributions.excludedReason),
        );
        const total = sum(contributions.count).mapWith(Number);

        const [reasons, repos, sync] = await Promise.all([
          ctx.db
            .select({ reason: contributions.excludedReason, count: total })
            .from(contributions)
            .where(excluded)
            .groupBy(contributions.excludedReason)
            .orderBy(desc(total)),
          ctx.db
            .select({
              reason: contributions.excludedReason,
              owner: repositories.owner,
              name: repositories.name,
              licenseSpdxId: repositories.licenseSpdxId,
              count: total,
            })
            .from(contributions)
            .innerJoin(repositories, eq(repositories.id, contributions.repoId))
            .where(excluded)
            .groupBy(contributions.excludedReason, repositories.id)
            .orderBy(desc(total))
            .limit(EXCLUDED_REPOS),
          period.year === null
            ? undefined
            : ctx.db.query.contributionSyncs.findFirst({
                where: and(
                  eq(contributionSyncs.userId, userId),
                  eq(contributionSyncs.year, period.year),
                ),
              }),
        ]);

        return {
          period,
          reasons: reasons.flatMap((row) =>
            row.reason ? [{ reason: row.reason, count: row.count }] : [],
          ),
          repos: repos.flatMap((row) =>
            row.reason ? [{ ...toRepo(row), reason: row.reason, count: row.count }] : [],
          ),
          private: period.year === null ? null : (sync?.restrictedCount ?? 0),
        };
      },
    );

    app.post(
      "/v1/me/sync",
      {
        schema: {
          tags,
          summary: "Refresh your contributions from GitHub",
          description:
            "Asks for this year's contributions to be fetched again, within a minute or so. Ignored when the last refresh is less than 15 minutes old or one is already on its way.",
          response: {
            202: z.object({
              requested: z
                .boolean()
                .describe("False when a recent or pending sync makes it unnecessary"),
              lastSyncedAt: z.date().nullable(),
            }),
          },
        },
      },
      async (request, reply) => {
        const userId = currentUser(request).id;
        const now = ctx.now();
        const year = now.getUTCFullYear();
        const sync = await ctx.db.query.contributionSyncs.findFirst({
          where: and(eq(contributionSyncs.userId, userId), eq(contributionSyncs.year, year)),
        });
        const lastSyncedAt = sync?.lastSyncedAt ?? null;
        const recent =
          lastSyncedAt !== null && now.getTime() - lastSyncedAt.getTime() < SYNC_COOLDOWN_MS;
        const onItsWay = sync?.status === "pending" || sync?.status === "running";
        if (recent || onItsWay) return reply.code(202).send({ requested: false, lastSyncedAt });

        // The worker's scheduler picks pending syncs up every minute.
        await ctx.db
          .insert(contributionSyncs)
          .values({ userId, year, status: "pending" })
          .onConflictDoUpdate({
            target: [contributionSyncs.userId, contributionSyncs.year],
            set: { status: "pending" },
          });
        return reply.code(202).send({ requested: true, lastSyncedAt });
      },
    );
  };
