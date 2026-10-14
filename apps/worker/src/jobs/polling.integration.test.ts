import { eq } from "@osg/core/db/query";
import { events, repositories } from "@osg/core/db/schema";
import { describe, expect, it } from "vitest";
import {
  createWorkerTest,
  goodFirstIssue,
  helpWanted,
  issue,
  useTestDatabase,
} from "../testing/setup.ts";
import { pollRepository } from "./poll-repo.ts";
import { findRepositoriesDue } from "./schedule-polls.ts";

const database = useTestDatabase();
const setup = () => createWorkerTest(database());

describe("polling", () => {
  it("stores a snapshot on the first poll without creating events", async () => {
    const { ctx, github, repo } = await setup();
    github.state.issues = [issue(1, { labels: [helpWanted] }), issue(2, { state: "closed" })];

    const result = await pollRepository(ctx, repo.id);

    expect(result).toEqual({ outcome: "initialized", issues: 1 });
    expect(github.state.requests[0]).toMatchObject({ state: "open", since: undefined });
    expect(await database().db.select().from(events)).toEqual([]);
    const saved = await database().db.query.repositories.findFirst({
      where: eq(repositories.id, repo.id),
    });
    expect(saved?.initializedAt).toEqual(ctx.now());
  });

  it("detects new issues and added labels on later polls", async () => {
    const { ctx, github, advance, repo } = await setup();
    github.state.issues = [issue(1)];
    await pollRepository(ctx, repo.id);

    const later = advance(2 * 60 * 1000);
    github.state.etag = 'W/"2"';
    github.state.issues = [
      issue(1, { labels: [helpWanted], updatedAt: later }),
      issue(2, { labels: [goodFirstIssue], createdAt: later, updatedAt: later }),
    ];
    const result = await pollRepository(ctx, repo.id);

    expect(result).toEqual({ outcome: "updated", issues: 2, events: 2 });
    const saved = await database().db.select().from(events);
    expect(saved.map((event) => [event.type, event.issueNumber, event.label]).sort()).toEqual([
      ["issue.labeled", 1, "help wanted"],
      ["issue.opened", 2, null],
    ]);

    // Polling the same data again creates nothing new.
    github.state.etag = 'W/"3"';
    expect(await pollRepository(ctx, repo.id)).toMatchObject({ outcome: "updated", events: 0 });
  });

  it("uses the ETag and handles 304 Not Modified", async () => {
    const { ctx, github, repo } = await setup();
    await pollRepository(ctx, repo.id);
    await pollRepository(ctx, repo.id); // stores ETag W/"1"

    expect(await pollRepository(ctx, repo.id)).toEqual({ outcome: "not_modified" });
    expect(github.state.requests.at(-1)?.etag).toBe('W/"1"');
  });

  it("stops polling repositories that no longer exist", async () => {
    const { ctx, github, repo } = await setup();
    await pollRepository(ctx, repo.id);
    github.state.notFound = true;

    expect(await pollRepository(ctx, repo.id)).toEqual({ outcome: "not_found" });
    expect(await findRepositoriesDue(ctx)).toEqual([]);
  });

  it("only schedules repositories that are due and followed", async () => {
    const { ctx, advance, repo } = await setup();
    expect(await findRepositoriesDue(ctx)).toEqual([repo.id]);

    await pollRepository(ctx, repo.id);
    expect(await findRepositoriesDue(ctx)).toEqual([]);

    advance(repo.pollIntervalSeconds * 1000);
    expect(await findRepositoriesDue(ctx)).toEqual([repo.id]);
  });
});
