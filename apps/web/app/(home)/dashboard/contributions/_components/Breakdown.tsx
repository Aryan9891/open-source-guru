import {
  type ContributionKind,
  formatNumber,
  formatShortDate,
  KIND_LABELS,
  type Stats,
} from "@/lib/contributions";

const KINDS = Object.keys(KIND_LABELS) as ContributionKind[];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-muted">{children}</p>
);

/** By type (one bar each, one color: the bar length carries the value), by repository, merged PRs. */
export function Breakdown({ stats }: { stats: Stats }) {
  const max = Math.max(1, ...KINDS.map((kind) => stats.byKind[kind]));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="By type">
        <ul className="flex flex-col gap-3">
          {KINDS.map((kind) => (
            <li key={kind} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3 text-sm">
              <span className="text-subtle">{KIND_LABELS[kind]}</span>
              <span className="h-2 rounded-full bg-surface-muted">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${(stats.byKind[kind] / max) * 100}%` }}
                />
              </span>
              <span className="text-right font-semibold tabular-nums">
                {formatNumber(stats.byKind[kind])}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Repositories">
        {stats.byRepo.length === 0 ? (
          <Empty>No open-source repositories in this period yet.</Empty>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {stats.byRepo.map((repo) => (
              <li
                key={repo.fullName}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <a
                  href={repo.url}
                  className="min-w-0 truncate font-mono font-semibold underline-offset-4 hover:underline"
                >
                  {repo.fullName}
                </a>
                <span className="flex shrink-0 items-center gap-2">
                  {repo.license && (
                    <span className="rounded-full bg-chip px-2 py-0.5 text-xs text-chip-foreground">
                      {repo.license}
                    </span>
                  )}
                  <span className="w-10 text-right font-semibold tabular-nums">
                    {formatNumber(repo.count)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="min-w-0 md:col-span-2">
        <Card title="Recently merged pull requests">
          {stats.mergedPullRequests.length === 0 ? (
            <Empty>No merged pull requests in this period.</Empty>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {stats.mergedPullRequests.map((pr) => (
                <li
                  key={`${pr.repo.fullName}-${pr.mergedAt}`}
                  className="flex flex-col gap-0.5 py-2 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <a
                    href={pr.url ?? pr.repo.url}
                    className="min-w-0 truncate font-semibold underline-offset-4 hover:underline"
                  >
                    {pr.title ?? "Pull request"}
                  </a>
                  <span className="shrink-0 text-muted">
                    <span className="font-mono">{pr.repo.fullName}</span> · merged{" "}
                    {formatShortDate(pr.mergedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
