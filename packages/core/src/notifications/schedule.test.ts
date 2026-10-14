import { describe, expect, it } from "vitest";
import { isDailyDigestDue, isValidTimezone, localHour } from "./schedule.ts";

describe("schedule helpers", () => {
  it("validates IANA time zones", () => {
    expect(isValidTimezone("Europe/Paris")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Mars/Olympus_Mons")).toBe(false);
  });

  it("computes the local hour, including daylight saving time", () => {
    // 2026-07-01 06:30 UTC is 08:30 in Paris (CEST, UTC+2)
    expect(localHour("Europe/Paris", new Date("2026-07-01T06:30:00Z"))).toBe(8);
    // 2026-12-01 06:30 UTC is 07:30 in Paris (CET, UTC+1)
    expect(localHour("Europe/Paris", new Date("2026-12-01T06:30:00Z"))).toBe(7);
    // Midnight is 0, not 24
    expect(localHour("UTC", new Date("2026-12-01T00:15:00Z"))).toBe(0);
  });

  it("says a daily digest is due during the user's chosen local hour", () => {
    const now = new Date("2026-07-01T06:05:00Z");
    expect(isDailyDigestDue("Europe/Paris", 8, now)).toBe(true);
    expect(isDailyDigestDue("UTC", 8, now)).toBe(false);
  });
});
