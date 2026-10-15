import { describe, expect, it } from "vitest";
import { MAX_GOALS_PER_USER } from "./routes/goals.ts";
import { seedContributions } from "./testing/contributions.ts";
import { createTestApi, useTestDatabase } from "./testing/setup.ts";

const database = useTestDatabase();

async function setup() {
  const api = await createTestApi(database());
  const { user, cookie } = await api.signUp("ada");
  await seedContributions(database().db, user.id);
  const request = (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: object) =>
    api.app.inject({ method, url, headers: { cookie }, ...(payload && { payload }) });
  return { request };
}

const march = { recurrence: "none", startsOn: "2026-03-01", endsOn: "2026-03-31" } as const;

describe("goals", () => {
  it("measures a one-off goal over its dates as soon as it's set", async () => {
    const { request } = await setup();

    const created = await request("POST", "/v1/me/goals", {
      metric: "contributions",
      target: 5,
      ...march,
    });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      metric: "contributions",
      target: 5,
      startsOn: "2026-03-01",
      endsOn: "2026-03-31",
      repoScope: "all",
      repo: null,
      isPublic: false,
      status: "active",
      periods: [{ start: "2026-03-01", end: "2026-03-31", progress: 6 }],
    });
    expect(created.json().periods[0].achievedAt).not.toBeNull();
  });

  it("counts merged pull requests and scopes to a repository", async () => {
    const { request } = await setup();
    const merged = await request("POST", "/v1/me/goals", {
      metric: "prs_merged",
      target: 3,
      ...march,
    });
    expect(merged.json().periods[0]).toMatchObject({ progress: 1, achievedAt: null });

    const inLib = await request("POST", "/v1/me/goals", {
      metric: "commits",
      target: 1,
      ...march,
      repoScope: "repo",
      repo: "acme/lib",
    });
    expect(inLib.json()).toMatchObject({
      repo: { fullName: "acme/lib" },
      periods: [{ progress: 5 }],
    });
    const inApp = await request("POST", "/v1/me/goals", {
      metric: "commits",
      target: 1,
      ...march,
      repoScope: "repo",
      repo: "acme/app",
    });
    expect(inApp.json().periods[0].progress).toBe(0);
  });

  it("aligns recurring goals to the current week or month", async () => {
    const { request } = await setup();
    const weekly = await request("POST", "/v1/me/goals", {
      metric: "reviews",
      target: 1,
      recurrence: "weekly",
    });
    expect(weekly.statusCode).toBe(201);
    const { startsOn, periods } = weekly.json();
    expect(new Date(`${startsOn}T00:00:00Z`).getUTCDay()).toBe(0);
    expect(periods).toEqual([
      { start: startsOn, end: expect.any(String), progress: 0, achievedAt: null },
    ]);
  });

  it("keeps a period achieved, and updates target, visibility and status", async () => {
    const { request } = await setup();
    const { id } = (
      await request("POST", "/v1/me/goals", { metric: "contributions", target: 50, ...march })
    ).json();

    const lowered = await request("PATCH", `/v1/me/goals/${id}`, { target: 5, isPublic: true });
    expect(lowered.json()).toMatchObject({ target: 5, isPublic: true });
    const achievedAt = lowered.json().periods[0].achievedAt;
    expect(achievedAt).not.toBeNull();

    const raised = await request("PATCH", `/v1/me/goals/${id}`, { target: 50, status: "archived" });
    expect(raised.json()).toMatchObject({ status: "archived" });
    expect(raised.json().periods[0].achievedAt).toBe(achievedAt);

    expect((await request("PATCH", `/v1/me/goals/${id}`, { metric: "reviews" })).statusCode).toBe(
      400,
    );
    expect((await request("DELETE", `/v1/me/goals/${id}`)).statusCode).toBe(204);
    expect((await request("GET", "/v1/me/goals")).json()).toEqual([]);
  });

  it("validates dates, scope and the limit", async () => {
    const { request } = await setup();
    const post = (body: object) =>
      request("POST", "/v1/me/goals", { metric: "contributions", target: 1, ...body });

    expect((await post({ recurrence: "none" })).statusCode).toBe(400);
    expect((await post({ recurrence: "weekly", endsOn: "2026-12-31" })).statusCode).toBe(400);
    expect((await post({ ...march, endsOn: "2026-02-01" })).json().error).toBe("invalid_dates");
    expect((await post({ ...march, repoScope: "repo" })).statusCode).toBe(400);

    for (let index = 0; index < MAX_GOALS_PER_USER; index++) {
      expect((await post({ recurrence: "monthly" })).statusCode).toBe(201);
    }
    expect((await post({ recurrence: "monthly" })).json().error).toBe("goal_limit");
  });
});
