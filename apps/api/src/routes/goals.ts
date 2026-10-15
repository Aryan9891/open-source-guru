import { dateInTimeZone } from "@osg/core/contributions/dates";
import { refreshGoalProgress } from "@osg/core/contributions/goal-progress";
import { alignStart } from "@osg/core/contributions/goals";
import { and, asc, count, desc, eq, inArray } from "@osg/core/db/query";
import { goalPeriods, goals, repositories } from "@osg/core/db/schema";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ApiContext } from "../context.ts";
import { ApiError, notFound } from "../errors.ts";
import { currentUser, requireUser } from "../plugins/authenticate.ts";
import { parseRepoReference, resolveRepository } from "../services/repositories.ts";

export const MAX_GOALS_PER_USER = 20;

const metric = z.enum([
  "contributions",
  "active_days",
  "commits",
  "issues_opened",
  "prs_opened",
  "prs_merged",
  "reviews",
  "discussions",
]);
const recurrence = z.enum(["none", "weekly", "monthly"]);
const isoDate = z.iso.date();

const periodResponse = z.object({
  start: z.string(),
  end: z.string(),
  progress: z.number().int(),
  achievedAt: z.date().nullable(),
});

const goalResponse = z.object({
  id: z.string(),
  metric,
  target: z.number().int(),
  recurrence,
  startsOn: z.string(),
  endsOn: z.string().nullable(),
  repoScope: z.enum(["all", "subscribed", "repo"]),
  repo: z.object({ fullName: z.string(), url: z.string() }).nullable(),
  isPublic: z.boolean(),
  status: z.enum(["active", "archived"]),
  createdAt: z.date(),
  periods: z.array(periodResponse).describe("Oldest first; the last is the current period"),
});

const idParams = z.object({ id: z.uuid() });

