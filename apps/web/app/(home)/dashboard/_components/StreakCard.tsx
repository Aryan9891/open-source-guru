"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StreakSummary } from "@/components/contributions/StreakSummary";
import { apiFetch } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";
import { contributionsText, type Stats } from "@/lib/contributions";

/** The current streak and last year's total, linking to the contributions page. */
export function StreakCard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    apiFetch<Stats>("/v1/me/stats")
      .then(setStats)
      .catch(() => {});
  }, []);

  // Nothing until the first sync: the feed comes first.
  if (!stats?.lastSyncedAt) return null;

  return (
    <section
      aria-label="Your streak"
      className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-border bg-surface p-5"
    >
      <StreakSummary streaks={stats.streaks} compact />
      <Link
        href={ROUTES.dashboard.contributions}
        className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        {contributionsText(stats.total)} in the last year →
      </Link>
    </section>
  );
}
