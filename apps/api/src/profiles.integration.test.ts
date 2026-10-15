import { describe, expect, it } from "vitest";
import { seedContributions } from "./testing/contributions.ts";
import { createTestApi, useTestDatabase } from "./testing/setup.ts";

const database = useTestDatabase();

describe("public profiles", () => {
  it("shows Open Source Contributions and public goals, nothing private", async () => {
    const { app, signUp } = await createTestApi(database());
    const { user, cookie } = await signUp("ada");
    await seedContributions(database().db, user.id);
    const goal = (isPublic: boolean) =>
      app.inject({
        method: "POST",
        url: "/v1/me/goals",
        headers: { cookie },
        payload: {
          metric: "contributions",
          target: 5,
          recurrence: "none",
          startsOn: "2026-03-01",
          endsOn: "2026-03-31",
          isPublic,
        },
      });
    await goal(true);
    await goal(false);

    // Anyone can see it, whatever the login's case.
    const response = await app.inject({ method: "GET", url: "/v1/public/profiles/ADA?year=2026" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const profile = response.json();
    expect(profile).toMatchObject({
      login: "ada",
      githubUrl: "https://github.com/ada",
      stats: { total: 6, byRepo: [{ fullName: "acme/lib", count: 6 }] },
      goals: [{ target: 5, current: { progress: 6 } }],
    });
    expect(profile.goals).toHaveLength(1);
    expect(JSON.stringify(profile)).not.toContain("ada@example.com");
    expect(profile).not.toHaveProperty("excluded");
  });

  it("is gone as soon as the profile is turned off", async () => {
    const { app, signUp } = await createTestApi(database());
    const { cookie } = await signUp("ada");
    const profile = () => app.inject({ method: "GET", url: "/v1/public/profiles/ada" });
    expect((await profile()).statusCode).toBe(200);

    const me = await app.inject({
      method: "PATCH",
      url: "/v1/me",
      headers: { cookie },
      payload: { profilePublic: false },
    });
    expect(me.json()).toMatchObject({ profilePublic: false });
    expect((await profile()).statusCode).toBe(404);
    expect(
      (await app.inject({ method: "GET", url: "/v1/public/profiles/nobody" })).statusCode,
    ).toBe(404);
  });
});