export const goalRoutes =
  (ctx: ApiContext): FastifyPluginAsyncZod =>
  async (app) => {
    const tags = ["Goals"];
    app.addHook("preHandler", requireUser(ctx));

    async function load(userId: string, ids?: string[]) {
      const rows = await ctx.db
        .select({ goal: goals, owner: repositories.owner, name: repositories.name })
        .from(goals)
        .leftJoin(repositories, eq(repositories.id, goals.repoId))
        .where(and(eq(goals.userId, userId), ids ? inArray(goals.id, ids) : undefined))
        .orderBy(asc(goals.status), desc(goals.createdAt));
      const periods =
        rows.length === 0
          ? []
          : await ctx.db
              .select()
              .from(goalPeriods)
              .where(
                inArray(
                  goalPeriods.goalId,
                  rows.map((row) => row.goal.id),
                ),
              )
              .orderBy(asc(goalPeriods.periodStart));
      return rows.map(({ goal, owner, name }) => ({
        id: goal.id,
        metric: goal.metric,
        target: goal.target,
        recurrence: goal.recurrence,
        startsOn: goal.startsOn,
        endsOn: goal.endsOn,
        repoScope: goal.repoScope,
        repo:
          owner && name
            ? { fullName: `${owner}/${name}`, url: `https://github.com/${owner}/${name}` }
            : null,
        isPublic: goal.isPublic,
        status: goal.status,
        createdAt: goal.createdAt,
        periods: periods
          .filter((period) => period.goalId === goal.id)
          .map((period) => ({
            start: period.periodStart,
            end: period.periodEnd,
            progress: period.progress,
            achievedAt: period.achievedAt,
          })),
      }));
    }

    async function loadOne(userId: string, id: string) {
      const [goal] = await load(userId, [id]);
      if (!goal) throw notFound("Goal");
      return goal;
    }

    app.get(
      "/v1/me/goals",
      {
        schema: {
          tags,
          summary: "Your goals, with their progress",
          response: { 200: z.array(goalResponse) },
        },
      },
      async (request) => load(currentUser(request).id),
    );

    app.post(
      "/v1/me/goals",
      {
        schema: {
          tags,
          summary: "Set a goal",
          description:
            "Counts Open Source Contributions only. Weekly goals run Sunday to Saturday, monthly goals by calendar month (UTC, like GitHub's graph); one-off goals need `endsOn`.",
          body: z
            .object({
              metric,
              target: z.number().int().min(1).max(10_000),
              recurrence,
              startsOn: isoDate.optional().describe("Defaults to the current period"),
              endsOn: isoDate.optional().describe("One-off goals only (required for them)"),
              repoScope: z.enum(["all", "subscribed", "repo"]).default("all"),
              repo: z.string().optional().describe("`owner/name`, with `repoScope: repo`"),
              isPublic: z.boolean().default(false),
            })
            .refine((body) => (body.recurrence === "none") === (body.endsOn !== undefined), {
              message: "One-off goals need `endsOn`; recurring goals don't take it.",
              path: ["endsOn"],
            })
            .refine((body) => (body.repoScope === "repo") === (body.repo !== undefined), {
              message: "`repo` goes with `repoScope: repo`.",
              path: ["repo"],
            }),
          response: { 201: goalResponse },
        },
      },
      async (request, reply) => {
        const { id: userId } = currentUser(request);
        const body = request.body;
        const now = ctx.now();
        const startsOn = alignStart(body.recurrence, body.startsOn ?? dateInTimeZone(now, "UTC"));
        if (body.endsOn !== undefined && body.endsOn < startsOn) {
          throw new ApiError(400, "invalid_dates", "`endsOn` can't be before `startsOn`.");
        }

        const [{ value: existing } = { value: 0 }] = await ctx.db
          .select({ value: count() })
          .from(goals)
          .where(eq(goals.userId, userId));
        if (existing >= MAX_GOALS_PER_USER) {
          throw new ApiError(422, "goal_limit", `You can have up to ${MAX_GOALS_PER_USER} goals.`);
        }

        let repoId: string | null = null;
        if (body.repo !== undefined) {
          const reference = parseRepoReference(body.repo);
          if (!reference) {
            throw new ApiError(400, "invalid_repo", "Use `owner/name` or a GitHub repository URL.");
          }
          repoId = (await resolveRepository(ctx, reference.owner, reference.name)).id;
        }

        const [created] = await ctx.db
          .insert(goals)
          .values({
            userId,
            metric: body.metric,
            target: body.target,
            recurrence: body.recurrence,
            startsOn,
            endsOn: body.endsOn ?? null,
            repoScope: body.repoScope,
            repoId,
            isPublic: body.isPublic,
            createdAt: now,
          })
          .returning({ id: goals.id });
        if (!created) throw new Error("Creating the goal returned nothing");
        await refreshGoalProgress(ctx.db, userId, now, [created.id]);
        return reply.code(201).send(await loadOne(userId, created.id));
      },
    );

    app.patch(
      "/v1/me/goals/:id",
      {
        schema: {
          tags,
          summary: "Change a goal's target, visibility or status",
          description: "To change what a goal measures, set a new goal.",
          params: idParams,
          body: z
            .object({
              target: z.number().int().min(1).max(10_000).optional(),
              isPublic: z.boolean().optional(),
              status: z.enum(["active", "archived"]).optional(),
            })
            .strict(),
          response: { 200: goalResponse },
        },
      },
      async (request) => {
        const { id: userId } = currentUser(request);
        const [updated] = await ctx.db
          .update(goals)
          .set(request.body)
          .where(and(eq(goals.id, request.params.id), eq(goals.userId, userId)))
          .returning({ id: goals.id });
        if (!updated) throw notFound("Goal");
        await refreshGoalProgress(ctx.db, userId, ctx.now(), [updated.id]);
        return loadOne(userId, updated.id);
      },
    );

    app.delete(
      "/v1/me/goals/:id",
      {
        schema: { tags, summary: "Delete a goal", params: idParams, response: { 204: z.null() } },
      },
      async (request, reply) => {
        const deleted = await ctx.db
          .delete(goals)
          .where(and(eq(goals.id, request.params.id), eq(goals.userId, currentUser(request).id)))
          .returning({ id: goals.id });
        if (deleted.length === 0) throw notFound("Goal");
        return reply.code(204).send(null);
      },
    );
  };
