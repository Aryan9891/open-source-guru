import { signEmailToken } from "./tokens.ts";

/** Builds the absolute URLs used in emails. All go through the web app's origin. */
export function createEmailLinks(options: { webUrl: string; secret: string }) {
  const { webUrl, secret } = options;
  const publicApi = `${webUrl}/api/v1/public/email`;

  return {
    dashboard: `${webUrl}/dashboard`,
    docs: `${webUrl}/docs`,

    /** Page (GET) and one-click endpoint (POST, RFC 8058) for unsubscribing. */
    unsubscribe(channelId: string, subscriptionIds?: string[]) {
      const token = signEmailToken({ purpose: "unsubscribe", channelId, subscriptionIds }, secret);
      return `${publicApi}/unsubscribe?token=${encodeURIComponent(token)}`;
    },

    verifyEmail(channelId: string, expiresAt: Date) {
      const token = signEmailToken(
        { purpose: "verify-email", channelId, expiresAt: expiresAt.getTime() },
        secret,
      );
      return `${publicApi}/verify?token=${encodeURIComponent(token)}`;
    },
  };
}

export type EmailLinks = ReturnType<typeof createEmailLinks>;
