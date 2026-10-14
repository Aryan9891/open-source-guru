import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { AccountLink } from "@/components/auth/AccountLink";
import { GitHubStars } from "@/components/GitHubStars";
import { Logo } from "@/components/Logo";
import { ROUTES } from "./constants";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Logo />,
    },
    links: [
      { text: "Docs", url: ROUTES.docs, active: "nested-url" },
      // Right-hand side of the nav bar: GitHub (with stars), then Sign in / Dashboard.
      { type: "custom", secondary: true, children: <GitHubStars /> },
      { type: "custom", on: "nav", secondary: true, children: <AccountLink variant="button" /> },
    ],
  };
}
