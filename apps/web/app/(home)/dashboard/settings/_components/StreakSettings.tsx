"use client";

import { useEffect, useId, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { buttonClasses } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import type { StreakPeriod } from "@/lib/contributions";

const options: { value: StreakPeriod; title: string; description: string }[] = [
  {
    value: "week",
    title: "Weekly",
    description: "A week counts with at least one contribution. Fits uneven open-source work.",
  },
  {
    value: "day",
    title: "Daily",
    description: "A day counts with at least one contribution. For a stronger habit.",
  },
];

/** Weekly (default) or daily streaks. Both are always computed, so switching is instant. */
export function StreakSettings() {
  const { state, refresh } = useAuth();
  const user = state.user;
  const name = useId();
  const [period, setPeriod] = useState<StreakPeriod>("week");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (user) setPeriod(user.streakPeriod);
  }, [user]);

  if (!user) {
    return <div aria-busy="true" className="h-24 animate-pulse rounded-md bg-surface-muted" />;
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await apiFetch("/v1/me", { method: "PATCH", body: { streakPeriod: period } });
      await refresh();
      setMessage({ ok: true, text: "Saved." });
    } catch (error) {
      setMessage({ ok: false, text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Streak period</legend>
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer flex-col gap-1 rounded-lg border-2 border-border bg-background p-4 transition-colors hover:border-accent has-checked:border-primary has-checked:bg-surface-muted has-focus-visible:outline-2 has-focus-visible:outline-ring"
          >
            <span className="flex items-center gap-2 font-semibold">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={period === option.value}
                onChange={() => setPeriod(option.value)}
                className="size-4 accent-primary"
              />
              {option.title}
            </span>
            <span className="text-sm text-subtle">{option.description}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <p
          role="status"
          className={`text-sm empty:hidden ${message?.ok === false ? "text-danger" : "text-muted"}`}
        >
          {message?.text ?? ""}
        </p>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || period === user.streakPeriod}
          className={buttonClasses()}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
