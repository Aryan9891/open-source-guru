import { eq } from "@osg/core/db/query";
import { users } from "@osg/core/db/schema";
import { describe, expect, it } from "vitest";
import { createTestApi, useTestDatabase } from "./testing/setup.ts";

const database = useTestDatabase();

describe("opt-in emails", () => {
  it("are off by default, can be turned on, and turned off from an email link", async () => {
    const { app, ctx, signUp } = await createTestApi(database());
    const { user, cookie } = await signUp("ada");
    const me = await app.inject({ method: "GET", url: "/v1/me", headers: { cookie } });
    expect(me.json()).toMatchObject({ streakReminders: false, goalEmails: false });

    await app.inject({
      method: "PATCH",
      url: "/v1/me",
      headers: { cookie },
      payload: { streakReminders: true, goalEmails: true },
    });
    const settings = () => database().db.query.users.findFirst({ where: eq(users.id, user.id) });

    // Opening the link changes nothing.
    const path = new URL(ctx.links.stopEmails(user.id, "streakReminders")).pathname;
    const query = new URL(ctx.links.stopEmails(user.id, "streakReminders")).search;
    const url = `${path.replace(/^\/api/, "")}${query}`;
    const page = await app.inject({ method: "GET", url });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("Stop streak reminders?");
    expect(await settings()).toMatchObject({ streakReminders: true });

    const stopped = await app.inject({ method: "POST", url });
    expect(stopped.body).toContain("You won't receive streak reminders anymore.");
    expect(await settings()).toMatchObject({ streakReminders: false, goalEmails: true });

    // One-click unsubscribe from the email client.
    const goals = new URL(ctx.links.stopEmails(user.id, "goalEmails"));
    const oneClick = await app.inject({
      method: "POST",
      url: `${goals.pathname.replace(/^\/api/, "")}${goals.search}`,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "List-Unsubscribe=One-Click",
    });
    expect(oneClick.body).toBe("Unsubscribed");
    expect(await settings()).toMatchObject({ goalEmails: false });

    const invalid = await app.inject({
      method: "GET",
      url: "/v1/public/email/preferences?token=not-a-real-token",
    });
    expect(invalid.statusCode).toBe(400);
  });
});
