import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, lte, min, sql } from "@osg/core/db/query";
import {
  deliveries,
  emailSuppressions,
  events,
  type Frequency,
  notificationChannels,
  repositories,
  subscriptions,
  users,
} from "@osg/core/db/schema";
import { PermanentEmailError } from "@osg/core/mail";
import { groupDeliveriesByRepo } from "@osg/core/notifications/compose";
import { isDailyDigestDue } from "@osg/core/notifications/schedule";
import { renderNotificationEmail } from "@osg/emails";
import type { WorkerContext } from "../context.ts";

/** "Instant" emails wait this long so that several matches arrive in one email (PLAN.md §10). */
export const INSTANT_BATCH_WINDOW_MS = 5 * 60 * 1000;

/** Retry delays after a temporary failure; the delivery fails after the last one. */
export const RETRY_DELAYS_MS = [1, 5, 30, 120, 720].map((minutes) => minutes * 60 * 1000);

/** Most issues listed in one email; the rest go in the next one. */
const MAX_DELIVERIES_PER_EMAIL = 100;

export interface SendResult {
  emails: number;
  failed: number;
}

/**
 * Sends the emails that are due for a frequency:
 * - instant: channels whose oldest pending delivery is older than the batch window,
 * - hourly: every channel with pending hourly deliveries,
 * - daily: channels whose owner's local time matches their digest hour.
 */
export async function sendDueNotifications(
  ctx: WorkerContext,
  frequency: Frequency,
): Promise<SendResult> {
  const now = ctx.now();
  const candidates = await ctx.db
    .select({
      channelId: deliveries.channelId,
      oldest: min(deliveries.createdAt),
      timezone: users.timezone,
      digestHour: users.digestHour,
    })
    .from(deliveries)
    .innerJoin(notificationChannels, eq(notificationChannels.id, deliveries.channelId))
    .innerJoin(users, eq(users.id, notificationChannels.userId))
    .where(
      and(
        eq(deliveries.status, "pending"),
        eq(deliveries.frequency, frequency),
        lte(deliveries.nextAttemptAt, now),
        eq(notificationChannels.type, "email"),
      ),
    )
    .groupBy(deliveries.channelId, users.timezone, users.digestHour);

  const due = candidates.filter((candidate) => {
    if (frequency === "instant") {
      return (
        candidate.oldest !== null &&
        candidate.oldest.getTime() <= now.getTime() - INSTANT_BATCH_WINDOW_MS
      );
    }
    if (frequency === "daily")
      return isDailyDigestDue(candidate.timezone, candidate.digestHour, now);
    return true;
  });

  const result: SendResult = { emails: 0, failed: 0 };
  for (const { channelId } of due) {
    const sent = await sendChannelEmail(ctx, channelId, frequency);
    if (sent === "sent") result.emails++;
    if (sent === "failed") result.failed++;
  }
  return result;
}

