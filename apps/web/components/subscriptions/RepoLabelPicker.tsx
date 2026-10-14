"use client";

import { type SubmitEvent, useId, useMemo, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import type { RepoLabelsPicker } from "./use-repo-labels";

const EXAMPLES = ["freeCodeCamp/freeCodeCamp", "mdn/content", "microsoft/vscode"];
const MAX_VISIBLE_LABELS = 24;

interface RepoLabelPickerProps {
  /** State and actions from `useRepoLabels()`, owned by the parent so it can read the choice. */
  picker: RepoLabelsPicker;
  question?: string;
  /** Starting value of the repository field. */
  initialRepo?: string;
  /** Hide the repository field: only the labels of the loaded repository can change (editing). */
  repoLocked?: boolean;
}

/** A repository field, then its labels as toggleable chips with open-issue counts. */
export function RepoLabelPicker({
  picker,
  question = "Which repository would you like to contribute to?",
  initialRepo = "",
  repoLocked = false,
}: RepoLabelPickerProps) {
  const { status, selected, load, toggle } = picker;
  const ids = { repo: useId(), status: useId(), filter: useId() };
  const [repoInput, setRepoInput] = useState(initialRepo);
  const [filter, setFilter] = useState("");

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilter("");
    void load(repoInput);
  }

  const visibleLabels = useMemo(() => {
    if (status.kind !== "ready") return [];
    const query = filter.trim().toLowerCase();
    const matching = query
      ? status.labels.filter((label) => label.name.toLowerCase().includes(query))
      : status.labels;
    // Keep selected labels visible even when filtered out or beyond the limit.
    const shown = matching.slice(0, MAX_VISIBLE_LABELS);
    const missing = status.labels.filter(
      (label) => selected.has(label.name) && !shown.includes(label),
    );
    return [...missing, ...shown];
  }, [status, filter, selected]);

  return (
    <div className="flex flex-col gap-5">
      {!repoLocked && (
        <form onSubmit={onSubmit} className="flex flex-col gap-2" aria-describedby={ids.status}>
          <label htmlFor={ids.repo} className="text-sm font-semibold">
            {question}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={ids.repo}
              value={repoInput}
              onChange={(event) => setRepoInput(event.target.value)}
              placeholder="owner/name or a GitHub URL"
              autoComplete="off"
              spellCheck={false}
              className="min-h-12 flex-1 rounded-md border-2 border-border bg-background px-4 font-mono text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              className={buttonClasses({ size: "lg", className: "rounded-md" })}
              disabled={status.kind === "loading"}
            >
              {status.kind === "loading" ? "Loading…" : "See labels"}
            </button>
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            Try
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setRepoInput(example);
                  setFilter("");
                  void load(example);
                }}
                className="rounded-full font-mono text-subtle underline decoration-border underline-offset-4 hover:text-accent"
              >
                {example}
              </button>
            ))}
          </p>
        </form>
      )}

      <div id={ids.status} aria-live="polite">
        {status.kind === "error" && (
          <p className="rounded-md bg-surface-muted px-4 py-3 text-sm">{status.message}</p>
        )}
        {status.kind === "ready" && status.labels.length === 0 && (
          <p className="rounded-md bg-surface-muted px-4 py-3 text-sm">
            {status.repo} has no labels. You can still follow every new issue.
          </p>
        )}
      </div>

      {status.kind === "ready" && status.labels.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-sm font-semibold">
              Labels in <span className="font-mono text-accent">{status.repo}</span>
            </p>
            {status.labels.length > MAX_VISIBLE_LABELS && (
              <div className="flex items-center gap-2">
                <label htmlFor={ids.filter} className="sr-only">
                  Filter labels
                </label>
                <input
                  id={ids.filter}
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="Filter labels"
                  className="min-h-9 w-44 rounded-full border border-border bg-background px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
                />
              </div>
            )}
          </div>
          <ul className="flex flex-wrap gap-2">
            {visibleLabels.map((label) => {
              const isSelected = selected.has(label.name);
              return (
                <li key={label.name}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggle(label.name)}
                    title={label.description ?? undefined}
                    className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors ${
                      isSelected
                        ? "border-highlight bg-highlight text-highlight-foreground"
                        : "border-border bg-chip text-chip-foreground hover:border-accent"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: `#${label.color}` }}
                    />
                    {label.name}
                    <span className="font-mono text-xs opacity-80">{label.openIssues}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
