import { type EmailPreference, signEmailToken } from "./tokens.ts";

/** Builds the absolute URLs used in emails. All go through the web app's origin. */
export function createEmailLinks(options: { webUrl: string; secret: string }) {
  const { webUrl, secret } = options;
  const publicApi = `${webUrl}/api/v1/public/email`;

  return {
    dashboard: `${webUrl}/dashboard`,
    docs: `${webUrl}/docs`,
    /** The logo at the top of every email (a PNG: email clients don't show SVG). */
    logo: `${webUrl}/brand/osg-icon.png`,

    /** Page (GET) and one-click endpoint (POST, RFC 8058) for unsubscribing. */
    unsubscribe(channelId: string, subscriptionIds?: string[]) {
      const token = signEmailToken({ purpose: "unsubscribe", channelId, subscriptionIds }, secret);
      return `${publicApi}/unsubscribe?token=${encodeURIComponent(token)}`;
    },

    /** Page (GET) and one-click endpoint (POST, RFC 8058) to turn an opt-in email off. */
    stopEmails(userId: string, preference: EmailPreference) {
      const token = signEmailToken({ purpose: "email-preference", userId, preference }, secret);
      return `${publicApi}/preferences?token=${encodeURIComponent(token)}`;
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
