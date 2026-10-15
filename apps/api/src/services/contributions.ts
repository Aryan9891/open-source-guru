import { dateInTimeZone, type IsoDate } from "@osg/core/contributions/dates";
import { type Period, resolvePeriod } from "@osg/core/contributions/period";
import { and, eq, gte, lte } from "@osg/core/db/query";
import { contributionDays, contributions } from "@osg/core/db/schema";
import { z } from "zod";
import type { ApiContext } from "../context.ts";

/** Today on GitHub's graph, which is in UTC (contribution dates follow it). */
export const githubToday = (ctx: ApiContext): IsoDate => dateInTimeZone(ctx.now(), "UTC");

export const periodQuery = z.object({
  year: z.coerce
    .number()
    .int()
    .min(2008)
    .max(2100)
    .optional()
    .describe("A calendar year; the last 12 months when omitted"),
});

export const periodResponse = z.object({
  from: z.string().describe("First day, YYYY-MM-DD"),
  to: z.string().describe("Last day, YYYY-MM-DD"),
  year: z.number().int().nullable(),
});

export const periodFor = (ctx: ApiContext, year: number | undefined): Period =>
  resolvePeriod(year, githubToday(ctx));

/** Conditions selecting a user's contributions in a period. */
export const contributionsIn = (userId: string, period: Period) =>
  and(
    eq(contributions.userId, userId),
    gte(contributions.date, period.from),
    lte(contributions.date, period.to),
  );

export const daysIn = (userId: string, period: Period) =>
  and(
    eq(contributionDays.userId, userId),
    gte(contributionDays.date, period.from),
    lte(contributionDays.date, period.to),
  );

export const repoResponse = z.object({
  fullName: z.string(),
  url: z.string(),
  license: z.string().nullable().describe("SPDX identifier detected by GitHub"),
});

export const toRepo = (repo: { owner: string; name: string; licenseSpdxId: string | null }) => ({
  fullName: `${repo.owner}/${repo.name}`,
  url: `https://github.com/${repo.owner}/${repo.name}`,
  license: repo.licenseSpdxId,
});

export const contributionKind = z.enum(["commit", "issue", "pull_request", "review", "discussion"]);
