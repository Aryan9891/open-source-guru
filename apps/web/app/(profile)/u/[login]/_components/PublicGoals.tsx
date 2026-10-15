import { formatNumber } from "@/lib/contributions";
import { goalTitle, periodLabel } from "@/lib/goals";
import type { PublicGoal } from "@/lib/profile";

/** Goals the user chose to show, with their current progress. */
export function PublicGoals({ goals }: { goals: PublicGoal[] }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-extrabold">Goals</h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {goals.map((goal) => {
          const current = goal.current;
          return (
            <li key={goal.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{goalTitle(goal)}</span>
                {current?.achievedAt && (
                  <span className="shrink-0 rounded-full bg-highlight px-2.5 py-0.5 text-xs font-semibold text-highlight-foreground">
                    Achieved
                  </span>
                )}
              </div>
              {current && (
                <>
                  <div
                    role="progressbar"
                    aria-label={goalTitle(goal)}
                    aria-valuemin={0}
                    aria-valuemax={goal.target}
                    aria-valuenow={Math.min(current.progress, goal.target)}
                    className="h-2 rounded-full bg-border"
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, (current.progress / goal.target) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted">
                    {formatNumber(current.progress)} / {formatNumber(goal.target)}{" "}
                    {periodLabel(goal, current)}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
