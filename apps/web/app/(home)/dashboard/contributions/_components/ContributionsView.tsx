"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { StreakSummary } from "@/components/contributions/StreakSummary";
import { apiFetch } from "@/lib/api-client";
import {
  contributionsText,
  type Excluded,
  formatShortDate,
  parseYear,
  type Stats,
} from "@/lib/contributions";
import { Breakdown } from "./Breakdown";
import { ContributionGraph } from "./ContributionGraph";
import { NotCounted } from "./NotCounted";
import { YearPicker } from "./YearPicker";

/** While the first sync runs, check again this often. */
const FIRST_SYNC_POLL_MS = 10_000;

export function ContributionsView() {
  const year = parseYear(useSearchParams().get("year"));
  const [data, setData] = useState<{ stats: Stats; excluded: Excluded } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const query = year === null ? "" : `?year=${year}`;

    async function load() {
      try {
        const [stats, excluded] = await Promise.all([
          apiFetch<Stats>(`/v1/me/stats${query}`),
          apiFetch<Excluded>(`/v1/me/contributions/excluded${query}`),
        ]);
        if (cancelled) return;
        setData({ stats, excluded });
        setError(null);
        if (!stats.lastSyncedAt) timer = setTimeout(load, FIRST_SYNC_POLL_MS);
      } catch (caught) {
        if (!cancelled) setError((caught as Error).message);
      }
    }

    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [year]);

  if (error)
    return (
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
    );
  if (!data) {
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        <div className="h-10 w-2/3 animate-pulse rounded-md bg-surface-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-surface-muted" />
      </div>
    );
  }

  const { stats, excluded } = data;
  const firstSync = stats.lastSyncedAt === null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <section
          aria-labelledby="total"
          className="flex min-w-0 flex-1 flex-col gap-4 rounded-lg border border-border bg-surface p-5"
        >
          <div className="flex flex-col gap-1">
            <h2 id="total" className="font-display text-xl font-extrabold">
              {contributionsText(stats.total)} {year === null ? "in the last year" : `in ${year}`}
            </h2>
            <p className="text-sm text-muted">
              Public, OSI-licensed repositories you don't own.{" "}
              <a
                href="#not-counted"
                className="text-subtle underline underline-offset-4 hover:text-foreground"
              >
                Why fewer than on GitHub?
              </a>
            </p>
          </div>
          {firstSync ? (
            <p role="status" className="rounded-md bg-surface-muted p-4 text-sm text-subtle">
              We're fetching your contributions from GitHub. This takes a minute or two; this page
              updates by itself.
            </p>
          ) : (
            <ContributionGraph stats={stats} />
          )}
        </section>
        <YearPicker years={stats.years} selected={year} />
      </div>

      <StreakSummary streaks={stats.streaks} />
      <Breakdown stats={stats} />
      <NotCounted excluded={excluded} />

      {stats.lastSyncedAt && (
        <p className="text-xs text-muted">
          Synced from GitHub {formatShortDate(stats.lastSyncedAt)}. Refreshed every few hours.
        </p>
      )}
    </div>
  );
}
