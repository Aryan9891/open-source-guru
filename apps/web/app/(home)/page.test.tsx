import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import HomePage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({
    state: { status: "signed-out", user: null },
    refresh: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("@/components/subscriptions/use-repo-labels", () => ({
  useRepoLabels: () => ({
    status: { kind: "idle" },
    selected: new Set(),
    load: vi.fn(),
    toggle: vi.fn(),
  }),
}));

describe("HomePage", () => {
  it("renders the footer with View it on GitHub opening in a new tab", () => {
    const html = renderToStaticMarkup(createElement(HomePage));

    expect(html).toContain('href="https://github.com/tem-ctrl/open-source-guru"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("View it on GitHub");
  });

  it("renders footer navigation links to docs and authentication", () => {
    const html = renderToStaticMarkup(createElement(HomePage));

    expect(html).toContain('href="/docs"');
    expect(html).toContain("Docs");
    expect(html).toContain("Sign in");
  });

  it("renders the hero heading and explanation", () => {
    const html = renderToStaticMarkup(createElement(HomePage));

    expect(html).toContain("Your next good first issue is waiting.");
    expect(html).toContain("Three steps, then it runs on its own");
  });
});
