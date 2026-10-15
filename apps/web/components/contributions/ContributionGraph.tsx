"use client";

import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  contributionsText,
  formatDate,
  formatMonth,
  level,
  type Stats,
  weekStart,
} from "@/lib/contributions";

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;
/** Room for the day names (left) and month names (top). */
const LEFT = 30;
const TOP = 18;

/** Empty, then the violet ramp (`--osg-graph-*` in globals.css). */
const LEVEL_CLASSES = [
  "fill-graph-0",
  "fill-graph-1",
  "fill-graph-2",
  "fill-graph-3",
  "fill-graph-4",
];
const LEGEND_CLASSES = ["bg-graph-0", "bg-graph-1", "bg-graph-2", "bg-graph-3", "bg-graph-4"];
const DAY_LABELS = [
  [1, "Mon"],
  [3, "Wed"],
  [5, "Fri"],
] as const;

interface Hovered {
  date: string;
  count: number;
  /** The cell's position in the graph's frame (outside the scroll area, so never clipped). */
  x: number;
  y: number;
  /** Whether the tooltip opens to the left of the cell, near the right edge. */
  flip: boolean;
}

/** Days of the period by week (Sunday first); null outside the period. */
function buildWeeks(from: string, to: string): (string | null)[][] {
  const weeks: (string | null)[][] = [];
  for (let start = weekStart(from); start <= to; start = addDays(start, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, day) => {
        const date = addDays(start, day);
        return date >= from && date <= to ? date : null;
      }),
    );
  }
  return weeks;
}

/** Month names above the week holding each month's first day, unless too close to the last. */
function monthLabels(weeks: (string | null)[][]) {
  const labels: { week: number; label: string }[] = [];
  weeks.forEach((week, index) => {
    const first =
      week.find((date) => date?.endsWith("-01")) ?? (index === 0 ? week.find(Boolean) : null);
    if (!first) return;
    const previous = labels.at(-1);
    if (previous && index - previous.week < 3) return;
    labels.push({ week: index, label: formatMonth(first) });
  });
  return labels;
}

/** GitHub-style graph of daily Open Source Contributions, with a tooltip per day. */
export function ContributionGraph({ stats }: { stats: Stats }) {
  const { period, days } = stats;
  const scroller = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<Hovered | null>(null);

  const counts = useMemo(() => new Map(days.map((day) => [day.date, day.count])), [days]);
  const max = Math.max(0, ...days.map((day) => day.count));
  const weeks = useMemo(() => buildWeeks(period.from, period.to), [period.from, period.to]);
  const months = useMemo(() => monthLabels(weeks), [weeks]);

  // On narrow screens, start scrolled to the most recent weeks.
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, []);

  const width = LEFT + weeks.length * STEP;
  const height = TOP + 7 * STEP;

  // The whole cell, gap included, is the hover target: bigger than the mark.
  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const week = Math.floor((event.clientX - box.left - LEFT) / STEP);
    const day = Math.floor((event.clientY - box.top - TOP) / STEP);
    const date = weeks[week]?.[day];
    const frame = scroller.current;
    if (!date || !frame) return setHovered(null);
    const x = LEFT + week * STEP - frame.scrollLeft;
    setHovered({
      date,
      count: counts.get(date) ?? 0,
      x,
      y: TOP + day * STEP,
      flip: x > frame.clientWidth / 2,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <div ref={scroller} className="overflow-x-auto pb-1">
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`Daily Open Source Contributions from ${formatDate(period.from)} to ${formatDate(period.to)}. "Show as a table" lists them.`}
            className="block"
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHovered(null)}
          >
            {months.map(({ week, label }) => (
              <text key={week} x={LEFT + week * STEP} y={11} className="fill-muted text-[11px]">
                {label}
              </text>
            ))}
            {DAY_LABELS.map(([day, label]) => (
              <text key={label} x={0} y={TOP + day * STEP + 9} className="fill-muted text-[11px]">
                {label}
              </text>
            ))}
            {weeks.map((week, weekIndex) =>
              week.map((date, day) =>
                date ? (
                  <rect
                    key={date}
                    x={LEFT + weekIndex * STEP}
                    y={TOP + day * STEP}
                    width={CELL}
                    height={CELL}
                    rx={2}
                    strokeWidth={1.5}
                    className={`${LEVEL_CLASSES[level(counts.get(date) ?? 0, max)]} ${
                      hovered?.date === date ? "stroke-foreground" : ""
                    }`}
                  />
                ) : null,
              ),
            )}
          </svg>
        </div>
        {hovered && (
          <div
            role="tooltip"
            className={`pointer-events-none absolute z-10 -translate-y-full whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-lg ${
              hovered.flip ? "-translate-x-full" : ""
            }`}
            style={{
              left: hovered.flip ? hovered.x + CELL : hovered.x,
              top: hovered.y - 6,
            }}
          >
            {contributionsText(hovered.count)} on {formatDate(hovered.date)}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 text-xs text-muted">
        <details>
          <summary className="cursor-pointer underline-offset-4 hover:text-foreground hover:underline">
            Show as a table
          </summary>
          <DaysTable days={days} />
        </details>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span>Less</span>
          {LEGEND_CLASSES.map((className) => (
            <span key={className} className={`size-[11px] rounded-[2px] ${className}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

function DaysTable({ days }: { days: Stats["days"] }) {
  if (days.length === 0) return <p className="mt-2">No contributions in this period.</p>;
  return (
    <table className="mt-2 text-sm text-foreground">
      <thead>
        <tr className="text-left text-muted">
          <th className="pr-6 font-medium">Day</th>
          <th className="font-medium">Open Source Contributions</th>
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
  );
}
