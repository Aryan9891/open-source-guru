import { eq } from "@osg/core/db/query";
import {
  apikeys,
  notificationChannels,
  repositories,
  subscriptions,
  users,
} from "@osg/core/db/schema";
import { describe, expect, it } from "vitest";
import { createTestApi, useTestDatabase } from "./testing/setup.ts";

const database = useTestDatabase();
const setup = () => createTestApi(database());

describe("health and authentication", () => {
  it("reports health", async () => {
    const { app } = await setup();
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.json()).toEqual({ status: "ok", database: "ok" });
  });

  it("rejects anonymous requests", async () => {
    const { app } = await setup();
    const response = await app.inject({ method: "GET", url: "/v1/me" });
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe("unauthorized");
  });

  it("sets up new users: active primary email channel and a welcome email", async () => {
    const { app, mailer, signUp } = await setup();
    const { cookie } = await signUp("ada");

    const me = await app.inject({ method: "GET", url: "/v1/me", headers: { cookie } });
    expect(me.json()).toMatchObject({ login: "ada", timezone: "UTC", digestHour: 8 });

    const channels = await app.inject({
      method: "GET",
      url: "/v1/me/channels",
      headers: { cookie },
    });
    expect(channels.json()).toMatchObject([
      { type: "email", address: "ada@example.com", status: "active", label: "Primary email" },
    ]);
    expect(mailer.sent.map((email) => [email.to, email.subject])).toEqual([
      ["ada@example.com", "Welcome to Open Source Guru"],
    ]);
  });

  it("updates settings and validates time zones", async () => {
    const { app, signUp } = await setup();
    const { cookie } = await signUp();

    const ok = await app.inject({
      method: "PATCH",
      url: "/v1/me",
      headers: { cookie },
      payload: { timezone: "Europe/Paris", digestHour: 18 },
    });
    expect(ok.json()).toMatchObject({ timezone: "Europe/Paris", digestHour: 18 });

    const bad = await app.inject({
      method: "PATCH",
      url: "/v1/me",
      headers: { cookie },
      payload: { timezone: "Mars/Olympus_Mons" },
    });
    expect(bad.statusCode).toBe(400);
  });
});

describe("personal API keys", () => {
  it("are created with a session, act as the user, and can be revoked", async () => {
    const { app, signUp } = await setup();
    const { cookie } = await signUp("ada");

    const created = await app.inject({
      method: "POST",
      url: "/v1/me/api-keys",
      headers: { cookie },
      payload: { name: "My script" },
    });
    expect(created.statusCode).toBe(201);
    const { key, id } = created.json();
    expect(key).toMatch(/^osg_/);
    const bearer = { authorization: `Bearer ${key}` };

    // Usable many times (no per-key daily limit).
    for (let i = 0; i < 12; i++) {
      const me = await app.inject({ method: "GET", url: "/v1/me", headers: bearer });
      expect(me.statusCode).toBe(200);
    }

    // A key can't manage keys or delete the account.
    const forbidden = await app.inject({ method: "GET", url: "/v1/me/api-keys", headers: bearer });
    expect(forbidden.statusCode).toBe(403);
    const noDelete = await app.inject({ method: "DELETE", url: "/v1/me", headers: bearer });
    expect(noDelete.statusCode).toBe(403);

    const listed = await app.inject({ method: "GET", url: "/v1/me/api-keys", headers: { cookie } });
    expect(listed.json()).toMatchObject([{ id, name: "My script" }]);
    expect(listed.json()[0]).not.toHaveProperty("key");

    await app.inject({ method: "DELETE", url: `/v1/me/api-keys/${id}`, headers: { cookie } });
    const revoked = await app.inject({ method: "GET", url: "/v1/me", headers: bearer });
    expect(revoked.statusCode).toBe(401);
  });

  it("rejects unknown keys", async () => {
    const { app } = await setup();
    const response = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: { authorization: "Bearer osg_notarealkey" },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("account deletion", () => {
  it("removes the user and everything personal", async () => {
    const { app, signUpAndSubscribe } = await setup();
    const { cookie, user } = await signUpAndSubscribe();
    await app.inject({
      method: "POST",
      url: "/v1/me/api-keys",
      headers: { cookie },
      payload: { name: "k" },
    });

    const response = await app.inject({ method: "DELETE", url: "/v1/me", headers: { cookie } });

    const { db } = database();
    expect(response.statusCode).toBe(204);
    expect(await db.select().from(users).where(eq(users.id, user.id))).toEqual([]);
    expect(await db.select().from(subscriptions)).toEqual([]);
    expect(await db.select().from(notificationChannels)).toEqual([]);
    expect(await db.select().from(apikeys)).toEqual([]);
    // Shared GitHub data stays.
    expect(await db.select().from(repositories)).toHaveLength(1);
  });
});
