import { eq } from "@osg/core/db/query";
import { contributionSyncs, goals, userStreaks, users } from "@osg/core/db/schema";
import { describe, expect, it } from "vitest";
import { contribution, ghRepo } from "../testing/contributions.ts";
import { createWorkerTest, useTestDatabase } from "../testing/setup.ts";
import { sendStreakReminders } from "./progress-emails.ts";
import { syncContributionYear } from "./sync-contributions.ts";

const database = useTestDatabase();
const HOUR = 60 * 60 * 1000;

/** A user with a 3-week streak whose last counted week is the one before this week. */
async function setup() {
  const test = await createWorkerTest(database());
  const { db } = database();
  await db.update(users).set({ streakReminders: true }).where(eq(users.id, test.user.id));
  await db.insert(userStreaks).values({
    userId: test.user.id,
    period: "week",
    currentLength: 3,
    longestLength: 3,
    currentStart: "2026-09-20",
    lastCountedPeriod: "2026-10-04",
  });
  await db.insert(contributionSyncs).values({ userId: test.user.id, year: 2026, status: "done" });
  /** Moves the clock and marks contributions as just synced. */
  const at = async (iso: string) => {
    test.advance(new Date(iso).getTime() - test.ctx.now().getTime());
    await db
      .update(contributionSyncs)
      .set({ lastSyncedAt: new Date(test.ctx.now().getTime() - 10 * 60 * 1000) })
      .where(eq(contributionSyncs.userId, test.user.id));
  };
  return { ...test, at };
}

describe("streak reminders", () => {
  it("go out on Friday evening (user's time) when the week has no contribution yet, once", async () => {
    const { ctx, mailer, at } = await setup();

    await at("2026-10-15T18:30:00Z"); // Thursday
    expect(await sendStreakReminders(ctx)).toEqual({ sent: 0 });
    await at("2026-10-16T12:30:00Z"); // Friday, too early
    expect(await sendStreakReminders(ctx)).toEqual({ sent: 0 });

    await at("2026-10-16T18:30:00Z");
    expect(await sendStreakReminders(ctx)).toEqual({ sent: 1 });
    const [email] = mailer.sent;
    expect(email).toMatchObject({
      to: "ada@example.com",
      subject: "Keep your 3-week streak going",
    });
    expect(email?.headers?.["List-Unsubscribe"]).toContain("/preferences?token=");

    await at("2026-10-16T19:30:00Z");
    expect(await sendStreakReminders(ctx)).toEqual({ sent: 0 });
  });

  it("follow the user's time zone", async () => {
    const { ctx, at, user } = await setup();
    await database().db.update(users).set({ timezone: "Asia/Tokyo" }).where(eq(users.id, user.id));
    // 18:30 UTC on Friday is 03:30 on Saturday in Tokyo; 09:30 UTC is 18:30 there.
    await at("2026-10-16T18:30:00Z");
    expect(await sendStreakReminders(ctx)).toEqual({ sent: 0 });
    await at("2026-10-16T09:30:00Z");
    expect(await sendStreakReminders(ctx)).toEqual({ sent: 1 });
  });

  it("wait for a fresh sync, and request one", async () => {
    const { ctx, at, advance, mailer, user } = await setup();
    await at("2026-10-16T16:00:00Z");
    advance(2.5 * HOUR); // 18:30, last sync two hours old

    expect(await sendStreakReminders(ctx)).toEqual({ sent: 0 });
    expect(mailer.sent).toEqual([]);
    const sync = await database().db.query.contributionSyncs.findFirst({
      where: eq(contributionSyncs.userId, user.id),
    });
    expect(sync?.status).toBe("pending");
  });

  it("aren't sent when the week already counts, or reminders are off", async () => {
    const { ctx, at, user } = await setup();
    await database()
      .db.update(userStreaks)
      .set({ lastCountedPeriod: "2026-10-11", currentLength: 4 })
      .where(eq(userStreaks.userId, user.id));
    await at("2026-10-16T18:30:00Z");
    expect(await sendStreakReminders(ctx)).toEqual({ sent: 0 });

    await database()
      .db.update(userStreaks)
      .set({ lastCountedPeriod: "2026-10-04" })
      .where(eq(userStreaks.userId, user.id));
    await database().db.update(users).set({ streakReminders: false }).where(eq(users.id, user.id));
    expect(await sendStreakReminders(ctx)).toEqual({ sent: 0 });
  });
});

describe("goal emails", () => {
  it("congratulate after a sync reaches a goal, when turned on", async () => {
    const { ctx, contributions: github, mailer, user } = await createWorkerTest(database());
    await database().db.update(users).set({ goalEmails: true }).where(eq(users.id, user.id));
    await database().db.insert(goals).values({
      userId: user.id,
      metric: "issues_opened",
      target: 1,
      recurrence: "monthly",
      startsOn: "2026-10-01",
    });

    github.state.contributions = [contribution("issue", ghRepo(10), "2026-10-12T10:00:00Z")];
    await syncContributionYear(ctx, user.id, 2026);

    expect(mailer.sent.map((email) => email.subject)).toEqual([
      "Goal achieved: 1 issue opened a month",
    ]);
    expect(mailer.sent[0]?.text).toContain("October 2026");

    // Already achieved: no second email.
    await syncContributionYear(ctx, user.id, 2026);
    expect(mailer.sent).toHaveLength(1);
  });
});
