import { describe, expect, it } from "vitest";
import { seedContributions } from "./testing/contributions.ts";
import { createTestApi, useTestDatabase } from "./testing/setup.ts";

const database = useTestDatabase();
const setup = () => createTestApi(database());

describe("GET /v1/me/stats", () => {
  it("summarizes a year of Open Source Contributions", async () => {
    const { app, signUp } = await setup();
    const { user, cookie } = await signUp("ada");
    await seedContributions(database().db, user.id);

    const response = await app.inject({
      method: "GET",
      url: "/v1/me/stats?year=2026",
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      period: { from: "2026-01-01", to: "2026-12-31", year: 2026 },
      total: 6,
      days: [
        { date: "2026-03-03", count: 3 },
        { date: "2026-03-04", count: 3 },
      ],
      byKind: { commit: 5, issue: 0, pull_request: 1, review: 0, discussion: 0 },
      byRepo: [
        { fullName: "acme/lib", url: "https://github.com/acme/lib", license: "MIT", count: 6 },
      ],
      mergedPullRequests: [
        {
          title: "Fix",
          url: "https://x/pr/1",
          repo: { fullName: "acme/lib", url: "https://github.com/acme/lib", license: "MIT" },
          mergedAt: "2026-03-06T10:00:00.000Z",
        },
      ],
      streaks: {
        period: "week",
        week: { current: 0, longest: 1, currentStart: null, lastCountedPeriod: "2026-03-01" },
        day: { current: 0, longest: 2, currentStart: null, lastCountedPeriod: "2026-03-04" },
      },
      years: [2026, 2025],
      lastSyncedAt: "2026-10-15T01:00:00.000Z",
    });

    // Nothing that year.
    const empty = await app.inject({
      method: "GET",
      url: "/v1/me/stats?year=2025",
      headers: { cookie },
    });
    expect(empty.json()).toMatchObject({ total: 0, days: [], byRepo: [], mergedPullRequests: [] });
  });

  it("lets users choose their streak period", async () => {
    const { app, signUp } = await setup();
    const { cookie } = await signUp("ada");
    const patch = await app.inject({
      method: "PATCH",
      url: "/v1/me",
      headers: { cookie },
      payload: { streakPeriod: "day" },
    });
    expect(patch.json()).toMatchObject({ streakPeriod: "day" });
    const stats = await app.inject({ method: "GET", url: "/v1/me/stats", headers: { cookie } });
    expect(stats.json().streaks.period).toBe("day");
    expect(stats.json().period.year).toBeNull();
  });
});
