import { eq } from "@osg/core/db/query";
import { contributionSyncs } from "@osg/core/db/schema";
import { describe, expect, it } from "vitest";
import { SYNC_COOLDOWN_MS } from "./routes/contributions.ts";
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
