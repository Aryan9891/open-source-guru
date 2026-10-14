import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Logo } from "@/components/Logo";
import { ROUTES } from "./constants";
import { githubRepoUrl } from "./shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Logo />,
    },
    githubUrl: githubRepoUrl,
    links: [
      { text: "Docs", url: ROUTES.docs, active: "nested-url" },
      { type: "button", text: "Sign in", url: ROUTES.signIn, on: "nav" },
    ],
  };
}
