import type { Metadata } from "next";
import { Suspense } from "react";
import { ContributionsView } from "./_components/ContributionsView";

export const metadata: Metadata = { title: "Contributions" };

export default function ContributionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Contributions</h1>
        <p className="text-subtle">
          Your Open Source Contributions: work on other people's open-source projects.
        </p>
      </header>
      {/* The year comes from the URL (?year=), read in the browser. */}
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-surface-muted" />}>
        <ContributionsView />
      </Suspense>
    </div>
  );
}
