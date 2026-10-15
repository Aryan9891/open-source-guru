import { describe, expect, it } from "vitest";
import { addDays, dateInTimeZone, daysBetween, weekStart } from "./dates.ts";

describe("dates", () => {
  it("gives the calendar date of an instant in a time zone", () => {
    const instant = new Date("2026-10-14T23:30:00Z");
    expect(dateInTimeZone(instant, "UTC")).toBe("2026-10-14");
    expect(dateInTimeZone(instant, "Europe/Paris")).toBe("2026-10-15");
    expect(dateInTimeZone(instant, "America/Los_Angeles")).toBe("2026-10-14");
  });

  it("adds days across months, years and daylight saving changes", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    // Clocks change on 2026-03-29 in Europe; date arithmetic doesn't care.
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-10-01", "2026-10-15")).toBe(14);
    expect(daysBetween("2026-10-15", "2026-10-01")).toBe(-14);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("starts weeks on Sunday, like GitHub's graph", () => {
    // 2026-10-11 is a Sunday.
    expect(weekStart("2026-10-11")).toBe("2026-10-11");
    expect(weekStart("2026-10-14")).toBe("2026-10-11");
    expect(weekStart("2026-10-17")).toBe("2026-10-11");
    expect(weekStart("2026-10-18")).toBe("2026-10-18");
    // Across a year boundary: 2026-12-27 is a Sunday.
    expect(weekStart("2027-01-01")).toBe("2026-12-27");
  });
});
