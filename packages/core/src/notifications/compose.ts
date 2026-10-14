import type { EventIssue, IssueEventType } from "../db/schema/github.ts";

/** One pending delivery, with what's needed to describe it in an email. */
export interface DeliveryItem {
  deliveryId: string;
  subscriptionId: string;
  repo: { owner: string; name: string };
  event: { type: IssueEventType; label: string | null; occurredAt: Date; issue: EventIssue };
}

export interface EmailIssue {
  number: number;
  title: string;
  url: string;
  labels: string[];
  assignees: string[];
  /** Why it's in the email, e.g. "New issue" or "Labeled help wanted". */
  reasons: string[];
}

export interface EmailRepoSection {
  fullName: string;
  url: string;
  /** Subscriptions covered by this section, for per-repo unsubscribe links. */
  subscriptionIds: string[];
  issues: EmailIssue[];
}

const describeEvent = (event: DeliveryItem["event"]) =>
  event.type === "issue.opened" ? "New issue" : `Labeled ${event.label}`;

/**
 * Groups deliveries into repo sections for one email. An issue that matched several
 * subscriptions or events appears once, with every reason listed.
 * Repos are sorted by name; issues by most recent event first.
 */
export function groupDeliveriesByRepo(items: DeliveryItem[]): EmailRepoSection[] {
  const sections = new Map<
    string,
    { section: EmailRepoSection; issues: Map<number, EmailIssue & { latest: number }> }
  >();

  for (const item of items) {
    const fullName = `${item.repo.owner}/${item.repo.name}`;
    let entry = sections.get(fullName);
    if (!entry) {
      entry = {
        section: {
          fullName,
          url: `https://github.com/${fullName}`,
          subscriptionIds: [],
          issues: [],
        },
        issues: new Map(),
      };
      sections.set(fullName, entry);
    }
    if (!entry.section.subscriptionIds.includes(item.subscriptionId)) {
      entry.section.subscriptionIds.push(item.subscriptionId);
    }

    const { issue } = item.event;
    const reason = describeEvent(item.event);
    const occurredAt = item.event.occurredAt.getTime();
    const existing = entry.issues.get(issue.number);
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
      existing.latest = Math.max(existing.latest, occurredAt);
    } else {
      entry.issues.set(issue.number, {
        number: issue.number,
        title: issue.title,
        url: issue.htmlUrl,
        labels: issue.labels.map((label) => label.name),
        assignees: issue.assignees,
        reasons: [reason],
        latest: occurredAt,
      });
    }
  }

  return [...sections.values()]
    .map(({ section, issues }) => ({
      ...section,
      issues: [...issues.values()]
        .sort((a, b) => b.latest - a.latest)
        .map(({ latest: _latest, ...issue }) => issue),
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}
