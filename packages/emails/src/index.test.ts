import { describe, expect, it } from "vitest";
import { type NotificationSection, renderNotificationEmail, renderVerifyEmail } from "./index.ts";

const section = (fullName: string, numbers: number[]): NotificationSection => ({
  fullName,
  url: `https://github.com/${fullName}`,
  unsubscribeUrl: `https://osg.test/email/unsubscribe?token=${fullName}`,
  issues: numbers.map((number) => ({
    number,
    title: `Fix bug ${number}`,
    url: `https://github.com/${fullName}/issues/${number}`,
    labels: ["help wanted"],
    assignees: [],
    reasons: ["Labeled help wanted"],
  })),
});

const common = {
  dashboardUrl: "https://osg.test/dashboard",
  unsubscribeAllUrl: "https://osg.test/email/unsubscribe?token=all",
};

describe("renderNotificationEmail", () => {
  it("names the issue in the subject when there is only one", async () => {
    const email = await renderNotificationEmail({
      kind: "instant",
      sections: [section("acme/repo", [42])],
      ...common,
    });

    expect(email.subject).toBe("acme/repo#42: Fix bug 42");
  });

  it("summarizes digests in the subject", async () => {
    const one = await renderNotificationEmail({
      kind: "daily",
      sections: [section("acme/repo", [1, 2])],
      ...common,
    });
    const many = await renderNotificationEmail({
      kind: "hourly",
      sections: [section("acme/a", [1]), section("acme/b", [2, 3])],
      ...common,
    });

    expect(one.subject).toBe("Daily digest: 2 issues in acme/repo");
    expect(many.subject).toBe("Hourly digest: 3 issues in 2 repositories");
  });

  it("renders issues, assignment status and unsubscribe links in HTML and text", async () => {
    const email = await renderNotificationEmail({
      kind: "instant",
      sections: [section("acme/repo", [42])],
      ...common,
    });

    expect(email.html).toContain("https://github.com/acme/repo/issues/42");
    expect(email.html).toContain("Not assigned yet");
    expect(email.html).toContain(common.unsubscribeAllUrl);
    expect(email.html).toContain("token=acme/repo");
    expect(email.text).toContain("#42 Fix bug 42");
  });
});

describe("renderVerifyEmail", () => {
  it("includes the verification link", async () => {
    const email = await renderVerifyEmail({
      address: "me@example.com",
      verifyUrl: "https://osg.test/api/v1/public/email/verify?token=abc",
    });

    expect(email.subject).toBe("Confirm your email address");
    expect(email.html).toContain("https://osg.test/api/v1/public/email/verify?token=abc");
  });
});
