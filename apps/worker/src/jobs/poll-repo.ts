import type { DatabaseOrTransaction } from "@osg/core/db";
import { and, eq, inArray, sql } from "@osg/core/db/query";
import { events, issueSnapshots, repositories } from "@osg/core/db/schema";
import { RepositoryNotFoundError } from "@osg/core/github";
import { detectIssueEvents, findClosedIssueNumbers, type GitHubIssue } from "@osg/core/polling";
import type { WorkerContext } from "../context.ts";

/**
 * How far back the next `since` goes before the newest change we've seen. GitHub's issue
 * listing can lag a little; re-reading a few minutes of changes is cheap (unchanged results
 * return 304) and snapshot comparison makes it harmless.
 */
export const CURSOR_OVERLAP_MS = 5 * 60 * 1000;

/** Safety limit on pages per poll (100 issues each). */
export const MAX_PAGES = 100;

export type PollResult =
  | { outcome: "skipped" }
  | { outcome: "initialized"; issues: number }
  | { outcome: "not_modified" }
  | { outcome: "updated"; issues: number; events: number }
  | { outcome: "not_found" };

/** Polls one repository and records snapshots and events. */
export async function pollRepository(ctx: WorkerContext, repoId: string): Promise<PollResult> {
  const { db, github } = ctx;
  const repo = await db.query.repositories.findFirst({ where: eq(repositories.id, repoId) });
  if (repo?.status !== "active") return { outcome: "skipped" };

  const now = ctx.now();
  const nextPollAt = new Date(now.getTime() + repo.pollIntervalSeconds * 1000);

  try {
    if (!repo.initializedAt) {
      // First poll: store every open issue, notify nobody.
      const issues = await fetchAllPages(ctx, {
        owner: repo.owner,
        name: repo.name,
        state: "open",
      });
      await db.transaction(async (tx) => {
        await upsertSnapshots(tx, repo.id, issues, now);
        await tx
          .update(repositories)
          .set({
            initializedAt: now,
            // We just captured the current state; only later changes matter.
            cursorSince: new Date(now.getTime() - CURSOR_OVERLAP_MS),
            etag: null,
            nextPollAt,
            lastPolledAt: now,
            lastPollError: null,
          })
          .where(eq(repositories.id, repo.id));
      });
      ctx.log.info(
        { repo: `${repo.owner}/${repo.name}`, issues: issues.length },
        "repository initialized",
      );
      return { outcome: "initialized", issues: issues.length };
    }

    const cursorSince = repo.cursorSince ?? new Date(now.getTime() - CURSOR_OVERLAP_MS);
    const first = await github.listIssuesPage({
      owner: repo.owner,
      name: repo.name,
      state: "all",
      since: cursorSince,
      page: 1,
      etag: repo.etag,
    });

    if (first.notModified) {
      await db
        .update(repositories)
        .set({ nextPollAt, lastPolledAt: now, lastPollError: null })
        .where(eq(repositories.id, repo.id));
      return { outcome: "not_modified" };
    }

    const issues = [...first.issues];
    if (first.hasNextPage) {
      issues.push(
        ...(await fetchAllPages(
          ctx,
          { owner: repo.owner, name: repo.name, state: "all", since: cursorSince },
          2,
        )),
      );
    }

    const created = await db.transaction(async (tx) => {
      const numbers = issues.map((issue) => issue.number);
      const previous =
        numbers.length === 0
          ? []
          : await tx
              .select({ issueNumber: issueSnapshots.issueNumber, labels: issueSnapshots.labels })
              .from(issueSnapshots)
              .where(
                and(
                  eq(issueSnapshots.repoId, repo.id),
                  inArray(issueSnapshots.issueNumber, numbers),
                ),
              );
      const previousByNumber = new Map(previous.map((row) => [row.issueNumber, row]));

      const rows = issues.flatMap((issue) =>
        detectIssueEvents({
          repoId: repo.id,
          issue,
          previous: previousByNumber.get(issue.number),
          watchingSince: repo.initializedAt as Date,
        }).map((event) => ({
          repoId: repo.id,
          issueNumber: event.issueNumber,
          type: event.type,
          label: event.label,
          occurredAt: event.occurredAt,
          dedupeKey: event.dedupeKey,
          createdAt: now,
          issue: {
            number: issue.number,
            title: issue.title,
            htmlUrl: issue.htmlUrl,
            labels: issue.labels,
            assignees: issue.assignees,
            authorLogin: issue.authorLogin,
          },
        })),
      );

      const inserted =
        rows.length === 0
          ? []
          : await tx
              .insert(events)
              .values(rows)
              .onConflictDoNothing({ target: events.dedupeKey })
              .returning({ id: events.id });

      const closedNumbers = findClosedIssueNumbers(issues);
      if (closedNumbers.length > 0) {
        await tx
          .delete(events)
          .where(and(eq(events.repoId, repo.id), inArray(events.issueNumber, closedNumbers)));
        await tx
          .delete(issueSnapshots)
          .where(
            and(
              eq(issueSnapshots.repoId, repo.id),
              inArray(issueSnapshots.issueNumber, closedNumbers),
            ),
          );
      }

      const openIssues = issues.filter((issue) => issue.state === "open");
      await upsertSnapshots(tx, repo.id, openIssues, now);
      await tx
        .update(repositories)
        .set({
          etag: first.etag,
          cursorSince: cursorAfter(issues, cursorSince),
          nextPollAt,
          lastPolledAt: now,
          lastPollError: null,
        })
        .where(eq(repositories.id, repo.id));

      return inserted.length;
    });

    return { outcome: "updated", issues: issues.length, events: created };
  } catch (error) {
    if (error instanceof RepositoryNotFoundError) {
      await db
        .update(repositories)
        .set({ status: "not_found", lastPolledAt: now, lastPollError: "Repository not found" })
        .where(eq(repositories.id, repo.id));
      ctx.log.warn({ repo: `${repo.owner}/${repo.name}` }, "repository not found; polling stopped");
      return { outcome: "not_found" };
    }

    // Back off before the next attempt; the job itself fails so pg-boss records the error.
    await db
      .update(repositories)
      .set({
        lastPollError: error instanceof Error ? error.message : String(error),
        nextPollAt: new Date(now.getTime() + repo.pollIntervalSeconds * 1000 * 5),
      })
      .where(eq(repositories.id, repo.id));
    throw error;
  }
}

