import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type FeedEntry, FeedItem, timeAgo } from "./FeedItem";

const mockEntry: FeedEntry = {
  eventId: "event-1",
  type: "issue.opened",
  label: null,
  occurredAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  repo: {
    fullName: "tem-ctrl/open-source-guru",
    url: "https://github.com/tem-ctrl/open-source-guru",
  },
  issue: {
    number: 26,
    title: "bug: open issues in a new tab",
    url: "https://github.com/tem-ctrl/open-source-guru/issues/26",
    state: "open",
    labels: ["bug", "good first issue", "help wanted"],
    assignees: [],
  },
};

describe("FeedItem", () => {
  it("renders issue link with target=_blank and rel=noopener noreferrer", () => {
    const html = renderToStaticMarkup(createElement(FeedItem, { entry: mockEntry }));

    expect(html).toContain('href="https://github.com/tem-ctrl/open-source-guru/issues/26"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("#26 bug: open issues in a new tab");
  });

  it("renders repository link with target=_blank and rel=noopener noreferrer", () => {
    const html = renderToStaticMarkup(createElement(FeedItem, { entry: mockEntry }));

    expect(html).toContain('href="https://github.com/tem-ctrl/open-source-guru"');
    expect(html).toContain("tem-ctrl/open-source-guru");
  });

  it("renders labels and 'Not assigned yet' when issue is open with no assignees", () => {
    const html = renderToStaticMarkup(createElement(FeedItem, { entry: mockEntry }));

    expect(html).toContain("Not assigned yet");
    expect(html).toContain("bug");
    expect(html).toContain("good first issue");
    expect(html).toContain("help wanted");
    expect(html).toContain("New issue");
  });

  it("renders assigned users when issue has assignees", () => {
    const assignedEntry: FeedEntry = {
      ...mockEntry,
      type: "issue.labeled",
      label: "help wanted",
      issue: {
        ...mockEntry.issue,
        assignees: ["alice", "bob"],
      },
    };
    const html = renderToStaticMarkup(createElement(FeedItem, { entry: assignedEntry }));

    expect(html).toContain("Assigned to alice, bob");
    expect(html).toContain("Labeled help wanted");
  });

  it("renders closed status and muted styling when issue is closed", () => {
    const closedEntry: FeedEntry = {
      ...mockEntry,
      issue: {
        ...mockEntry.issue,
        state: "closed",
      },
    };
    const html = renderToStaticMarkup(createElement(FeedItem, { entry: closedEntry }));

    expect(html).toContain("Closed");
    expect(html).toContain("opacity-70");
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-10-17T12:00:00Z").getTime();

  it("formats seconds as just now", () => {
    expect(timeAgo(new Date("2026-10-17T11:59:45Z").toISOString(), now)).toBe("just now");
  });

  it("formats minutes ago", () => {
    expect(timeAgo(new Date("2026-10-17T11:50:00Z").toISOString(), now)).toBe("10 minutes ago");
  });

  it("formats hours ago", () => {
    expect(timeAgo(new Date("2026-10-17T09:00:00Z").toISOString(), now)).toBe("3 hours ago");
  });

  it("formats days ago", () => {
    expect(timeAgo(new Date("2026-10-15T12:00:00Z").toISOString(), now)).toBe("2 days ago");
  });
});
