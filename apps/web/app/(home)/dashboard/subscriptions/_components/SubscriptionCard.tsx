"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import { SubscriptionForm } from "./SubscriptionForm";
import { type Channel, EVENT_LABELS, FREQUENCY_LABELS, type Subscription } from "./types";

/** One subscription: what it follows, where it emails, and its actions. */
export function SubscriptionCard({
  subscription,
  channels,
  onChange,
}: {
  subscription: Subscription;
  channels: Channel[];
  onChange: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paused = subscription.status === "paused";

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChange();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const togglePause = () =>
    run(() =>
      apiFetch(`/v1/me/subscriptions/${subscription.id}`, {
        method: "PATCH",
        body: { status: paused ? "active" : "paused" },
      }),
    );
  const remove = () =>
    run(() => apiFetch(`/v1/me/subscriptions/${subscription.id}`, { method: "DELETE" }));

  const addresses = subscription.channels
    .map((link) => {
      const channel = channels.find((candidate) => candidate.id === link.channelId);
      return channel ? `${channel.address}, ${FREQUENCY_LABELS[link.frequency]}` : null;
    })
    .filter((text): text is string => text !== null);

  return (
    <article className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-mono text-lg font-semibold">
          <a href={subscription.repo.url} className="hover:text-accent">
            {subscription.repo.fullName}
          </a>
        </h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${
            paused ? "bg-surface-muted text-muted" : "bg-chip text-chip-foreground"
          }`}
        >
          {paused ? "Paused" : "Active"}
        </span>
      </div>

      {mode === "edit" ? (
        <SubscriptionForm
          subscription={subscription}
          channels={channels}
          onSaved={() => {
            setMode("view");
            onChange();
          }}
          onCancel={() => setMode("view")}
        />
      ) : (
        <>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted">Labels</dt>
            <dd className="flex flex-wrap gap-1.5">
              {subscription.labels.length === 0 ? (
                <span>Any new issue</span>
              ) : (
                subscription.labels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-border bg-chip px-2.5 py-0.5 text-chip-foreground"
                  >
                    {label}
                  </span>
                ))
              )}
              {subscription.labels.length > 1 && (
                <span className="text-muted">
                  ({subscription.labelMatch === "all" ? "all of them" : "any of them"})
                </span>
              )}
            </dd>
            <dt className="text-muted">Events</dt>
            <dd>{subscription.events.map((event) => EVENT_LABELS[event]).join(" · ")}</dd>
            <dt className="text-muted">Emails</dt>
            <dd>
              {addresses.length > 0
                ? addresses.join(" · ")
                : "Not emailing anywhere (unsubscribed). Edit to start again."}
            </dd>
          </dl>

          <p role="alert" className="text-sm text-danger empty:hidden">
            {error ?? ""}
          </p>

          {mode === "confirm-delete" ? (
            <div className="flex flex-wrap items-center justify-end gap-3">
              <span className="text-sm">Stop following {subscription.repo.fullName}?</span>
              <button
                type="button"
                onClick={() => setMode("view")}
                className={buttonClasses({ variant: "ghost" })}
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy}
                className={buttonClasses({ variant: "danger" })}
              >
                Delete
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setMode("edit")}
                className={buttonClasses({ variant: "secondary" })}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void togglePause()}
                disabled={busy}
                className={buttonClasses({ variant: "secondary" })}
              >
                {paused ? "Resume" : "Pause"}
              </button>
              <button
                type="button"
                onClick={() => setMode("confirm-delete")}
                className={buttonClasses({ variant: "ghost", className: "text-danger" })}
              >
                Delete
              </button>
            </div>
          )}
        </>
      )}
    </article>
  );
}
