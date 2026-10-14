import type { IssueEventType, IssueLabel } from "../db/schema/github.ts";
import type { LabelMatch } from "../db/schema/notifications.ts";

export interface SubscriptionFilter {
  eventTypes: IssueEventType[];
  /** Label names; empty means "any issue". */
  labels: string[];
  labelMatch: LabelMatch;
}

export interface MatchableEvent {
  type: IssueEventType;
  /** The added label (`issue.labeled` only). */
  label: string | null;
  issue: { labels: IssueLabel[] };
}

const normalize = (label: string) => label.trim().toLowerCase();

/**
 * Whether an event should be delivered to a subscription. Labels are compared case-insensitively.
 *
 * - `issue.opened`: the new issue's labels satisfy the filter (`any`: at least one, `all`: every one).
 * - `issue.labeled`: the added label is one of the subscription's labels, and with `all`
 *   the issue now has every one of them (so the notification fires when the set is completed).
 */
export function matchesSubscription(
  subscription: SubscriptionFilter,
  event: MatchableEvent,
): boolean {
  if (!subscription.eventTypes.includes(event.type)) return false;

  const wanted = subscription.labels.map(normalize);
  if (wanted.length === 0) return true;

  const issueLabels = new Set(event.issue.labels.map((label) => normalize(label.name)));
  const hasAllWanted = wanted.every((label) => issueLabels.has(label));

  if (event.type === "issue.labeled") {
    if (event.label === null || !wanted.includes(normalize(event.label))) return false;
    return subscription.labelMatch === "all" ? hasAllWanted : true;
  }

  return subscription.labelMatch === "all"
    ? hasAllWanted
    : wanted.some((label) => issueLabels.has(label));
}
