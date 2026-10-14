import { and, asc, eq, inArray, isNull } from "@osg/core/db/query";
import {
  deliveries,
  events,
  notificationChannels,
  subscriptionChannels,
  subscriptions,
} from "@osg/core/db/schema";
import { matchesSubscription } from "@osg/core/notifications/match";
import type { WorkerContext } from "../context.ts";

const BATCH_SIZE = 500;

/**
 * Creates one delivery per (event, subscription, channel) for new events that match active
 * subscriptions (PLAN.md §10). Idempotent: a unique key prevents duplicate deliveries, and
 * events are marked as fanned out in the same transaction.
 */
export async function fanOutEvents(
  ctx: WorkerContext,
): Promise<{ events: number; deliveries: number }> {
  const now = ctx.now();
  return ctx.db.transaction(async (tx) => {
    const pending = await tx
      .select()
      .from(events)
      .where(isNull(events.fannedOutAt))
      .orderBy(asc(events.createdAt))
      .limit(BATCH_SIZE)
      .for("update", { skipLocked: true });
    if (pending.length === 0) return { events: 0, deliveries: 0 };

    const repoIds = [...new Set(pending.map((event) => event.repoId))];
    const targets = await tx
      .select({
        subscriptionId: subscriptions.id,
        repoId: subscriptions.repoId,
        eventTypes: subscriptions.eventTypes,
        labels: subscriptions.labels,
        labelMatch: subscriptions.labelMatch,
        subscribedAt: subscriptions.createdAt,
        channelId: subscriptionChannels.channelId,
        frequency: subscriptionChannels.frequency,
      })
      .from(subscriptions)
      .innerJoin(subscriptionChannels, eq(subscriptionChannels.subscriptionId, subscriptions.id))
      .innerJoin(notificationChannels, eq(notificationChannels.id, subscriptionChannels.channelId))
      .where(
        and(
          inArray(subscriptions.repoId, repoIds),
          eq(subscriptions.status, "active"),
          eq(notificationChannels.status, "active"),
        ),
      );

    const rows = pending.flatMap((event) =>
      targets
        .filter(
          (target) =>
            target.repoId === event.repoId &&
            // Subscribing doesn't replay events detected before the subscription existed.
            target.subscribedAt <= event.createdAt &&
            matchesSubscription(target, event),
        )
        .map((target) => ({
          eventId: event.id,
          subscriptionId: target.subscriptionId,
          channelId: target.channelId,
          frequency: target.frequency,
          // Timestamps come from the job's clock, like every time comparison in the jobs.
          createdAt: now,
          nextAttemptAt: now,
        })),
    );

    const inserted =
      rows.length === 0
        ? []
        : await tx
            .insert(deliveries)
            .values(rows)
            .onConflictDoNothing()
            .returning({ id: deliveries.id });

    await tx
      .update(events)
      .set({ fannedOutAt: now })
      .where(
        inArray(
          events.id,
          pending.map((event) => event.id),
        ),
      );

    return { events: pending.length, deliveries: inserted.length };
  });
}
