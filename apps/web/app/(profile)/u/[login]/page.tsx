import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breakdown } from "@/components/contributions/Breakdown";
import { ContributionGraph } from "@/components/contributions/ContributionGraph";
import { StreakSummary } from "@/components/contributions/StreakSummary";
import { YearPicker } from "@/components/contributions/YearPicker";
import { buttonClasses } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants";
import { contributionsText, parseYear } from "@/lib/contributions";
import { fetchProfile } from "@/lib/profile";
import { PublicGoals } from "./_components/PublicGoals";

type Props = PageProps<"/u/[login]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { login } = await params;
  const profile = await fetchProfile(login, null);
  if (!profile) return { title: "Profile not found", robots: { index: false } };
  const title = `${profile.name || profile.login} (@${profile.login})`;
  const description = `${contributionsText(profile.stats.total)} in the last year: work on other people's open-source projects.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image" },
  };
}

export default function ProfilePage({ params, searchParams }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:px-6">
      {/* The login and year come from the URL: read inside <Suspense>. */}
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-surface-muted" />}>
        <Profile params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Profile({ params, searchParams }: Props) {
  const { login } = await params;
  const yearParam = (await searchParams).year;
  const year = parseYear(typeof yearParam === "string" ? yearParam : null);
  const profile = await fetchProfile(login, year);
  if (!profile) notFound();
  const { stats } = profile;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center gap-5">
        {profile.avatarUrl ? (
          // biome-ignore lint/performance/noImgElement: avatar from GitHub's CDN
          <img
            src={profile.avatarUrl}
            alt=""
            width={88}
            height={88}
            className="size-22 rounded-full border-2 border-border"
          />
        ) : null}
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            {profile.name || profile.login}
          </h1>
          <a
            href={profile.githubUrl}
            className="font-mono text-subtle underline-offset-4 hover:underline"
          >
            @{profile.login} on GitHub
          </a>
          {profile.bio && <p className="max-w-prose text-subtle">{profile.bio}</p>}
        </div>
      </header>

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
              Commits, pull requests, reviews, issues and discussions in public, OSI-licensed
              repositories that @{profile.login} doesn't own. Repositories link to GitHub.
            </p>
          </div>
          {stats.lastSyncedAt ? (
            <ContributionGraph stats={stats} />
          ) : (
            <p className="rounded-md bg-surface-muted p-4 text-sm text-subtle">
              Contributions are still being fetched from GitHub.
            </p>
          )}
        </section>
        <YearPicker years={stats.years} selected={year} basePath={ROUTES.profile(profile.login)} />
      </div>

      <StreakSummary streaks={stats.streaks} owner={false} />
      {profile.goals.length > 0 && <PublicGoals goals={profile.goals} />}
      <Breakdown stats={stats} />

      <aside className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-surface-muted p-5">
        <p className="text-subtle">
          Track your own Open Source Contributions, and get emailed about issues you could work on.
        </p>
        <Link href={ROUTES.home} className={buttonClasses()}>
          Get started
        </Link>
      </aside>
    </div>
  );
}
