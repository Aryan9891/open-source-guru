import { describe, expect, it } from "vitest";
import { resolvePeriod } from "./period.ts";

describe("resolvePeriod", () => {
  it("covers a calendar year", () => {
    expect(resolvePeriod(2024, "2026-10-15")).toEqual({
      from: "2024-01-01",
      to: "2024-12-31",
      year: 2024,
    });
  });

  it("defaults to the last 12 months, starting on a Sunday like GitHub's graph", () => {
    // 2026-10-15 is a Thursday; 364 days earlier is Thursday 2025-10-16, whose week starts on
    // Sunday 2025-10-12.
    expect(resolvePeriod(undefined, "2026-10-15")).toEqual({
      from: "2025-10-12",
      to: "2026-10-15",
      year: null,
    });
  });
});
