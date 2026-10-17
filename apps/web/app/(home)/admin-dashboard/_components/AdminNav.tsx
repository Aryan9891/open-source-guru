"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/constants";

const items = [
  { href: ROUTES.admin.overview, label: "Overview" },
  { href: ROUTES.admin.users, label: "Users" },
  { href: ROUTES.admin.repositories, label: "Repositories" },
  { href: ROUTES.admin.labels, label: "Labels" },
] as const;

/** Admin sidebar; a row of tabs above the content on narrow screens. */
export function AdminNav({
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
          // biome-ignore lint/performance/noImgElement: small external avatar
          <img src={image} alt="" width={40} height={40} className="size-10 rounded-full" />
        ) : (
          <span className="size-10 rounded-full bg-surface-muted" />
        )}
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{name || login}</span>
          <span className="w-fit rounded-full bg-highlight px-2 py-0.5 text-xs font-semibold text-highlight-foreground">
            Admin
          </span>
        </div>
      </div>

      <nav aria-label="Admin">
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
        <Link
          href={ROUTES.dashboard.feed}
          className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          ← Back to your dashboard
        </Link>
      </div>
    </aside>
  );
}
