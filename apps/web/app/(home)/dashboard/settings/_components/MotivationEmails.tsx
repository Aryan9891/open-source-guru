"use client";

import { useId, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Switch } from "@/components/ui/Switch";
import { apiFetch } from "@/lib/api-client";

type Preference = "streakReminders" | "goalEmails";

const OPTIONS: { key: Preference; title: string; description: string }[] = [
  {
    key: "streakReminders",
    title: "Streak reminders",
    description:
      "When your streak needs a contribution: on Friday evening for weekly streaks, in the evening for daily ones (your time zone).",
  },
  {
    key: "goalEmails",
    title: "Goal achieved",
    description: "A congratulation email when you reach a goal.",
  },
];

/** Opt-in emails, off by default; saved as soon as they're switched. */
export function MotivationEmails() {
  const { state, refresh } = useAuth();
  const user = state.user;
  const id = useId();
  const [saving, setSaving] = useState<Preference | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return <div aria-busy="true" className="h-24 animate-pulse rounded-md bg-surface-muted" />;
  }

  async function change(key: Preference, value: boolean) {
    setSaving(key);
    setError(null);
    try {
      await apiFetch("/v1/me", { method: "PATCH", body: { [key]: value } });
      await refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {OPTIONS.map((option) => (
        <div key={option.key} className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-${option.key}`} className="font-semibold">
              {option.title}
            </label>
            <p id={`${id}-${option.key}-description`} className="text-sm text-muted">
              {option.description}
            </p>
          </div>
          <Switch
            id={`${id}-${option.key}`}
            checked={user[option.key]}
            disabled={saving !== null}
            describedBy={`${id}-${option.key}-description`}
            onChange={(value) => void change(option.key, value)}
          />
        </div>
      ))}
      <p role="alert" className="text-sm text-danger empty:hidden">
        {error ?? ""}
      </p>
    </div>
  );
}
