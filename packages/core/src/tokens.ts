import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Payloads of the signed tokens used in email links. Signed (HMAC-SHA256), not encrypted:
 * they only carry IDs, and nothing needs to be stored to check them.
 */
export type EmailToken =
  /** Stop emails to a channel, for some subscriptions or (without `subscriptionIds`) all of them. */
  | { purpose: "unsubscribe"; channelId: string; subscriptionIds?: string[] }
  /** Confirm that the user owns an email address they added. */
  | { purpose: "verify-email"; channelId: string; expiresAt: number };

const VERSION = "v1";

const sign = (data: string, secret: string) =>
  createHmac("sha256", secret).update(`${VERSION}.${data}`).digest("base64url");

export function signEmailToken(payload: EmailToken, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, secret)}`;
}

/** Returns the payload of a valid, unexpired token, or null. */
export function verifyEmailToken(
  token: string,
  secret: string,
  now: Date = new Date(),
): EmailToken | null {
  const [data, signature, ...rest] = token.split(".");
  if (!data || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(data, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  let payload: EmailToken;
  try {
    payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (payload.purpose === "verify-email" && payload.expiresAt <= now.getTime()) return null;
  return payload;
}
