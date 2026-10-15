import { describe, expect, it } from "vitest";
import {
  alignStart,
  describeGoal,
  describePeriod,
  GOAL_HISTORY,
  type GoalContribution,
  goalPeriods,
  measure,
} from "./goals.ts";

// 2026-10-15 is a Thursday.
const TODAY = "2026-10-15";

describe("goalPeriods", () => {
  it("covers a one-off goal's dates, once it has started", () => {
    const goal = { recurrence: "none", startsOn: "2026-10-01", endsOn: "2026-12-31" } as const;
    expect(goalPeriods(goal, TODAY)).toEqual([{ start: "2026-10-01", end: "2026-12-31" }]);
    expect(goalPeriods({ ...goal, startsOn: "2026-11-01" }, TODAY)).toEqual([]);
  });

  it("lists every week (Sunday to Saturday) since the start, the current one included", () => {
    const goal = { recurrence: "weekly", startsOn: "2026-10-01", endsOn: null } as const;
    expect(goalPeriods(goal, TODAY)).toEqual([
      { start: "2026-09-27", end: "2026-10-03" },
      { start: "2026-10-04", end: "2026-10-10" },
      { start: "2026-10-11", end: "2026-10-17" },
    ]);
  });

  it("lists months across a year boundary, keeping the most recent ones", () => {
    const goal = { recurrence: "monthly", startsOn: "2025-11-20", endsOn: null } as const;
    const periods = goalPeriods(goal, "2026-02-03");
    expect(periods.map((period) => [period.start, period.end])).toEqual([
      ["2025-11-01", "2025-11-30"],
      ["2025-12-01", "2025-12-31"],
      ["2026-01-01", "2026-01-31"],
      ["2026-02-01", "2026-02-28"],
    ]);
    expect(goalPeriods({ ...goal, startsOn: "2020-01-01" }, TODAY)).toHaveLength(GOAL_HISTORY);
  });

  it("aligns starts to the period", () => {
    expect(alignStart("weekly", TODAY)).toBe("2026-10-11");
    expect(alignStart("monthly", TODAY)).toBe("2026-10-01");
    expect(alignStart("none", TODAY)).toBe(TODAY);
  });
});

describe("measure", () => {
  const item = (overrides: Partial<GoalContribution>): GoalContribution => ({
    kind: "commit",
    date: "2026-10-12",
    count: 1,
    mergedOn: null,
    repoId: "repo",
    ...overrides,
  });
  const items = [
    item({ count: 3 }),
    item({ date: "2026-10-13", count: 2 }),
    item({ kind: "pull_request", date: "2026-09-30", mergedOn: "2026-10-12" }),
    item({ kind: "pull_request", date: "2026-10-13", mergedOn: null }),
    item({ kind: "review", date: "2026-10-13" }),
    item({ kind: "issue", date: "2026-10-01" }),
  ];
  const week = { start: "2026-10-11", end: "2026-10-17" };

  it("counts each metric over the period", () => {
    expect(measure("contributions", items, week)).toBe(7);
    expect(measure("active_days", items, week)).toBe(2);
    expect(measure("commits", items, week)).toBe(5);
    expect(measure("prs_opened", items, week)).toBe(1);
    expect(measure("reviews", items, week)).toBe(1);
    expect(measure("issues_opened", items, week)).toBe(0);
    expect(measure("discussions", items, week)).toBe(0);
  });

  it("counts merged pull requests by merge date", () => {
    expect(measure("prs_merged", items, week)).toBe(1);
    expect(measure("prs_merged", items, { start: "2026-09-27", end: "2026-10-03" })).toBe(0);
  });
});

describe("describeGoal", () => {
  const goal = {
    metric: "contributions",
    target: 30,
    recurrence: "monthly",
    endsOn: null,
    repoScope: "all",
    repoFullName: null,
  } as const;

  it("words goals and their periods", () => {
    expect(describeGoal(goal)).toBe("30 Open Source Contributions a month");
    expect(
      describeGoal({
        ...goal,
        metric: "prs_merged",
        target: 1,
        recurrence: "weekly",
        repoScope: "repo",
        repoFullName: "acme/lib",
      }),
    ).toBe("1 pull request merged a week in acme/lib");
    expect(describeGoal({ ...goal, recurrence: "none", endsOn: "2026-12-31" })).toBe(
      "30 Open Source Contributions by Dec 31, 2026",
    );
    expect(describePeriod("monthly", { start: "2026-10-01", end: "2026-10-31" })).toBe(
      "October 2026",
    );
    expect(describePeriod("weekly", { start: "2026-10-11", end: "2026-10-17" })).toBe(
      "the week of Oct 11, 2026",
    );
  });
});