async function fetchAllPages(
  ctx: WorkerContext,
  params: { owner: string; name: string; state: "open" | "all"; since?: Date | null },
  startPage = 1,
): Promise<GitHubIssue[]> {
  const issues: GitHubIssue[] = [];
  for (let page = startPage; page <= MAX_PAGES; page++) {
    const result = await ctx.github.listIssuesPage({ ...params, page });
    if (result.notModified) break;
    issues.push(...result.issues);
    if (!result.hasNextPage) break;
    if (page === MAX_PAGES) {
      ctx.log.warn({ repo: `${params.owner}/${params.name}` }, "page limit reached while polling");
    }
  }
  return issues;
}

/** The next `since`: newest `updated_at` seen minus the overlap. Never moves backwards. */
function cursorAfter(issues: GitHubIssue[], previous: Date): Date {
  if (issues.length === 0) return previous;
  const newest = Math.max(...issues.map((issue) => issue.updatedAt.getTime()));
  return new Date(Math.max(newest - CURSOR_OVERLAP_MS, previous.getTime()));
}

async function upsertSnapshots(
  tx: DatabaseOrTransaction,
  repoId: string,
  issues: GitHubIssue[],
  now: Date,
): Promise<void> {
  if (issues.length === 0) return;
  await tx
    .insert(issueSnapshots)
    .values(
      issues.map((issue) => ({
        repoId,
        issueNumber: issue.number,
        githubId: issue.githubId,
        title: issue.title,
        htmlUrl: issue.htmlUrl,
        state: issue.state,
        labels: issue.labels,
        assignees: issue.assignees,
        authorLogin: issue.authorLogin,
        githubCreatedAt: issue.createdAt,
        githubUpdatedAt: issue.updatedAt,
        syncedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [issueSnapshots.repoId, issueSnapshots.issueNumber],
      set: {
        githubId: sql`excluded.github_id`,
        title: sql`excluded.title`,
        htmlUrl: sql`excluded.html_url`,
        state: sql`excluded.state`,
        labels: sql`excluded.labels`,
        assignees: sql`excluded.assignees`,
        authorLogin: sql`excluded.author_login`,
        githubUpdatedAt: sql`excluded.github_updated_at`,
        syncedAt: sql`excluded.synced_at`,
      },
    });
}
