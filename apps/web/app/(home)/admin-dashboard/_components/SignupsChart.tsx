"use client";

import { useState } from "react";
import { formatDate, formatNumber } from "@/lib/contributions";

const signupsText = (count: number) => `${formatNumber(count)} sign-up${count === 1 ? "" : "s"}`;

/** Sign-ups per day: one bar per day in the primary color, with a tooltip and a table view. */
export function SignupsChart({ days }: { days: { date: string; count: number }[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((day) => day.count));
  const first = days[0];
  const last = days.at(-1);
  const active = hovered === null ? undefined : days[hovered];

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <div className="flex justify-between text-xs text-muted">
          <span className="tabular-nums">{formatNumber(max)}</span>
        </div>
        <div
          role="img"
          aria-label={`Daily sign-ups${first && last ? ` from ${formatDate(first.date)} to ${formatDate(last.date)}` : ""}. "Show as a table" lists them.`}
          className="flex h-40 items-end border-b border-border"
          onPointerLeave={() => setHovered(null)}
        >
          {days.map((day, index) => (
            // The whole column is the hover target: bigger than the bar.
            <div
              key={day.date}
              className="flex h-full flex-1 items-end px-px"
              onPointerEnter={() => setHovered(index)}
            >
              <div
                className={`w-full rounded-t-[4px] transition-colors ${
                  hovered === index ? "bg-accent" : "bg-primary"
                }`}
                style={{ height: day.count ? `${Math.max(2, (day.count / max) * 100)}%` : 0 }}
              />
            </div>
          ))}
        </div>
        {active && hovered !== null && (
          <div
            role="tooltip"
            className={`pointer-events-none absolute top-4 z-10 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-lg ${
              hovered > days.length / 2 ? "-translate-x-full" : ""
            }`}
            style={{
              left: `${((hovered + (hovered > days.length / 2 ? 0 : 1)) / days.length) * 100}%`,
            }}
          >
            {signupsText(active.count)} on {formatDate(active.date)}
          </div>
        )}
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>{first && formatDate(first.date)}</span>
          <span>{last && formatDate(last.date)}</span>
        </div>
      </div>

      <details className="text-xs text-muted">
        <summary className="cursor-pointer underline-offset-4 hover:text-foreground hover:underline">
          Show as a table
        </summary>
        <table className="mt-2 text-sm text-foreground">
          <thead>
            <tr className="text-left text-muted">
              <th className="pr-6 font-medium">Day</th>
              <th className="font-medium">Sign-ups</th>
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((day) => (
              <tr key={day.date}>
                <td className="pr-6">{formatDate(day.date)}</td>
                <td className="tabular-nums">{day.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
