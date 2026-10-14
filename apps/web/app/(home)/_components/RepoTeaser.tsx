"use client";

import { useRouter } from "next/navigation";
import { type SubmitEvent, useId, useMemo, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants";

interface RepoLabel {
  name: string;
  color: string;
  description: string | null;
  openIssues: number;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; repo: string; labels: RepoLabel[] };

/** Labels picked for you when a repository has them. */
const SUGGESTED_LABELS = ["help wanted", "good first issue"];
const EXAMPLES = ["freeCodeCamp/freeCodeCamp", "mdn/content", "microsoft/vscode"];
const MAX_VISIBLE_LABELS = 24;

/** Accepts `owner/name` or a GitHub URL, like the API does. */
function parseRepo(input: string): string | null {
  const path = input
    .trim()
    .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, "")
    .replace(/\/+$/, "");
  const [owner, name] = path.split("/");
  const valid = /^[A-Za-z0-9_.-]{1,100}$/;
  if (!owner || !name || !valid.test(owner) || !valid.test(name)) return null;
  return `${owner}/${name.replace(/\.git$/, "")}`;
}

/**
 * Hero form: pick a repository and labels, then sign in to be notified.
 * The choice travels to the sign-in page in the URL, so it survives the GitHub round trip.
 */
export function RepoTeaser() {
  const router = useRouter();
  const ids = { repo: useId(), status: useId(), filter: useId() };
  const [repoInput, setRepoInput] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  async function loadLabels(input: string) {
    const repo = parseRepo(input);
    if (!repo) {
      setStatus({ kind: "error", message: "Enter a repository as owner/name, or paste its URL." });
      return;
    }
    setStatus({ kind: "loading" });
    setFilter("");
    try {
      const response = await fetch(`/api/v1/public/repos/${repo}/labels`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setStatus({
          kind: "error",
          message:
            response.status === 404
              ? `We couldn't find a public repository named ${repo}.`
              : (body?.message ?? "Something went wrong. Try again in a moment."),
        });
        return;
      }
      const labels = (await response.json()) as RepoLabel[];
      setSelected(
        new Set(
          labels
            .filter((label) => SUGGESTED_LABELS.includes(label.name.toLowerCase()))
            .map((label) => label.name),
        ),
      );
      setStatus({ kind: "ready", repo, labels });
    } catch {
      setStatus({ kind: "error", message: "We couldn't reach the server. Try again in a moment." });
    }
  }

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadLabels(repoInput);
  }

  function toggle(name: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function continueToSignIn() {
    if (status.kind !== "ready") return;
    const params = new URLSearchParams({ repo: status.repo });
    for (const label of selected) params.append("label", label);
    router.push(`${ROUTES.signIn}?${params.toString()}`);
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
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <form onSubmit={onSubmit} className="flex flex-col gap-2" aria-describedby={ids.status}>
        <label htmlFor={ids.repo} className="text-sm font-semibold">
          Which repository would you like to contribute to?
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
                void loadLabels(example);
              }}
              className="rounded-full font-mono text-subtle underline decoration-border underline-offset-4 hover:text-accent"
            >
              {example}
            </button>
          ))}
        </p>
      </form>

      <div id={ids.status} aria-live="polite">
        {status.kind === "error" && (
          <p className="rounded-md bg-surface-muted px-4 py-3 text-sm">{status.message}</p>
        )}
        {status.kind === "ready" && status.labels.length === 0 && (
          <p className="rounded-md bg-surface-muted px-4 py-3 text-sm">
            {status.repo} has no labels. You can still follow every new issue after signing in.
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
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {selected.size === 0
                ? "Pick at least one label."
                : `We'll email you about new issues labeled ${[...selected].join(", ")}.`}
            </p>
            <button
              type="button"
              onClick={continueToSignIn}
              disabled={selected.size === 0}
              className={buttonClasses({ size: "lg" })}
            >
              Notify me
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
