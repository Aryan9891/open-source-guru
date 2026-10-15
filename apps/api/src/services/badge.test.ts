import { describe, expect, it } from "vitest";
import { badgeMessage, renderBadge } from "./badge.ts";

describe("badge", () => {
  it("words the message", () => {
    expect(badgeMessage(1234, { length: 5, period: "week" })).toBe(
      "1,234 contributions · 5-week streak",
    );
    expect(badgeMessage(1, { length: 0, period: "day" })).toBe("1 contribution");
  });

  it("renders an accessible SVG that grows with its text", () => {
    const short = renderBadge("open source", "1 contribution");
    const long = renderBadge("open source", "1,234 contributions · 52-week streak");
    expect(short).toContain('role="img"');
    expect(short).toContain("<title>open source: 1 contribution</title>");
    const width = (svg: string) => Number(/width="(\d+)"/.exec(svg)?.[1]);
    expect(width(long)).toBeGreaterThan(width(short));
  });

  it("escapes text", () => {
    expect(renderBadge("a<b", "c&d")).toContain("a&#60;b");
    expect(renderBadge("a<b", "c&d")).not.toContain("c&d");
  });
});
