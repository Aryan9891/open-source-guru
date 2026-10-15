import { describe, expect, it } from "vitest";
import { computeStreak, currentStreakAsOf } from "./streaks.ts";

// 2026-10-15 is a Thursday; its week started on Sunday 2026-10-11.
const TODAY = "2026-10-15";

describe("daily streaks", () => {
  it("is empty without contributions", () => {
    expect(computeStreak([], "day", TODAY)).toEqual({
      currentLength: 0,
      longestLength: 0,
      currentStart: null,
      lastCountedPeriod: null,
    });
  });

  it("counts consecutive days up to today", () => {
    const streak = computeStreak(["2026-10-13", "2026-10-14", "2026-10-15"], "day", TODAY);
    expect(streak).toMatchObject({
      currentLength: 3,
      longestLength: 3,
      currentStart: "2026-10-13",
    });
  });

  it("isn't broken while today can still be saved", () => {
    const streak = computeStreak(["2026-10-13", "2026-10-14"], "day", TODAY);
    expect(streak).toMatchObject({ currentLength: 2, lastCountedPeriod: "2026-10-14" });
  });

  it("is broken after a day without contributions", () => {
    const streak = computeStreak(["2026-10-12", "2026-10-13"], "day", TODAY);
    expect(streak).toMatchObject({ currentLength: 0, longestLength: 2, currentStart: null });
  });

  it("keeps the longest streak, and ignores duplicates and future dates", () => {
    const days = [
      "2026-09-01",
      "2026-09-02",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-10-15",
      "2026-10-16",
    ];
    expect(computeStreak(days, "day", TODAY)).toMatchObject({
      currentLength: 1,
      longestLength: 4,
      lastCountedPeriod: "2026-10-15",
    });
  });

  it("doesn't depend on the order of the input", () => {
    const streak = computeStreak(["2026-10-15", "2026-10-13", "2026-10-14"], "day", TODAY);
    expect(streak.currentLength).toBe(3);
  });
});

describe("weekly streaks", () => {
  it("counts weeks with at least one contribution, Sunday to Saturday", () => {
    // Weeks of 2026-09-27, 2026-10-04 and 2026-10-11 (this week).
    const streak = computeStreak(["2026-09-27", "2026-10-10", "2026-10-11"], "week", TODAY);
    expect(streak).toMatchObject({
      currentLength: 3,
      longestLength: 3,
      currentStart: "2026-09-27",
      lastCountedPeriod: "2026-10-11",
    });
  });

  it("isn't broken while this week can still be saved", () => {
    // Last contribution on Saturday 2026-10-10, nothing yet this week.
    const streak = computeStreak(["2026-10-03", "2026-10-10"], "week", TODAY);
    expect(streak).toMatchObject({ currentLength: 2, lastCountedPeriod: "2026-10-04" });
  });

  it("is broken after a whole week without contributions", () => {
    const streak = computeStreak(["2026-09-27", "2026-10-03"], "week", TODAY);
    expect(streak).toMatchObject({ currentLength: 0, longestLength: 1 });
  });

  it("continues across a year boundary", () => {
    // Weeks of 2026-12-20 and 2026-12-27 (which includes 2027-01-01).
    const streak = computeStreak(["2026-12-21", "2027-01-01"], "week", "2027-01-02");
    expect(streak).toMatchObject({ currentLength: 2, currentStart: "2026-12-20" });
  });
});

describe("currentStreakAsOf", () => {
  const stored = computeStreak(["2026-10-13", "2026-10-14"], "day", "2026-10-14");

  it("keeps a streak that can still go on", () => {
    expect(currentStreakAsOf(stored, "day", "2026-10-15")).toEqual(stored);
  });

  it("ends a streak whose last day is over, keeping the longest", () => {
    expect(currentStreakAsOf(stored, "day", "2026-10-16")).toEqual({
      ...stored,
      currentLength: 0,
      currentStart: null,
    });
  });

  it("works for weekly streaks", () => {
    const weekly = computeStreak(["2026-10-01"], "week", "2026-10-01");
    expect(currentStreakAsOf(weekly, "week", "2026-10-10").currentLength).toBe(1);
    expect(currentStreakAsOf(weekly, "week", "2026-10-11").currentLength).toBe(0);
  });
});
