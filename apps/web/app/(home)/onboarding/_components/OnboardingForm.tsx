"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { EmailSettings } from "@/components/account/EmailSettings";
import { useAuth } from "@/components/auth/AuthProvider";
import { type Frequency, FrequencyPicker } from "@/components/subscriptions/FrequencyPicker";
import { RepoLabelPicker } from "@/components/subscriptions/RepoLabelPicker";
import { useRepoLabels } from "@/components/subscriptions/use-repo-labels";
import { buttonClasses } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";
import type { PendingSubscription } from "@/lib/pending-subscription";
import type { CurrentUser } from "@/lib/session";

interface Channel {
  id: string;
  status: "pending" | "active" | "disabled";
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6 sm:p-8">
      <h2 className="flex items-center gap-3 font-display text-2xl font-extrabold tracking-tight">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-base text-primary-foreground">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** First visit after signing up: email settings, then a first subscription (optional). */
export function OnboardingForm({
  user,
  pending,
}: {
  user: CurrentUser;
  pending: PendingSubscription | null;
}) {
  const router = useRouter();
  const { refresh } = useAuth();
  const picker = useRepoLabels();
  const { status, selected, load } = picker;
  const [timezone, setTimezone] = useState(user.timezone);
  const [digestHour, setDigestHour] = useState(user.digestHour);
  const [frequency, setFrequency] = useState<Frequency>("instant");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Accounts start on UTC: suggest the browser's time zone instead.
    if (user.timezone === "UTC") {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    }
    // Coming from the landing page: load that repository with the labels picked there.
    if (pending) void load(pending.repo, pending.labels.length > 0 ? pending.labels : undefined);
  }, [user.timezone, pending, load]);

  async function save(withSubscription: boolean) {
    setError(null);
    if (withSubscription && status.kind === "ready" && selected.size === 0) {
      setError("Pick at least one label, or skip this step.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/v1/me", { method: "PATCH", body: { timezone, digestHour } });
      if (withSubscription && status.kind === "ready") {
        const channels = await apiFetch<Channel[]>("/v1/me/channels");
        const channel = channels.find((candidate) => candidate.status === "active");
        await apiFetch("/v1/me/subscriptions", {
          method: "POST",
          body: {
            repo: status.repo,
            labels: [...selected],
            ...(channel && { channels: [{ channelId: channel.id, frequency }] }),
          },
        });
      }
      await refresh();
      router.push(ROUTES.dashboard.feed);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Try again.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Welcome, {user.login}!
        </h1>
        <p className="text-lg text-subtle">Two quick steps and you're set.</p>
      </header>

      <Step number={1} title="Your emails">
        <EmailSettings
          email={user.email}
          timezone={timezone}
          digestHour={digestHour}
          onTimezoneChange={setTimezone}
          onDigestHourChange={setDigestHour}
        />
      </Step>

      <Step number={2} title="Your first subscription">
        <RepoLabelPicker picker={picker} initialRepo={pending?.repo ?? ""} />
        {status.kind === "ready" && <FrequencyPicker value={frequency} onChange={setFrequency} />}
      </Step>

      <div className="flex flex-col gap-4">
        <p role="alert" className="text-sm text-danger empty:hidden">
          {error ?? ""}
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => void save(false)}
            disabled={saving}
            className={buttonClasses({ variant: "ghost", size: "lg" })}
          >
            Skip this step
          </button>
          <button
            type="button"
            onClick={() => void save(true)}
            disabled={saving}
            className={buttonClasses({ size: "lg" })}
          >
            {saving ? "Saving…" : "Finish setup"}
          </button>
        </div>
        <p className="text-sm text-muted sm:text-end">
          You can change all of this later from your dashboard.
        </p>
      </div>
    </div>
  );
}
