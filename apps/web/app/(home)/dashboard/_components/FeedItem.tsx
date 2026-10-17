export interface FeedEntry {
  eventId: string;
  type: "issue.opened" | "issue.labeled";
  label: string | null;
  occurredAt: string;
  repo: { fullName: string; url: string };
  issue: {
    number: number;
    title: string;
    url: string;
    state: "open" | "closed";
    labels: string[];
    assignees: string[];
  };
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "12 minutes ago", "yesterday"… */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

function Availability({ issue }: { issue: FeedEntry["issue"] }) {
  if (issue.state === "closed") {
    return <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-muted">Closed</span>;
  }
  if (issue.assignees.length > 0) {
    return (
      <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-subtle">
        Assigned to {issue.assignees.join(", ")}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-highlight px-2.5 py-0.5 font-semibold text-highlight-foreground">
      Not assigned yet
    </span>
  );
}

/** One issue that matched a subscription. */
export function FeedItem({ entry }: { entry: FeedEntry }) {
  const reason = entry.type === "issue.opened" ? "New issue" : `Labeled ${entry.label}`;
  const muted = entry.issue.state === "closed";

  return (
    <article
      className={`flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 ${muted ? "opacity-70" : ""}`}
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-sm text-muted">
        <a
          href={entry.repo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-accent"
        >
          {entry.repo.fullName}
        </a>
        <span aria-hidden="true">·</span>
        <span>
          {reason}{" "}
          <time dateTime={entry.occurredAt} title={new Date(entry.occurredAt).toLocaleString()}>
            {timeAgo(entry.occurredAt)}
          </time>
        </span>
      </p>
      <h3 className="text-lg font-semibold leading-snug">
        <a
          href={entry.issue.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-accent"
        >
          #{entry.issue.number} {entry.issue.title}
        </a>
      </h3>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Availability issue={entry.issue} />
        {entry.issue.labels.map((label) => (
          <span
            key={label}
            className="rounded-full border border-border bg-chip px-2.5 py-0.5 text-chip-foreground"
          >
            {label}
          </span>
        ))}
      </div>
    </article>
  );
}
