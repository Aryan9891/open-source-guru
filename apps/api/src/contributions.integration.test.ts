import { eq } from "@osg/core/db/query";
import { contributionSyncs } from "@osg/core/db/schema";
import { describe, expect, it } from "vitest";
import { SYNC_COOLDOWN_MS } from "./routes/contributions.ts";
import { seedContributions } from "./testing/contributions.ts";
import { createTestApi, useTestDatabase } from "./testing/setup.ts";

const database = useTestDatabase();
const setup = () => createTestApi(database());

describe("POST /v1/me/sync", () => {
  it("asks the worker for a refresh, at most every 15 minutes", async () => {
    const { app, signUp } = await setup();
    const { user, cookie } = await signUp("ada");
    const sync = () => app.inject({ method: "POST", url: "/v1/me/sync", headers: { cookie } });
    const row = () =>
      database().db.query.contributionSyncs.findFirst({
        where: eq(contributionSyncs.userId, user.id),
      });

    const first = await sync();
    expect(first.statusCode).toBe(202);
    expect(first.json()).toEqual({ requested: true, lastSyncedAt: null });
    expect(await row()).toMatchObject({ year: new Date().getUTCFullYear(), status: "pending" });

    // Already on its way.
    expect((await sync()).json()).toMatchObject({ requested: false });

    // Synced a moment ago: nothing to do.
    const justNow = new Date();
    await database()
      .db.update(contributionSyncs)
      .set({ status: "done", lastSyncedAt: justNow })
      .where(eq(contributionSyncs.userId, user.id));
    expect((await sync()).json()).toEqual({
      requested: false,
      lastSyncedAt: justNow.toISOString(),
    });

    // Long enough ago: requested again.
    await database()
      .db.update(contributionSyncs)
      .set({ lastSyncedAt: new Date(Date.now() - SYNC_COOLDOWN_MS - 1000) })
      .where(eq(contributionSyncs.userId, user.id));
    expect((await sync()).json()).toMatchObject({ requested: true });
    expect(await row()).toMatchObject({ status: "pending" });
  });
});

describe("GET /v1/me/contributions", () => {
  it("lists counted contributions newest first, with filters and pages", async () => {
    const { app, signUp } = await setup();
    const { user, cookie } = await signUp("ada");
    await seedContributions(database().db, user.id);
    const list = (query: string) =>
      app.inject({
        method: "GET",
        url: `/v1/me/contributions?year=2026&${query}`,
        headers: { cookie },
      });

    const all = (await list("")).json();
    expect(all.items.map((item: { kind: string; date: string }) => [item.kind, item.date])).toEqual(
      [
        ["pull_request", "2026-03-04"],
        ["commit", "2026-03-04"],
        ["commit", "2026-03-03"],
      ],
    );
    expect(all.items[0]).toMatchObject({
      title: "Fix",
      pullRequest: { state: "merged", mergedAt: "2026-03-06T10:00:00.000Z" },
    });
    expect(all.nextCursor).toBeNull();

    expect((await list("kind=commit")).json().items).toHaveLength(2);
    expect((await list("repo=ACME/LIB")).json().items).toHaveLength(3);
    expect((await list("repo=acme/app")).json().items).toHaveLength(0);

    const first = (await list("limit=2")).json();
    expect(first.items).toHaveLength(2);
    const second = (await list(`limit=2&cursor=${first.nextCursor}`)).json();
    expect(second.items.map((item: { date: string }) => item.date)).toEqual(["2026-03-03"]);
    expect(second.nextCursor).toBeNull();

    expect((await list("cursor=nonsense")).statusCode).toBe(400);
  });
});

describe("GET /v1/me/contributions/excluded", () => {
  it("explains what wasn't counted", async () => {
    const { app, signUp } = await setup();
    const { user, cookie } = await signUp("ada");
    await seedContributions(database().db, user.id);
    const excluded = (query: string) =>
      app.inject({
        method: "GET",
        url: `/v1/me/contributions/excluded${query}`,
        headers: { cookie },
      });

    expect((await excluded("?year=2026")).json()).toEqual({
      period: { from: "2026-01-01", to: "2026-12-31", year: 2026 },
      reasons: [
        { reason: "own_repo", count: 7 },
        { reason: "no_license", count: 1 },
      ],
      repos: [
        {
          fullName: "ada/dotfiles",
          url: "https://github.com/ada/dotfiles",
          license: "MIT",
          reason: "own_repo",
          count: 7,
        },
        {
          fullName: "acme/app",
          url: "https://github.com/acme/app",
          license: null,
          reason: "no_license",
          count: 1,
        },
      ],
      private: 12,
    });
    // Private contributions are only known per calendar year.
    expect((await excluded("")).json().private).toBeNull();
  });
});
