import { describe, expect, it } from "vitest";
import {
  type NotificationSection,
  renderAccountDeletedEmail,
  renderGoalAchievedEmail,
  renderNotificationEmail,
  renderStreakReminderEmail,
  renderVerifyEmail,
} from "./index.ts";

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

const LOGO = "https://osg.test/brand/osg-icon.png";

const common = {
  logoUrl: LOGO,
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
      logoUrl: LOGO,
    });

    expect(email.subject).toBe("Confirm your email address");
    expect(email.html).toContain("https://osg.test/api/v1/public/email/verify?token=abc");
    // Every email has the logo, in brand colors.
    expect(email.html).toContain(LOGO);
    expect(email.html).toContain("#45056E");
  });
});

describe("renderAccountDeletedEmail", () => {
  it("renders account deletion confirmation with user login", async () => {
    const email = await renderAccountDeletedEmail({
      login: "ada",
      logoUrl: LOGO,
    });

    expect(email.subject).toBe("Your Open Source Guru account has been deleted");
    expect(email.html).toContain("Account deleted");
    expect(email.html).toContain("Hi ada, your");
    expect(email.html).toContain("permanently deleted");
    expect(email.html).toContain(LOGO);
    expect(email.text).toContain("Hi ada, your Open Source Guru account");
  });

  it("renders fallback text when login is omitted", async () => {
    const email = await renderAccountDeletedEmail({
      logoUrl: LOGO,
    });

    expect(email.subject).toBe("Your Open Source Guru account has been deleted");
    expect(email.html).toContain("Account deleted");
    expect(email.text).toContain("Your Open Source Guru account and all associated data");
  });
});

describe("progress emails", () => {
  const links = {
    logoUrl: LOGO,
    stopUrl: "https://osg.test/api/v1/public/email/preferences?token=stop",
    settingsUrl: "https://osg.test/dashboard/settings",
  };

  it("reminds about a streak, with a way to stop", async () => {
    const email = await renderStreakReminderEmail({
      ...links,
      period: "week",
      length: 5,
      contributionsUrl: "https://osg.test/dashboard/contributions",
    });
    expect(email.subject).toBe("Keep your 5-week streak going");
    expect(email.text).toContain("this week");
    expect(email.html).toContain("token=stop");
  });

  it("congratulates on goals", async () => {
    const goal = {
      title: "30 Open Source Contributions a month",
      progress: 31,
      target: 30,
      periodLabel: "October 2026",
    };
    const one = await renderGoalAchievedEmail({
      ...links,
      goals: [goal],
      goalsUrl: "https://osg.test/dashboard/goals",
    });
    expect(one.subject).toBe("Goal achieved: 30 Open Source Contributions a month");
    expect(one.text).toContain("31 / 30");
    const two = await renderGoalAchievedEmail({
      ...links,
      goals: [goal, goal],
      goalsUrl: "https://osg.test/dashboard/goals",
    });
    expect(two.subject).toBe("2 goals achieved");
  });
});
