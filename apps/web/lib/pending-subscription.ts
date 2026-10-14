/**
 * The repository and labels picked on the landing page before signing in. They travel in the
 * URL (`?repo=owner/name&label=…&label=…`) through GitHub's sign-in and back, so onboarding
 * (new users) or the dashboard (returning users) can create the subscription.
 */
export interface PendingSubscription {
  repo: string;
  labels: string[];
}

const REPO = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const MAX_LABELS = 20;

type SearchParams = Record<string, string | string[] | undefined>;

/** Reads and validates the pending subscription from search params; null when absent or invalid. */
export function readPendingSubscription(params: SearchParams): PendingSubscription | null {
  const repo = typeof params.repo === "string" ? params.repo : null;
  if (!repo || !REPO.test(repo)) return null;
  const raw = params.label;
  const labels = (Array.isArray(raw) ? raw : raw ? [raw] : [])
    .map((label) => label.trim())
    .filter((label) => label.length > 0 && label.length <= 100)
    .slice(0, MAX_LABELS);
  return { repo, labels: [...new Set(labels)] };
}

/** Appends the pending subscription to a path, e.g. `/onboarding?repo=…&label=…`. */
export function withPendingSubscription(path: string, pending: PendingSubscription | null) {
  if (!pending) return path;
  const params = new URLSearchParams({ repo: pending.repo });
  for (const label of pending.labels) params.append("label", label);
  return `${path}?${params.toString()}`;
}
