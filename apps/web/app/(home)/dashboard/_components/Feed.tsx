"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";
import { type FeedEntry, FeedItem } from "./FeedItem";

const PAGE_SIZE = 20;

interface FeedPage {
  items: FeedEntry[];
  nextBefore: string | null;
}

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; items: FeedEntry[]; nextBefore: string | null; hasSubscriptions: boolean };

/**
 * Issues that matched the user's subscriptions, newest first, with "Load more".
 * `reloadKey` changes when a subscription was just created, to reload from the top.
 */
export function Feed({ reloadKey }: { reloadKey: number }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFirstPage = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const [page, subscriptions] = await Promise.all([
        apiFetch<FeedPage>(`/v1/me/feed?limit=${PAGE_SIZE}`),
        apiFetch<unknown[]>("/v1/me/subscriptions"),
      ]);
      setState({ kind: "ready", ...page, hasSubscriptions: subscriptions.length > 0 });
    } catch (error) {
      setState({ kind: "error", message: (error as Error).message });
    }
  }, []);

  useEffect(() => {
    void reloadKey;
    void loadFirstPage();
  }, [loadFirstPage, reloadKey]);

  async function loadMore() {
    if (state.kind !== "ready" || !state.nextBefore) return;
    setLoadingMore(true);
    try {
      const before = encodeURIComponent(state.nextBefore);
      const page = await apiFetch<FeedPage>(`/v1/me/feed?limit=${PAGE_SIZE}&before=${before}`);
      setState({ ...state, items: [...state.items, ...page.items], nextBefore: page.nextBefore });
    } finally {
      setLoadingMore(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-32 animate-pulse rounded-lg bg-surface-muted" />
        ))}
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg bg-surface-muted p-6">
        <p>We couldn't load your feed: {state.message}</p>
        <button type="button" onClick={() => void loadFirstPage()} className={buttonClasses()}>
          Try again
        </button>
      </div>
    );
  }

  if (state.items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-8">
        <h2 className="font-display text-2xl font-extrabold">No matching issues yet</h2>
        {state.hasSubscriptions ? (
          <p className="text-subtle">
            We check your repositories every couple of minutes. New issues with your labels will
            show up here, and in your inbox.
          </p>
        ) : (
          <>
            <p className="text-subtle">Follow a repository to start receiving issues here.</p>
            <Link href={ROUTES.dashboard.subscriptions} className={buttonClasses()}>
              Add a subscription
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-4">
        {state.items.map((entry) => (
          <li key={entry.eventId}>
            <FeedItem entry={entry} />
          </li>
        ))}
      </ul>
      {state.nextBefore && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className={buttonClasses({ variant: "secondary", className: "self-center" })}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
