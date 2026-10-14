"use client";

import { useCallback, useState } from "react";
import { ApiRequestError, apiFetch } from "@/lib/api-client";
import { parseRepo } from "@/lib/repo";

export interface RepoLabel {
  name: string;
  color: string;
  description: string | null;
  openIssues: number;
}

export type RepoLabelsStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; repo: string; labels: RepoLabel[] };

/** Labels picked for you when a repository has them. */
const SUGGESTED_LABELS = ["help wanted", "good first issue"];

/**
 * Loads a repository's labels (with open-issue counts) and tracks which ones are selected.
 * Shared by the landing page teaser, onboarding and the subscriptions page.
 */
export function useRepoLabels() {
  const [status, setStatus] = useState<RepoLabelsStatus>({ kind: "idle" });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /**
   * Loads the labels of `input` (owner/name or a GitHub URL). Selects `preselect` when given,
   * otherwise "help wanted" and "good first issue" if the repository has them.
   */
  const load = useCallback(async (input: string, preselect?: string[]) => {
    const repo = parseRepo(input);
    if (!repo) {
      setStatus({ kind: "error", message: "Enter a repository as owner/name, or paste its URL." });
      return;
    }
    setStatus({ kind: "loading" });
    try {
      const labels = await apiFetch<RepoLabel[]>(`/v1/public/repos/${repo}/labels`);
      const wanted = (preselect ?? SUGGESTED_LABELS).map((name) => name.toLowerCase());
      setSelected(
        new Set(
          labels
            .filter((label) => wanted.includes(label.name.toLowerCase()))
            .map((label) => label.name),
        ),
      );
      setStatus({ kind: "ready", repo, labels });
    } catch (error) {
      const message =
        error instanceof ApiRequestError
          ? error.status === 404
            ? `We couldn't find a public repository named ${repo}.`
            : error.message
          : "We couldn't reach the server. Try again in a moment.";
      setStatus({ kind: "error", message });
    }
  }, []);

  const toggle = useCallback((name: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  return { status, selected, load, toggle };
}

export type RepoLabelsPicker = ReturnType<typeof useRepoLabels>;