async function sendChannelEmail(
  ctx: WorkerContext,
  channelId: string,
  frequency: Frequency,
): Promise<"sent" | "failed" | "nothing"> {
  const now = ctx.now();
  const channel = await ctx.db.query.notificationChannels.findFirst({
    where: eq(notificationChannels.id, channelId),
  });
  if (!channel) return "nothing";

  const rows = await ctx.db
    .select({
      deliveryId: deliveries.id,
      attempts: deliveries.attempts,
      subscriptionId: deliveries.subscriptionId,
      subscriptionStatus: subscriptions.status,
      owner: repositories.owner,
      name: repositories.name,
      type: events.type,
      label: events.label,
      occurredAt: events.occurredAt,
      issue: events.issue,
    })
    .from(deliveries)
    .innerJoin(events, eq(events.id, deliveries.eventId))
    .innerJoin(subscriptions, eq(subscriptions.id, deliveries.subscriptionId))
    .innerJoin(repositories, eq(repositories.id, events.repoId))
    .where(
      and(
        eq(deliveries.channelId, channelId),
        eq(deliveries.frequency, frequency),
        eq(deliveries.status, "pending"),
        lte(deliveries.nextAttemptAt, now),
      ),
    )
    .orderBy(asc(deliveries.createdAt))
    .limit(MAX_DELIVERIES_PER_EMAIL);

  const address = channel.config.address.toLowerCase();
  const suppressed = await ctx.db.query.emailSuppressions.findFirst({
    where: eq(emailSuppressions.address, address),
  });

  // Paused subscriptions and unusable channels: drop the deliveries without sending.
  const skipped = rows.filter(
    (row) => row.subscriptionStatus !== "active" || channel.status !== "active" || suppressed,
  );
  const toSend = rows.filter((row) => !skipped.includes(row));
  if (skipped.length > 0) {
    await setStatus(
      ctx,
      skipped.map((row) => row.deliveryId),
      "skipped",
    );
  }
  if (toSend.length === 0) return "nothing";

  const sections = groupDeliveriesByRepo(
    toSend.map((row) => ({
      deliveryId: row.deliveryId,
      subscriptionId: row.subscriptionId,
      repo: { owner: row.owner, name: row.name },
      event: { type: row.type, label: row.label, occurredAt: row.occurredAt, issue: row.issue },
    })),
  ).map((section) => ({
    ...section,
    unsubscribeUrl: ctx.links.unsubscribe(channel.id, section.subscriptionIds),
  }));

  const unsubscribeAllUrl = ctx.links.unsubscribe(channel.id);
  const email = await renderNotificationEmail({
    kind: frequency,
    sections,
    dashboardUrl: ctx.links.dashboard,
    unsubscribeAllUrl,
    logoUrl: ctx.links.logo,
  });

  const ids = toSend.map((row) => row.deliveryId);
  try {
    await ctx.mailer.send({
      to: channel.config.address,
      ...email,
      headers: {
        // One-click unsubscribe (RFC 8058), required by Gmail and Yahoo for bulk senders.
        "List-Unsubscribe": `<${unsubscribeAllUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof PermanentEmailError) {
      await ctx.db.transaction(async (tx) => {
        await tx
          .insert(emailSuppressions)
          .values({ address, reason: "bounce", detail: message })
          .onConflictDoNothing();
        await tx
          .update(notificationChannels)
          .set({ status: "disabled", disabledReason: "bounced", lastError: message })
          .where(eq(notificationChannels.id, channel.id));
        await tx
          .update(deliveries)
          .set({ status: "failed", lastError: message, attempts: sql`${deliveries.attempts} + 1` })
          .where(inArray(deliveries.id, ids));
      });
      ctx.log.warn({ channelId: channel.id }, "email rejected permanently; channel disabled");
      return "failed";
    }

    const attempts = Math.max(...toSend.map((row) => row.attempts)) + 1;
    const delay = RETRY_DELAYS_MS[attempts - 1];
    await ctx.db
      .update(deliveries)
      .set({
        attempts: sql`${deliveries.attempts} + 1`,
        lastError: message,
        ...(delay === undefined
          ? { status: "failed" as const }
          : { nextAttemptAt: new Date(now.getTime() + delay) }),
      })
      .where(inArray(deliveries.id, ids));
    await ctx.db
      .update(notificationChannels)
      .set({
        consecutiveFailures: sql`${notificationChannels.consecutiveFailures} + 1`,
        lastError: message,
      })
      .where(eq(notificationChannels.id, channel.id));
    ctx.log.error({ err: error, channelId: channel.id, attempts }, "sending email failed");
    return "failed";
  }

  const batchId = randomUUID();
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(deliveries)
      .set({ status: "sent", sentAt: now, batchId, attempts: sql`${deliveries.attempts} + 1` })
      .where(inArray(deliveries.id, ids));
    await tx
      .update(notificationChannels)
      .set({ consecutiveFailures: 0, lastError: null })
      .where(eq(notificationChannels.id, channel.id));
  });
  return "sent";
}

async function setStatus(ctx: WorkerContext, ids: string[], status: "skipped") {
  await ctx.db.update(deliveries).set({ status }).where(inArray(deliveries.id, ids));
}
