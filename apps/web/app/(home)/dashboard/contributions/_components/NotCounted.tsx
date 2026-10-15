import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { type Excluded, formatNumber, REASON_LABELS } from "@/lib/contributions";

/** These aren't Open Source Contributions, so they're just "contributions". */
const countText = (count: number) => `${formatNumber(count)} contribution${count === 1 ? "" : "s"}`;

/** What GitHub counts but we don't, and why. Private dashboard only. */
export function NotCounted({ excluded }: { excluded: Excluded }) {
  const nothing = excluded.reasons.length === 0 && !excluded.private;

  return (
    <section
      id="not-counted"
      aria-labelledby="not-counted-title"
      className="flex scroll-mt-24 flex-col gap-4 rounded-lg border border-border bg-surface p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="not-counted-title" className="font-display text-lg font-extrabold">
          Not counted
        </h2>
        <p className="text-sm text-muted">
          GitHub counts these too, which is why its total is usually higher. Only you see this.{" "}
          <Link
            href={`${ROUTES.docs}/contributions#what-counts`}
            className="text-subtle underline underline-offset-4 hover:text-foreground"
          >
            What counts
          </Link>
        </p>
      </div>

      {nothing ? (
        <p className="text-sm text-subtle">
          Everything GitHub counted in this period is counted here too.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm">
          {excluded.reasons.map(({ reason, count }) => (
            <li key={reason}>
              <span className="font-semibold">{countText(count)}</span>{" "}
              <span className="text-subtle">{REASON_LABELS[reason]}</span>
            </li>
          ))}
          {excluded.private ? (
            <li>
              <span className="font-semibold">{countText(excluded.private)}</span>{" "}
              <span className="text-subtle">in private repositories</span>
            </li>
          ) : null}
        </ul>
      )}

      {excluded.repos.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-subtle hover:text-foreground">
            Repositories
          </summary>
          <ul className="mt-2 flex flex-col divide-y divide-border">
            {excluded.repos.map((repo) => (
              <li
                key={`${repo.reason}-${repo.fullName}`}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <a
                  href={repo.url}
                  className="min-w-0 truncate font-mono underline-offset-4 hover:underline"
                >
                  {repo.fullName}
                </a>
                <span className="shrink-0 text-muted">
                  {REASON_LABELS[repo.reason]} ·{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatNumber(repo.count)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
