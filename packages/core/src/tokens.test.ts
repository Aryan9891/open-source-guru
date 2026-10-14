import { describe, expect, it } from "vitest";
import { signEmailToken, verifyEmailToken } from "./tokens.ts";

const secret = "a-test-secret-that-is-long-enough-123";

describe("email tokens", () => {
  it("round-trips an unsubscribe token", () => {
    const token = signEmailToken(
      { purpose: "unsubscribe", channelId: "c1", subscriptionIds: ["s1"] },
      secret,
    );

    expect(verifyEmailToken(token, secret)).toEqual({
      purpose: "unsubscribe",
      channelId: "c1",
      subscriptionIds: ["s1"],
    });
  });

  it("rejects tampered payloads and other secrets", () => {
    const token = signEmailToken({ purpose: "unsubscribe", channelId: "c1" }, secret);
    const [, signature] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ purpose: "unsubscribe", channelId: "c2" })).toString("base64url")}.${signature}`;

    expect(verifyEmailToken(forged, secret)).toBeNull();
    expect(verifyEmailToken(token, "another-secret-that-is-long-enough-456")).toBeNull();
    expect(verifyEmailToken("garbage", secret)).toBeNull();
  });

  it("rejects expired verification tokens", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    const token = signEmailToken(
      { purpose: "verify-email", channelId: "c1", expiresAt: now.getTime() + 1000 },
      secret,
    );

    expect(verifyEmailToken(token, secret, now)).not.toBeNull();
    expect(verifyEmailToken(token, secret, new Date(now.getTime() + 1000))).toBeNull();
  });
});
