import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Logo } from "@/components/Logo";
import { docsRoute, githubRepoUrl, signInRoute } from "./shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Logo />,
    },
    githubUrl: githubRepoUrl,
    links: [
      { text: "Docs", url: docsRoute, active: "nested-url" },
      { type: "button", text: "Sign in", url: signInRoute, on: "nav" },
    ],
  };
}
