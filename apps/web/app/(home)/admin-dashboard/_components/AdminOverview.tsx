"use client";

import { useEffect, useState } from "react";
import type { AdminStats } from "@/lib/admin";
import { apiFetch } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";
import { formatNumber } from "@/lib/contributions";
import { Card } from "./Card";
import { SignupsChart } from "./SignupsChart";
import { StatTile } from "./StatTile";

/** Platform-wide numbers: headline tiles, sign-ups, what people follow, and pipeline health. */
export function AdminOverview() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AdminStats>("/v1/admin/stats")
      .then(setStats)
      .catch((caught: Error) => setError(caught.message));
  }, []);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!stats) {
    return <div aria-busy="true" className="h-96 animate-pulse rounded-lg bg-surface-muted" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Users"
          value={stats.users.total}
          detail={`+${formatNumber(stats.users.newLast7Days)} this week · ${formatNumber(stats.users.admins)} admin${stats.users.admins === 1 ? "" : "s"}`}
          href={ROUTES.admin.users}
        />
        <StatTile
          label="Repositories"
          value={stats.repositories.total}
          detail={`${formatNumber(stats.repositories.followed)} followed · ${formatNumber(stats.repositories.fromContributions)} from contributions`}
          href={ROUTES.admin.repositories}
        />
        <StatTile
          label="Subscriptions"
          value={stats.subscriptions.total}
          detail={`${formatNumber(stats.subscriptions.active)} active`}
        />
        <StatTile
          label="Notifications sent"
          value={stats.deliveries.sent}
          detail={`${formatNumber(stats.events.last7Days)} new issue events this week`}
        />
      </div>

      <Card title="Sign-ups, last 30 days">
        <p className="-mt-2 text-sm text-subtle">
          {formatNumber(stats.users.newLast30Days)} new accounts ·{" "}
          {formatNumber(stats.users.publicProfiles)} public profiles in total
        </p>
        <SignupsChart days={stats.signupsByDay} />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Most followed repositories" href={ROUTES.admin.repositories}>
          <RankedList
            empty="Nobody follows a repository yet."
            items={stats.topRepositories.map((repo) => ({
              key: repo.fullName,
              label: repo.fullName,
              value: repo.subscribers,
              mono: true,
            }))}
          />
        </Card>
        <Card title="Most followed labels" href={ROUTES.admin.labels}>
          <RankedList
            empty="No subscription filters on labels yet."
            items={stats.topLabels.map((label) => ({
              key: label.name,
              label: label.name,
              value: label.subscriptions,
              chip: true,
            }))}
          />
        </Card>
      </div>

      <Card title="Health">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <Metric label="Pending notifications" value={stats.deliveries.pending} />
          <Metric label="Failed notifications" value={stats.deliveries.failed} warn />
          <Metric
            label="Repositories with poll errors"
            value={stats.repositories.withPollError}
            warn
          />
          <Metric
            label="Active email addresses"
            value={stats.channels.active}
            of={stats.channels.total}
          />
          <Metric label="Open Source Contributions" value={stats.contributions} />
          <Metric label="Active goals · API keys" value={stats.activeGoals} extra={stats.apiKeys} />
        </dl>
      </Card>
    </div>
  );
}

/** Top entries with a bar for their share of the first one. */
function RankedList({
  items,
  empty,
}: {
  items: { key: string; label: string; value: number; mono?: boolean; chip?: boolean }[];
  empty: string;
}) {
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li
          key={item.key}
          className="grid grid-cols-[minmax(0,1fr)_5rem_2.5rem] items-center gap-3 text-sm"
        >
          <span
            className={
              item.chip
                ? "w-fit max-w-full truncate rounded-full bg-chip px-2.5 py-0.5 text-chip-foreground"
                : `truncate font-semibold ${item.mono ? "font-mono" : ""}`
            }
          >
            {item.label}
          </span>
          <span className="h-2 rounded-full bg-border">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </span>
          <span className="text-right font-semibold tabular-nums">{formatNumber(item.value)}</span>
        </li>
      ))}
    </ul>
  );
}

function Metric({
  label,
  value,
  of,
  extra,
  warn = false,
}: {
  label: string;
  value: number;
  of?: number;
  extra?: number;
  warn?: boolean;
}) {
  const alert = warn && value > 0;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted">{label}</dt>
      <dd className={`font-semibold tabular-nums ${alert ? "text-danger" : ""}`}>
        {formatNumber(value)}
        {of !== undefined && <span className="font-normal text-muted"> / {formatNumber(of)}</span>}
        {extra !== undefined && <> · {formatNumber(extra)}</>}
        {alert && <span className="ml-1.5 text-xs font-normal">needs a look</span>}
      </dd>
    </div>
  );
}
