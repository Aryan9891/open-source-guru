import { eq } from "@osg/core/db/query";
import { deliveries, emailSuppressions, subscriptions } from "@osg/core/db/schema";
import { PermanentEmailError } from "@osg/core/mail";
import { verifyEmailToken } from "@osg/core/tokens";
import { describe, expect, it } from "vitest";
import {
  createWorkerTest,
  produceMatchingEvent,
  SECRET,
  useTestDatabase,
} from "../testing/setup.ts";
import { INSTANT_BATCH_WINDOW_MS, sendDueNotifications } from "./send-notifications.ts";

const database = useTestDatabase();
const setup = (options?: Parameters<typeof createWorkerTest>[1]) =>
  createWorkerTest(database(), options);

describe("fanout and instant emails", () => {
  it("emails matching issues once the batch window has passed", async () => {
    const context = await setup();
    await produceMatchingEvent(context);
    const { ctx, mailer, advance, channel, subscription } = context;

    // Only #7 matches "help wanted".
    expect(await database().db.select().from(deliveries)).toHaveLength(1);

    expect(await sendDueNotifications(ctx, "instant")).toEqual({ emails: 0, failed: 0 });
    advance(INSTANT_BATCH_WINDOW_MS);
    expect(await sendDueNotifications(ctx, "instant")).toEqual({ emails: 1, failed: 0 });

    const [email] = mailer.sent;
    expect(email?.to).toBe("ada@example.com");
    expect(email?.subject).toBe("acme/repo#7: Improve docs");
    expect(email?.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    const unsubscribeUrl = email?.headers?.["List-Unsubscribe"]?.slice(1, -1) ?? "";
    const token = new URL(unsubscribeUrl).searchParams.get("token") ?? "";
    expect(verifyEmailToken(token, SECRET)).toEqual({
      purpose: "unsubscribe",
      channelId: channel.id,
    });
    expect(email?.html).toContain(encodeURIComponent(token).slice(0, 20));
    expect(email?.html).not.toContain("issues/8");

    const [delivery] = await database().db.select().from(deliveries);
    expect(delivery).toMatchObject({
      status: "sent",
      subscriptionId: subscription.id,
      attempts: 1,
    });

    // Nothing is sent twice.
    advance(INSTANT_BATCH_WINDOW_MS);
    expect(await sendDueNotifications(ctx, "instant")).toEqual({ emails: 0, failed: 0 });
  });

  it("doesn't replay events detected before the subscription existed", async () => {
    const context = await setup();
    await database()
      .db.update(subscriptions)
      .set({ createdAt: new Date("2026-10-15T00:00:00Z") })
      .where(eq(subscriptions.id, context.subscription.id));

    await produceMatchingEvent(context);

    expect(await database().db.select().from(deliveries)).toEqual([]);
  });

  it("skips deliveries of paused subscriptions", async () => {
    const context = await setup();
    await produceMatchingEvent(context);
    await database()
      .db.update(subscriptions)
      .set({ status: "paused" })
      .where(eq(subscriptions.id, context.subscription.id));

    context.advance(INSTANT_BATCH_WINDOW_MS);
    await sendDueNotifications(context.ctx, "instant");

    expect(context.mailer.sent).toEqual([]);
    expect((await database().db.select().from(deliveries))[0]?.status).toBe("skipped");
  });

  it("disables the channel and suppresses the address on a permanent rejection", async () => {
    const context = await setup();
    await produceMatchingEvent(context);
    context.ctx.mailer.send = async () => {
      throw new PermanentEmailError("550 mailbox unavailable");
    };

    context.advance(INSTANT_BATCH_WINDOW_MS);
    expect(await sendDueNotifications(context.ctx, "instant")).toEqual({ emails: 0, failed: 1 });

    const channel = await database().db.query.notificationChannels.findFirst();
    expect(channel).toMatchObject({ status: "disabled", disabledReason: "bounced" });
    expect(await database().db.select().from(emailSuppressions)).toMatchObject([
      { address: "ada@example.com", reason: "bounce" },
    ]);
  });

  it("retries temporary failures later", async () => {
    const context = await setup();
    await produceMatchingEvent(context);
    const send = context.ctx.mailer.send;
    context.ctx.mailer.send = async () => {
      throw new Error("connection timed out");
    };

    context.advance(INSTANT_BATCH_WINDOW_MS);
    expect(await sendDueNotifications(context.ctx, "instant")).toEqual({ emails: 0, failed: 1 });
    expect((await database().db.select().from(deliveries))[0]).toMatchObject({
      status: "pending",
      attempts: 1,
      lastError: "connection timed out",
    });

    context.ctx.mailer.send = send;
    expect(await sendDueNotifications(context.ctx, "instant")).toEqual({ emails: 0, failed: 0 });
    context.advance(60 * 1000);
    expect(await sendDueNotifications(context.ctx, "instant")).toEqual({ emails: 1, failed: 0 });
  });
});

describe("digests", () => {
  it("sends daily digests during the user's chosen local hour", async () => {
    // 10:00 UTC is 12:00 in Paris; the user wants their digest at 13:00.
    const context = await setup({ frequency: "daily", timezone: "Europe/Paris", digestHour: 13 });
    await produceMatchingEvent(context);

    expect(await sendDueNotifications(context.ctx, "daily")).toEqual({ emails: 0, failed: 0 });

    context.advance(60 * 60 * 1000);
    expect(await sendDueNotifications(context.ctx, "daily")).toEqual({ emails: 1, failed: 0 });
    expect(context.mailer.sent[0]?.subject).toBe("Daily digest: acme/repo#7: Improve docs");
  });

  it("sends hourly digests whenever deliveries are pending", async () => {
    const context = await setup({ frequency: "hourly" });
    await produceMatchingEvent(context);

    expect(await sendDueNotifications(context.ctx, "instant")).toEqual({ emails: 0, failed: 0 });
    expect(await sendDueNotifications(context.ctx, "hourly")).toEqual({ emails: 1, failed: 0 });
  });
});
