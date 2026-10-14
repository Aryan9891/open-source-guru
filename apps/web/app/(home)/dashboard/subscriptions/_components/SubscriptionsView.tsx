"use client";

import { useCallback, useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import { SubscriptionCard } from "./SubscriptionCard";
import { SubscriptionForm } from "./SubscriptionForm";
import type { Channel, Subscription } from "./types";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; subscriptions: Subscription[]; channels: Channel[] };

/** The user's subscriptions, with a form to follow another repository. */
export function SubscriptionsView() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [subscriptions, channels] = await Promise.all([
        apiFetch<Subscription[]>("/v1/me/subscriptions"),
        apiFetch<Channel[]>("/v1/me/channels"),
      ]);
      // Newest first.
      setState({ kind: "ready", subscriptions: subscriptions.reverse(), channels });
    } catch (error) {
      setState({ kind: "error", message: (error as Error).message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === "loading") {
    return <div aria-busy="true" className="h-48 animate-pulse rounded-lg bg-surface-muted" />;
  }
  if (state.kind === "error") {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg bg-surface-muted p-6">
        <p>We couldn't load your subscriptions: {state.message}</p>
        <button type="button" onClick={() => void load()} className={buttonClasses()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {adding ? (
        <section className="rounded-lg border-2 border-primary bg-surface p-6">
          <h2 className="mb-4 font-display text-xl font-extrabold">Follow a repository</h2>
          <SubscriptionForm
            channels={state.channels}
            onSaved={() => {
              setAdding(false);
              void load();
            }}
            onCancel={() => setAdding(false)}
          />
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={buttonClasses({ className: "self-start" })}
        >
          Follow a repository
        </button>
      )}

      {state.subscriptions.length === 0 && !adding ? (
        <div className="rounded-lg border border-dashed border-border p-8">
          <h2 className="font-display text-2xl font-extrabold">No subscriptions yet</h2>
          <p className="mt-2 text-subtle">
            Follow a repository and pick the labels you care about, like "help wanted" or "good
            first issue". We'll email you when matching issues appear.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {state.subscriptions.map((subscription) => (
            <li key={subscription.id}>
              <SubscriptionCard
                subscription={subscription}
                channels={state.channels}
                onChange={() => void load()}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
