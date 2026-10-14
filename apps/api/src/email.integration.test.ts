import { eq } from "@osg/core/db/query";
import { emailSuppressions, notificationChannels, subscriptionChannels } from "@osg/core/db/schema";
import { describe, expect, it } from "vitest";
import { createTestApi, useTestDatabase } from "./testing/setup.ts";

const database = useTestDatabase();
const setup = () => createTestApi(database());

describe("email channels", () => {
  it("verifies added addresses with a signed link", async () => {
    const { app, mailer, signUp } = await setup();
    const { cookie } = await signUp();
    mailer.sent.length = 0;

    const created = await app.inject({
      method: "POST",
      url: "/v1/me/channels",
      headers: { cookie },
      payload: { address: "work@example.com", label: "Work" },
    });
    expect(created.json()).toMatchObject({ address: "work@example.com", status: "pending" });

    const [email] = mailer.sent;
    expect(email?.to).toBe("work@example.com");
    const link = email?.html.match(
      /href="(http:\/\/localhost:3000\/api\/v1\/public\/email\/verify\?token=[^"]+)"/,
    )?.[1];
    expect(link).toBeDefined();

    // The web app forwards /api/* to the API without the prefix.
    const url = new URL(link?.replaceAll("&amp;", "&") ?? "");
    const verified = await app.inject({
      method: "GET",
      url: `${url.pathname.replace(/^\/api/, "")}${url.search}`,
    });
    expect(verified.statusCode).toBe(200);
    expect(verified.body).toContain("Email address confirmed");

    const channels = await app.inject({
      method: "GET",
      url: "/v1/me/channels",
      headers: { cookie },
    });
    expect(channels.json().find((c: { label: string }) => c.label === "Work").status).toBe(
      "active",
    );

    const tampered = await app.inject({
      method: "GET",
      url: `/v1/public/email/verify?token=${url.searchParams.get("token")}x`,
    });
    expect(tampered.statusCode).toBe(400);
  });

  it("refuses duplicate addresses", async () => {
    const { app, signUp } = await setup();
    const { cookie } = await signUp("ada");
    const duplicate = await app.inject({
      method: "POST",
      url: "/v1/me/channels",
      headers: { cookie },
      payload: { address: "ADA@example.com" },
    });
    expect(duplicate.statusCode).toBe(409);
  });
});

describe("unsubscribing from emails", () => {
  it("one-click unsubscribe (RFC 8058) stops every email to the address", async () => {
    const { app, ctx, signUpAndSubscribe } = await setup();
    const { channelId } = await signUpAndSubscribe();
    const url = new URL(ctx.links.unsubscribe(channelId));

    const response = await app.inject({
      method: "POST",
      url: `/v1/public/email/unsubscribe${url.search}`,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "List-Unsubscribe=One-Click",
    });

    const { db } = database();
    expect(response.statusCode).toBe(200);
    const channel = await db.query.notificationChannels.findFirst({
      where: eq(notificationChannels.id, channelId),
    });
    expect(channel).toMatchObject({ status: "disabled", disabledReason: "unsubscribed" });
    expect(await db.select().from(subscriptionChannels)).toEqual([]);
    expect(await db.select().from(emailSuppressions)).toMatchObject([
      { address: "ada@example.com", reason: "unsubscribed" },
    ]);
  });

  it("the confirmation page changes nothing; its form unsubscribes from one repository", async () => {
    const { app, ctx, signUpAndSubscribe } = await setup();
    const { channelId, subscription } = await signUpAndSubscribe();
    const url = new URL(ctx.links.unsubscribe(channelId, [subscription.id]));
    const path = `/v1/public/email/unsubscribe${url.search}`;
    const { db } = database();

    const confirm = await app.inject({ method: "GET", url: path });
    expect(confirm.body).toContain("notifications for this repository");
    expect(await db.select().from(subscriptionChannels)).toHaveLength(1);

    const done = await app.inject({ method: "POST", url: path });
    expect(done.body).toContain("won't receive notifications for this repository");
    expect(await db.select().from(subscriptionChannels)).toEqual([]);
    const channel = await db.query.notificationChannels.findFirst();
    expect(channel?.status).toBe("active");
  });
});
