import { HomeLayout } from "fumadocs-ui/layouts/home";
import { Suspense } from "react";
import { baseOptions } from "@/lib/layout.shared";

/**
 * Public profiles: the site's usual layout, inside <Suspense>. Its nav reads the pathname,
 * which isn't known before the request on /u/[login] (any login), so it can't be prerendered.
 */
export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <HomeLayout {...baseOptions()}>{children}</HomeLayout>
    </Suspense>
  );
}
