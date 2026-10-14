import { and, eq, inArray, isNotNull, lt, notExists } from "@osg/core/db/query";
import { deliveries, events, sessions, verifications } from "@osg/core/db/schema";
import type { WorkerContext } from "../context.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
/** How long sent, skipped and failed deliveries (and their events) are kept. */
export const RETENTION_DAYS = 90;

/** Daily housekeeping (PLAN.md §10). */
export async function cleanup(ctx: WorkerContext) {
  const now = ctx.now();
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * DAY_MS);

  const expiredSessions = await ctx.db
    .delete(sessions)
    .where(lt(sessions.expiresAt, now))
    .returning({ id: sessions.id });
  const expiredVerifications = await ctx.db
    .delete(verifications)
    .where(lt(verifications.expiresAt, now))
    .returning({ id: verifications.id });
  const oldDeliveries = await ctx.db
    .delete(deliveries)
    .where(
      and(
        inArray(deliveries.status, ["sent", "skipped", "failed"]),
        lt(deliveries.createdAt, cutoff),
      ),
    )
    .returning({ id: deliveries.id });
  // Old events with nothing left pointing at them.
  const oldEvents = await ctx.db
    .delete(events)
    .where(
      and(
        isNotNull(events.fannedOutAt),
        lt(events.createdAt, cutoff),
        notExists(
          ctx.db
            .select({ id: deliveries.id })
            .from(deliveries)
            .where(eq(deliveries.eventId, events.id)),
        ),
      ),
    )
    .returning({ id: events.id });

  return {
    sessions: expiredSessions.length,
    verifications: expiredVerifications.length,
    deliveries: oldDeliveries.length,
    events: oldEvents.length,
  };
}
