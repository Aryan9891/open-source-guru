import { goalPeriods, goals } from "@osg/core/db/schema";
import { one } from "@osg/core/testing";
import { describe, expect, it } from "vitest";
import { contribution, ghRepo } from "../testing/contributions.ts";
import { createWorkerTest, useTestDatabase } from "../testing/setup.ts";
import { recomputeProgress } from "./recompute-progress.ts";
import { syncContributionYear } from "./sync-contributions.ts";

const database = useTestDatabase();

describe("goal progress", () => {
  it("is recomputed after each sync, and reports periods achieved just now", async () => {
    const { ctx, contributions: github, user } = await createWorkerTest(database());
    const repo = ghRepo(10);
    const goal = await database()
      .db.insert(goals)
      .values({
        userId: user.id,
        metric: "issues_opened",
        target: 2,
        recurrence: "monthly",
        startsOn: "2026-09-01",
      })
      .returning()
      .then(one);

    github.state.contributions = [contribution("issue", repo, "2026-09-10T10:00:00Z")];
    await syncContributionYear(ctx, user.id, 2026);
    expect(await database().db.select().from(goalPeriods)).toMatchObject([
      { goalId: goal.id, periodStart: "2026-09-01", progress: 1, achievedAt: null },
      { goalId: goal.id, periodStart: "2026-10-01", progress: 0, achievedAt: null },
    ]);

    github.state.contributions.push(contribution("issue", repo, "2026-09-20T10:00:00Z"));
    await syncContributionYear(ctx, user.id, 2026);
    const september = (await database().db.select().from(goalPeriods)).find(
      (period) => period.periodStart === "2026-09-01",
    );
    expect(september).toMatchObject({ progress: 2, achievedAt: ctx.now() });

    // Already achieved: not reported again.
    expect(await recomputeProgress(ctx, user.id)).toEqual([]);
  });
});
