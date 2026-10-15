"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { apiFetch } from "@/lib/api-client";
import { formatNumber, formatShortDate } from "@/lib/contributions";
import { type Goal, goalTitle, periodLabel } from "@/lib/goals";

/** One goal: progress in the current period, past periods, and its actions. */
export function GoalCard({ goal, onChanged }: { goal: Goal; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = goal.periods.at(-1);
  const past = goal.periods.slice(0, -1);
  const archived = goal.status === "archived";

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const patch = (body: object) =>
    run(() => apiFetch(`/v1/me/goals/${goal.id}`, { method: "PATCH", body }));

  return (
    <li
      className={`flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 ${archived ? "opacity-70" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-display text-lg font-extrabold">{goalTitle(goal)}</h2>
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
          {current?.achievedAt && (
            <span className="rounded-full bg-highlight px-2.5 py-1 text-highlight-foreground">
              Achieved
            </span>
          )}
          <span className="rounded-full bg-chip px-2.5 py-1 text-chip-foreground">
            {goal.isPublic ? "Public" : "Private"}
          </span>
          {archived && (
            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-muted">Archived</span>
          )}
        </div>
      </div>

      {current ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>
              <span className="font-display text-2xl font-extrabold tabular-nums">
                {formatNumber(current.progress)}
              </span>
              <span className="text-subtle"> / {formatNumber(goal.target)}</span>
            </span>
            <span className="text-muted">{periodLabel(goal, current)}</span>
          </div>
          <div
            role="progressbar"
            aria-label="Progress"
            aria-valuemin={0}
            aria-valuemax={goal.target}
            aria-valuenow={Math.min(current.progress, goal.target)}
            className="h-2.5 rounded-full bg-border"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, (current.progress / goal.target) * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Starts {formatShortDate(goal.startsOn)}.</p>
      )}

      {past.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">
            Achieved {past.filter((period) => period.achievedAt).length} of the last {past.length}{" "}
            {goal.recurrence === "weekly" ? "weeks" : "months"}
          </span>
          <ul className="flex gap-1">
            {past.map((period) => (
              <li
                key={period.start}
                title={`${formatShortDate(period.start)}: ${formatNumber(period.progress)} / ${formatNumber(goal.target)}`}
                className={`h-2 w-6 rounded-full ${period.achievedAt ? "bg-primary" : "bg-surface-muted"}`}
              />
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
        <p role="alert" className="mr-auto text-sm text-danger empty:hidden">
          {error ?? ""}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void patch({ isPublic: !goal.isPublic })}
          className={buttonClasses({ variant: "ghost" })}
        >
          {goal.isPublic ? "Make private" : "Make public"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void patch({ status: archived ? "active" : "archived" })}
          className={buttonClasses({ variant: "ghost" })}
        >
          {archived ? "Restore" : "Archive"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmingDelete(true)}
          className={buttonClasses({ variant: "ghost", className: "text-danger" })}
        >
          Delete
        </button>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this goal?"
        confirmLabel="Delete"
        variant="danger"
        busy={busy}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() =>
          void run(() => apiFetch(`/v1/me/goals/${goal.id}`, { method: "DELETE" })).then(() =>
            setConfirmingDelete(false),
          )
        }
      >
        Its progress history is deleted too. To keep it, archive the goal instead.
      </ConfirmDialog>
    </li>
  );
}
