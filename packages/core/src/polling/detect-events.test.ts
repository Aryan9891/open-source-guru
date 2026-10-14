import { describe, expect, it } from "vitest";
import { detectIssueEvents, type GitHubIssue } from "./detect-events.ts";

const helpWanted = { nodeId: "LA_1", name: "help wanted", color: "008672" };
const goodFirstIssue = { nodeId: "LA_2", name: "good first issue", color: "7057ff" };
const watchingSince = new Date("2026-10-01T00:00:00Z");

const issue = (overrides: Partial<GitHubIssue> = {}): GitHubIssue => ({
  githubId: 1001,
  number: 42,
  title: "Fix the thing",
  htmlUrl: "https://github.com/acme/repo/issues/42",
  state: "open",
  labels: [],
  assignees: [],
  authorLogin: "octocat",
  createdAt: new Date("2026-10-10T10:00:00Z"),
  updatedAt: new Date("2026-10-10T12:00:00Z"),
  ...overrides,
});

describe("detectIssueEvents", () => {
  it("reports a new issue created after we started watching as opened", () => {
    const events = detectIssueEvents({
      repoId: "r1",
      issue: issue({ labels: [helpWanted] }),
      previous: undefined,
      watchingSince,
    });

    expect(events).toEqual([
      {
        type: "issue.opened",
        issueNumber: 42,
        label: null,
        occurredAt: new Date("2026-10-10T10:00:00Z"),
        dedupeKey: "r1:42:opened",
      },
    ]);
  });

  it("ignores unseen issues created before we started watching (reopened, transferred)", () => {
    const events = detectIssueEvents({
      repoId: "r1",
      issue: issue({ createdAt: new Date("2026-09-01T00:00:00Z"), labels: [helpWanted] }),
      previous: undefined,
      watchingSince,
    });

    expect(events).toEqual([]);
  });

  it("reports one labeled event per added label", () => {
    const events = detectIssueEvents({
      repoId: "r1",
      issue: issue({ labels: [helpWanted, goodFirstIssue] }),
      previous: { labels: [] },
      watchingSince,
    });

    expect(events.map((event) => [event.type, event.label])).toEqual([
      ["issue.labeled", "help wanted"],
      ["issue.labeled", "good first issue"],
    ]);
    expect(events[0]?.dedupeKey).toBe("r1:42:labeled:LA_1:2026-10-10T12:00:00.000Z");
  });

  it("reports nothing when labels didn't change, were removed, or were renamed", () => {
    const renamed = { ...helpWanted, name: "Help Wanted 🙏" };

    expect(
      detectIssueEvents({
        repoId: "r1",
        issue: issue({ labels: [renamed] }),
        previous: { labels: [helpWanted, goodFirstIssue] },
        watchingSince,
      }),
    ).toEqual([]);
  });

  it("never reports events for closed issues", () => {
    expect(
      detectIssueEvents({
        repoId: "r1",
        issue: issue({ state: "closed", labels: [helpWanted] }),
        previous: { labels: [] },
        watchingSince,
      }),
    ).toEqual([]);
  });

  it("treats a label added again later as a new event", () => {
    const first = detectIssueEvents({
      repoId: "r1",
      issue: issue({ labels: [helpWanted] }),
      previous: { labels: [] },
      watchingSince,
    });
    const again = detectIssueEvents({
      repoId: "r1",
      issue: issue({ labels: [helpWanted], updatedAt: new Date("2026-10-12T08:00:00Z") }),
      previous: { labels: [] },
      watchingSince,
    });

    expect(first[0]?.dedupeKey).not.toBe(again[0]?.dedupeKey);
  });
});
