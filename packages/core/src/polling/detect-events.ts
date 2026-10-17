import type { IssueEventType, IssueLabel } from "../db/schema/github.ts";

/** An issue as returned by GitHub, normalized (see `toGitHubIssue`). */
export interface GitHubIssue {
  githubId: number;
  number: number;
  title: string;
  htmlUrl: string;
  state: "open" | "closed";
  labels: IssueLabel[];
  assignees: string[];
  authorLogin: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DetectedEvent {
  type: IssueEventType;
  issueNumber: number;
  /** The added label (`issue.labeled` only). */
  label: string | null;
  occurredAt: Date;
  /** Unique per real-world event, so re-processing the same data never duplicates it. */
  dedupeKey: string;
}

export interface DetectEventsInput {
  repoId: string;
  issue: GitHubIssue;
  /** What we stored for this issue on a previous poll, if anything. */
  previous: { labels: IssueLabel[] } | undefined;
  /** When we started watching the repo (`repositories.initialized_at`). */
  watchingSince: Date;
}

/**
 * Compares an issue with its stored snapshot and returns the events to record.
 *
 * - An issue we haven't seen, created after we started watching → `issue.opened`.
 *   Older unseen issues (reopened, transferred in) produce no event.
 * - A label present now but not in the snapshot → one `issue.labeled` per added label.
 *   Labels are compared by node ID, so renaming a label isn't mistaken for adding one.
 * - Closed issues never produce events.
 */
export function detectIssueEvents({
  repoId,
  issue,
  previous,
  watchingSince,
}: DetectEventsInput): DetectedEvent[] {
  if (issue.state !== "open") return [];

  if (!previous) {
    if (issue.createdAt < watchingSince) return [];
    return [
      {
        type: "issue.opened",
        issueNumber: issue.number,
        label: null,
        occurredAt: issue.createdAt,
        dedupeKey: `${repoId}:${issue.number}:opened`,
      },
    ];
  }

  const previousLabelIds = new Set(previous.labels.map((label) => label.nodeId));
  return issue.labels
    .filter((label) => !previousLabelIds.has(label.nodeId))
    .map((label) => ({
      type: "issue.labeled" as const,
      issueNumber: issue.number,
      label: label.name,
      occurredAt: issue.updatedAt,
      // A label can be removed and added again later: that's a new event.
      dedupeKey: `${repoId}:${issue.number}:labeled:${label.nodeId}:${issue.updatedAt.toISOString()}`,
    }));
}

/** Returns the issue numbers of all issues that are closed. */
export function findClosedIssueNumbers(issues: GitHubIssue[]): number[] {
  return issues.filter((issue) => issue.state === "closed").map((issue) => issue.number);
}
