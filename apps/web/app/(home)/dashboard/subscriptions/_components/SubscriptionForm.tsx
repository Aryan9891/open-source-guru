"use client";

import { useEffect, useId, useState } from "react";
import { type Frequency, FrequencyPicker } from "@/components/subscriptions/FrequencyPicker";
import { RepoLabelPicker } from "@/components/subscriptions/RepoLabelPicker";
import { useRepoLabels } from "@/components/subscriptions/use-repo-labels";
import { buttonClasses } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import { type Channel, EVENT_LABELS, type EventType, type Subscription } from "./types";

const ALL_EVENTS: EventType[] = ["issue.opened", "issue.labeled"];

/** Follow a repository (no `subscription`), or edit an existing subscription. */
export function SubscriptionForm({
  subscription,
  channels,
  onSaved,
  onCancel,
}: {
  subscription?: Subscription;
  channels: Channel[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const picker = useRepoLabels();
  const { status, selected, load } = picker;
  const matchName = useId();
  const [events, setEvents] = useState<Set<EventType>>(new Set(subscription?.events ?? ALL_EVENTS));
  const [labelMatch, setLabelMatch] = useState(subscription?.labelMatch ?? "any");
  const [frequency, setFrequency] = useState<Frequency>(
    subscription?.channels[0]?.frequency ?? "instant",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (subscription) void load(subscription.repo.fullName, subscription.labels);
  }, [subscription, load]);

  function toggleEvent(event: EventType) {
    setEvents((current) => {
      const next = new Set(current);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  }

  async function save() {
    setError(null);
    if (status.kind !== "ready") return setError("Choose a repository first.");
    if (events.size === 0) return setError("Choose at least one kind of event.");

    // Emails go to the subscription's channels; a new one (or one without any) uses the
    // first active address.
    const primary = channels.find((channel) => channel.status === "active");
    const targets = subscription?.channels.length
      ? subscription.channels.map((channel) => channel.channelId)
      : primary
        ? [primary.id]
        : [];
    const body = {
      labels: [...selected],
      events: [...events],
      labelMatch,
      channels: targets.map((channelId) => ({ channelId, frequency })),
    };

    setSaving(true);
    try {
      if (subscription) {
        await apiFetch(`/v1/me/subscriptions/${subscription.id}`, { method: "PATCH", body });
      } else {
        await apiFetch("/v1/me/subscriptions", {
          method: "POST",
          body: {
            ...body,
            repo: status.repo,
            channels: body.channels.length ? body.channels : undefined,
          },
        });
      }
      onSaved();
    } catch (caught) {
      setError((caught as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <RepoLabelPicker
        picker={picker}
        repoLocked={Boolean(subscription)}
        question="Which repository do you want to follow?"
      />

      {status.kind === "ready" && (
        <>
          <p className="text-sm text-muted">
            {selected.size === 0
              ? "No label selected: you'll hear about every new issue in this repository."
              : `Selected: ${[...selected].join(", ")}.`}
          </p>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">Notify me about</legend>
            {ALL_EVENTS.map((event) => (
              <label key={event} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={events.has(event)}
                  onChange={() => toggleEvent(event)}
                  className="size-4 accent-primary"
                />
                {EVENT_LABELS[event]}
              </label>
            ))}
          </fieldset>

          {selected.size > 1 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-semibold">An issue matches when it has</legend>
              {(["any", "all"] as const).map((value) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={matchName}
                    checked={labelMatch === value}
                    onChange={() => setLabelMatch(value)}
                    className="size-4 accent-primary"
                  />
                  {value === "any" ? "Any of these labels" : "All of these labels"}
                </label>
              ))}
            </fieldset>
          )}

          <FrequencyPicker value={frequency} onChange={setFrequency} />
        </>
      )}

      <p role="alert" className="text-sm text-danger empty:hidden">
        {error ?? ""}
      </p>
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className={buttonClasses({ variant: "ghost" })}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || status.kind !== "ready"}
          className={buttonClasses()}
        >
          {saving ? "Saving…" : subscription ? "Save changes" : "Follow repository"}
        </button>
      </div>
    </div>
  );
}
