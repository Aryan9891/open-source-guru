import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { formatShortDate, type Stats, streakText } from "@/lib/contributions";

/** Current and longest streak, in the period chosen in Settings (weekly by default). */
export function StreakSummary({
  streaks,
  compact = false,
}: {
  streaks: Stats["streaks"];
  compact?: boolean;
}) {
  const { period } = streaks;
  const streak = streaks[period];
  const unit = period === "week" ? "Weekly" : "Daily";
  const hint =
    streak.current > 0 && streak.currentStart
      ? `Since ${period === "week" ? "the week of " : ""}${formatShortDate(streak.currentStart)}`
      : period === "week"
        ? "Contribute this week to start one."
        : "Contribute today to start one.";

  return (
    <div
      className={`flex flex-wrap gap-x-10 gap-y-4 ${compact ? "" : "rounded-lg border border-border bg-surface p-5"}`}
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-muted">{unit} streak</span>
        <span className="font-display text-3xl font-extrabold tracking-tight">
          {streakText(streak.current, period)}
        </span>
        <span className="text-sm text-subtle">{hint}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-muted">Longest</span>
        <span className="font-display text-3xl font-extrabold tracking-tight">
          {streakText(streak.longest, period)}
        </span>
        <Link
          href={ROUTES.dashboard.settings}
          className="text-sm text-subtle underline-offset-4 hover:text-foreground hover:underline"
        >
          Count {period === "week" ? "days" : "weeks"} instead
        </Link>
      </div>
    </div>
  );
}
