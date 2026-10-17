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

  it("customizes the message background color with hex or CSS color names", () => {
    const hexWithHash = renderBadge("open source", "1 contribution", false, { color: "#45056E" });
    expect(hexWithHash).toContain('fill="#45056E"');

    const hexWithoutHash = renderBadge("open source", "1 contribution", false, { color: "10b981" });
    expect(hexWithoutHash).toContain('fill="#10b981"');

    const namedColor = renderBadge("open source", "1 contribution", false, { color: "blue" });
    expect(namedColor).toContain('fill="blue"');

    const defaultBadge = renderBadge("open source", "1 contribution");
    expect(defaultBadge).toContain('fill="#8F1383"');

    // Invalid color falls back to default safely without injecting unescaped attributes
    const invalidColor = renderBadge("open source", "1 contribution", false, {
      color: '"><script>',
    });
    expect(invalidColor).toContain('fill="#8F1383"');
  });

  it("scales badge dimensions with size presets and custom pixel heights", () => {
    const defaultBadge = renderBadge("open source", "1 contribution");
    expect(defaultBadge).toContain('height="20"');

    const smallBadge = renderBadge("open source", "1 contribution", false, { size: "small" });
    expect(smallBadge).toContain('height="20"');

    const mediumBadge = renderBadge("open source", "1 contribution", false, { size: "medium" });
    expect(mediumBadge).toContain('height="28"');

    const largeBadge = renderBadge("open source", "1 contribution", false, { size: "large" });
    expect(largeBadge).toContain('height="36"');

    const customBadge = renderBadge("open source", "1 contribution", false, { size: "48" });
    expect(customBadge).toContain('height="48"');

    // Out-of-range or invalid size falls back to default 20
    const invalidBadge = renderBadge("open source", "1 contribution", false, { size: "invalid" });
    expect(invalidBadge).toContain('height="20"');
  });
});
