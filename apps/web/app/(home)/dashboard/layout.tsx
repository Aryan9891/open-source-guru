import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { ROUTES } from "@/lib/constants";
import { getCurrentUser } from "@/lib/session";
import { DashboardNav } from "./_components/DashboardNav";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | Dashboard | Open Source Guru" },
};

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-muted" />}>
        <DashboardGate>{children}</DashboardGate>
      </Suspense>
    </div>
  );
}

/** Reads the session (request-time): signed-out visitors go to sign-in. */
async function DashboardGate({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.signIn);

  return (
    <div className="flex flex-wrap gap-8">
      <DashboardNav login={user.login} name={user.name} image={user.image} />
      <main className="min-w-0 flex-[999_1_560px]">{children}</main>
    </div>
  );
}
