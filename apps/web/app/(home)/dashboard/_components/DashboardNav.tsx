"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { SignOutButton } from "./SignOutButton";

const items = [
  { href: ROUTES.dashboard.feed, label: "Feed" },
  { href: ROUTES.dashboard.subscriptions, label: "Subscriptions" },
  { href: ROUTES.dashboard.settings, label: "Settings" },
  { href: ROUTES.dashboard.apiKeys, label: "API keys" },
] as const;

/** Dashboard sidebar; a row of tabs above the content on narrow screens. */
export function DashboardNav({
  login,
  name,
  image,
}: {
  login: string;
  name: string;
  image: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-full flex-col gap-6 md:w-56 md:flex-[1_1_14rem]">
      <div className="flex items-center gap-3">
        {image ? (
          // Avatars come from GitHub's CDN; a plain <img> avoids configuring remote images.
          // biome-ignore lint/performance/noImgElement: small external avatar
          <img src={image} alt="" width={40} height={40} className="size-10 rounded-full" />
        ) : (
          <span className="size-10 rounded-full bg-surface-muted" />
        )}
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{name || login}</span>
          <span className="truncate font-mono text-sm text-muted">@{login}</span>
        </div>
      </div>

      <nav aria-label="Dashboard">
        <ul className="flex gap-1 overflow-x-auto md:flex-col">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-10 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-subtle hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border pt-4">
        <SignOutButton />
      </div>
    </aside>
  );
}
