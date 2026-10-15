"use client";

import { type SubmitEvent, useId, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import {
  type GoalMetric,
  type GoalRecurrence,
  type GoalRepoScope,
  goalTitle,
  METRIC_NOUNS,
  METRIC_OPTIONS,
} from "@/lib/goals";

const field =
  "min-h-11 rounded-md border-2 border-border bg-background px-3 text-sm focus:border-accent focus:outline-none";

const RECURRENCES: { value: GoalRecurrence; label: string }[] = [
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "none", label: "Once, between two dates" },
];

const today = () => new Date().toISOString().slice(0, 10);
const capitalize = (text: string) => text[0]?.toUpperCase() + text.slice(1);

/** Sets a goal. Counts Open Source Contributions only, like everything else. */
export function GoalForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  /** Absent when the form is the only thing on the page (no goals yet). */
  onCancel?: () => void;
}) {
  const id = useId();
  const [metric, setMetric] = useState<GoalMetric>("contributions");
  const [target, setTarget] = useState(10);
  const [recurrence, setRecurrence] = useState<GoalRecurrence>("monthly");
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState("");
  const [repoScope, setRepoScope] = useState<GoalRepoScope>("all");
  const [repo, setRepo] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const oneOff = recurrence === "none";
  const preview = goalTitle({
    metric,
    target: Math.max(1, target || 1),
    recurrence,
    endsOn: oneOff ? endsOn || null : null,
    repoScope,
    repo: repo.trim() ? { fullName: repo.trim(), url: "" } : null,
  });

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/v1/me/goals", {
        method: "POST",
        body: {
          metric,
          target,
          recurrence,
          ...(oneOff && { startsOn, endsOn }),
          repoScope,
          ...(repoScope === "repo" && { repo: repo.trim() }),
          isPublic,
        },
      });
      onCreated();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-lg bg-surface-muted p-5">
      <p className="font-semibold">Set a goal</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <label htmlFor={`${id}-metric`} className="flex flex-col gap-1 text-sm">
          What to count
          <select
            id={`${id}-metric`}
            value={metric}
            onChange={(event) => setMetric(event.target.value as GoalMetric)}
            className={field}
          >
            {METRIC_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {capitalize(METRIC_NOUNS[option][1])}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-target`} className="flex flex-col gap-1 text-sm">
          Target
          <input
            id={`${id}-target`}
            type="number"
            required
            min={1}
            max={10000}
            value={target}
            onChange={(event) => setTarget(Number(event.target.value))}
            className={field}
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm">How often</legend>
        <div className="flex flex-wrap gap-2">
          {RECURRENCES.map((option) => (
            <label
              key={option.value}
              className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full border-2 border-border bg-background px-4 text-sm font-semibold has-checked:border-primary has-focus-visible:outline-2 has-focus-visible:outline-ring"
            >
              <input
                type="radio"
                name={`${id}-recurrence`}
                value={option.value}
                checked={recurrence === option.value}
                onChange={() => setRecurrence(option.value)}
                className="size-4 accent-primary"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {oneOff && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label htmlFor={`${id}-start`} className="flex flex-col gap-1 text-sm">
            From
            <input
              id={`${id}-start`}
              type="date"
              required
              value={startsOn}
              onChange={(event) => setStartsOn(event.target.value)}
              className={field}
            />
          </label>
          <label htmlFor={`${id}-end`} className="flex flex-col gap-1 text-sm">
            Until
            <input
              id={`${id}-end`}
              type="date"
              required
              min={startsOn}
              value={endsOn}
              onChange={(event) => setEndsOn(event.target.value)}
              className={field}
            />
          </label>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={`${id}-scope`} className="flex flex-col gap-1 text-sm">
          Where
          <select
            id={`${id}-scope`}
            value={repoScope}
            onChange={(event) => setRepoScope(event.target.value as GoalRepoScope)}
            className={field}
          >
            <option value="all">All open-source repositories</option>
            <option value="subscribed">Repositories you follow</option>
            <option value="repo">One repository</option>
          </select>
        </label>
        {repoScope === "repo" && (
          <label htmlFor={`${id}-repo`} className="flex flex-col gap-1 text-sm">
            Repository
            <input
              id={`${id}-repo`}
              required
              value={repo}
              onChange={(event) => setRepo(event.target.value)}
              placeholder="owner/name"
              className={`${field} font-mono placeholder:text-muted`}
            />
          </label>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(event) => setIsPublic(event.target.checked)}
          className="size-4 accent-primary"
        />
        Public: show it on your profile
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-sm text-subtle">
          Goal: <span className="font-semibold text-foreground">{preview}</span>
        </p>
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={buttonClasses({ variant: "ghost" })}
            >
              Cancel
            </button>
          )}
          <button type="submit" disabled={busy} className={buttonClasses()}>
            {busy ? "Saving…" : "Set goal"}
          </button>
        </div>
      </div>
      <p role="alert" className="text-sm text-danger empty:hidden">
        {error ?? ""}
      </p>
    </form>
  );
}
