import { and, eq, inArray } from "@osg/core/db/query";
import {
  deliveries,
  emailSuppressions,
  notificationChannels,
  subscriptionChannels,
} from "@osg/core/db/schema";
import { type EmailToken, verifyEmailToken } from "@osg/core/tokens";
import { renderVerifyEmail, renderWelcomeEmail } from "@osg/emails";
import type { ApiContext } from "../context.ts";
import { ApiError } from "../errors.ts";

/** How long the link in a verification email works. */
export const VERIFY_EMAIL_TTL_MS = 24 * 60 * 60 * 1000;

export type Channel = typeof notificationChannels.$inferSelect;

/**
 * First sign-in: the GitHub-verified primary email becomes an active channel right away
 * (no double opt-in needed, PLAN.md §3), then a welcome email is sent.
 */
export async function onUserCreated(
  ctx: ApiContext,
  user: { id: string; email: string; emailVerified: boolean; login?: unknown },
): Promise<void> {
  const [channel] = await ctx.db
    .insert(notificationChannels)
    .values({
      userId: user.id,
      type: "email",
      label: "Primary email",
      config: { address: user.email },
      status: user.emailVerified ? "active" : "pending",
      verifiedAt: user.emailVerified ? ctx.now() : null,
    })
    .onConflictDoNothing()
    .returning();

  if (channel?.status === "pending") {
    await sendVerificationEmail(ctx, channel);
    return;
  }
  const email = await renderWelcomeEmail({
    login: typeof user.login === "string" ? user.login : "there",
    dashboardUrl: ctx.links.dashboard,
    docsUrl: ctx.links.docs,
  });
  await ctx.mailer.send({ to: user.email, ...email });
}

export async function sendVerificationEmail(ctx: ApiContext, channel: Channel): Promise<void> {
  const verifyUrl = ctx.links.verifyEmail(
    channel.id,
    new Date(ctx.now().getTime() + VERIFY_EMAIL_TTL_MS),
  );
  const email = await renderVerifyEmail({ address: channel.config.address, verifyUrl });
  await ctx.mailer.send({ to: channel.config.address, ...email });
}

/** Adds an email address; it receives nothing until verified. */
export async function addEmailChannel(
  ctx: ApiContext,
  userId: string,
  input: { address: string; label?: string | undefined },
): Promise<Channel> {
  const [channel] = await ctx.db
    .insert(notificationChannels)
    .values({
      userId,
      type: "email",
      label: input.label ?? input.address,
      config: { address: input.address },
      status: "pending",
    })
    .onConflictDoNothing()
    .returning();
  if (!channel) {
    throw new ApiError(409, "channel_exists", `${input.address} is already one of your channels.`);
  }
  await sendVerificationEmail(ctx, channel);
  return channel;
}

const parseToken = <P extends EmailToken["purpose"]>(
  ctx: ApiContext,
  token: string,
  purpose: P,
) => {
  const payload = verifyEmailToken(token, ctx.emailTokenSecret, ctx.now());
  if (!payload || payload.purpose !== purpose) {
    throw new ApiError(400, "invalid_token", "This link is invalid or has expired.");
  }
  return payload as Extract<EmailToken, { purpose: P }>;
};

/** Confirms an address from the link in a verification email. */
export async function verifyEmailChannel(ctx: ApiContext, token: string): Promise<Channel> {
  const { channelId } = parseToken(ctx, token, "verify-email");
  const channel = await ctx.db.query.notificationChannels.findFirst({
    where: eq(notificationChannels.id, channelId),
  });
  if (!channel) throw new ApiError(400, "invalid_token", "This link is invalid or has expired.");
  if (channel.status === "active") return channel;

  const [updated] = await ctx.db.transaction(async (tx) => {
    // Verifying again is an explicit opt-in: forget an earlier unsubscribe.
    await tx
      .delete(emailSuppressions)
      .where(
        and(
          eq(emailSuppressions.address, channel.config.address.toLowerCase()),
          eq(emailSuppressions.reason, "unsubscribed"),
        ),
      );
    return tx
      .update(notificationChannels)
      .set({ status: "active", verifiedAt: ctx.now(), disabledReason: null })
      .where(eq(notificationChannels.id, channel.id))
      .returning();
  });
  return updated ?? channel;
}

export interface UnsubscribeTarget {
  address: string;
  /** Null: every notification to this address. */
  subscriptionIds: string[] | null;
}

/** What a token would unsubscribe from, for the confirmation page. */
export async function describeUnsubscribe(
  ctx: ApiContext,
  token: string,
): Promise<UnsubscribeTarget> {
  const payload = parseToken(ctx, token, "unsubscribe");
  const channel = await ctx.db.query.notificationChannels.findFirst({
    where: eq(notificationChannels.id, payload.channelId),
  });
  if (!channel) throw new ApiError(400, "invalid_token", "This link is invalid or has expired.");
  return { address: channel.config.address, subscriptionIds: payload.subscriptionIds ?? null };
}

/**
 * Unsubscribes from the link in a notification email (one-click or confirmation page).
 * - For some subscriptions: they stop using this channel.
 * - For everything: the channel is disabled and the address suppressed.
 * Pending deliveries that would now be unwanted are skipped. Idempotent.
 */
export async function unsubscribe(ctx: ApiContext, token: string): Promise<UnsubscribeTarget> {
  const payload = parseToken(ctx, token, "unsubscribe");
  const channel = await ctx.db.query.notificationChannels.findFirst({
    where: eq(notificationChannels.id, payload.channelId),
  });
  // The channel may already be gone (deleted account): nothing left to do.
  if (!channel) return { address: "", subscriptionIds: payload.subscriptionIds ?? null };

  await ctx.db.transaction(async (tx) => {
    if (payload.subscriptionIds?.length) {
      await tx
        .delete(subscriptionChannels)
        .where(
          and(
            eq(subscriptionChannels.channelId, channel.id),
            inArray(subscriptionChannels.subscriptionId, payload.subscriptionIds),
          ),
        );
      await tx
        .update(deliveries)
        .set({ status: "skipped" })
        .where(
          and(
            eq(deliveries.channelId, channel.id),
            inArray(deliveries.subscriptionId, payload.subscriptionIds),
            eq(deliveries.status, "pending"),
          ),
        );
      return;
    }

    await tx.delete(subscriptionChannels).where(eq(subscriptionChannels.channelId, channel.id));
    await tx
      .update(deliveries)
      .set({ status: "skipped" })
      .where(and(eq(deliveries.channelId, channel.id), eq(deliveries.status, "pending")));
    await tx
      .update(notificationChannels)
      .set({ status: "disabled", disabledReason: "unsubscribed" })
      .where(eq(notificationChannels.id, channel.id));
    await tx
      .insert(emailSuppressions)
      .values({ address: channel.config.address.toLowerCase(), reason: "unsubscribed" })
      .onConflictDoNothing();
  });

  return { address: channel.config.address, subscriptionIds: payload.subscriptionIds ?? null };
}
