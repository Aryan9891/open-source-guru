"use client";

import { useCallback, useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import { type Goal, MAX_GOALS } from "@/lib/goals";
import { GoalCard } from "./GoalCard";
import { GoalForm } from "./GoalForm";

export function GoalsView() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setGoals(await apiFetch<Goal[]>("/v1/me/goals"));
    } catch (caught) {
      setError((caught as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error)
    return (
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
    );
  if (!goals)
    return <div aria-busy="true" className="h-40 animate-pulse rounded-lg bg-surface-muted" />;

  const full = goals.length >= MAX_GOALS;
  const showForm = creating || goals.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {showForm && !full ? (
        <GoalForm
          onCreated={() => {
            setCreating(false);
            void load();
          }}
          onCancel={goals.length > 0 ? () => setCreating(false) : undefined}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {goals.length} of {MAX_GOALS} goals{full ? ": delete one to set another." : "."}
          </p>
          <button
            type="button"
            disabled={full}
            onClick={() => setCreating(true)}
            className={buttonClasses()}
          >
            Set a goal
          </button>
        </div>
      )}

      {goals.length > 0 && (
        <ul className="flex flex-col gap-4">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onChanged={() => void load()} />
          ))}
        </ul>
      )}
    </div>
  );
}
