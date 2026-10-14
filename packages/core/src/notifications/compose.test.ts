import { describe, expect, it } from "vitest";
import { type DeliveryItem, groupDeliveriesByRepo } from "./compose.ts";

const item = (
  overrides: { repo?: string; number?: number; subscriptionId?: string; at?: string } & Partial<
    Pick<DeliveryItem["event"], "type" | "label">
  > = {},
): DeliveryItem => {
  const [owner = "acme", name = "repo"] = (overrides.repo ?? "acme/repo").split("/");
  const number = overrides.number ?? 1;
  return {
    deliveryId: `d-${Math.random()}`,
    subscriptionId: overrides.subscriptionId ?? "s1",
    repo: { owner, name },
    event: {
      type: overrides.type ?? "issue.opened",
      label: overrides.label ?? null,
      occurredAt: new Date(overrides.at ?? "2026-10-14T10:00:00Z"),
      issue: {
        number,
        title: `Issue ${number}`,
        htmlUrl: `https://github.com/${owner}/${name}/issues/${number}`,
        labels: [{ nodeId: "LA_1", name: "help wanted", color: "008672" }],
        assignees: [],
        authorLogin: "octocat",
      },
    },
  };
};

describe("groupDeliveriesByRepo", () => {
  it("groups by repo, sorted by repo name", () => {
    const sections = groupDeliveriesByRepo([item({ repo: "zeta/z" }), item({ repo: "acme/a" })]);

    expect(sections.map((section) => section.fullName)).toEqual(["acme/a", "zeta/z"]);
    expect(sections[0]?.url).toBe("https://github.com/acme/a");
  });

  it("lists an issue once, with every reason and subscription", () => {
    const sections = groupDeliveriesByRepo([
      item({ subscriptionId: "s1" }),
      item({ subscriptionId: "s2", type: "issue.labeled", label: "good first issue" }),
      item({ subscriptionId: "s2" }),
    ]);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.subscriptionIds).toEqual(["s1", "s2"]);
    expect(sections[0]?.issues).toEqual([
      {
        number: 1,
        title: "Issue 1",
        url: "https://github.com/acme/repo/issues/1",
        labels: ["help wanted"],
        assignees: [],
        reasons: ["New issue", "Labeled good first issue"],
      },
    ]);
  });

  it("puts the most recent issues first", () => {
    const sections = groupDeliveriesByRepo([
      item({ number: 1, at: "2026-10-14T08:00:00Z" }),
      item({ number: 2, at: "2026-10-14T09:00:00Z" }),
    ]);

    expect(sections[0]?.issues.map((issue) => issue.number)).toEqual([2, 1]);
  });
});
