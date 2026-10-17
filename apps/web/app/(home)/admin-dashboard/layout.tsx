import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { ROUTES } from "@/lib/constants";
import { getCurrentUser } from "@/lib/session";
import { AdminNav } from "./_components/AdminNav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin | Open Source Guru" },
  robots: { index: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin-dashboard">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-muted" />}>
        <AdminGate>{children}</AdminGate>
      </Suspense>
    </div>
  );
}

/**
 * Reads the session (request-time): signed-out visitors go to sign-in, and anyone who isn't an
 * admin gets a 404, so the page doesn't reveal it exists. The API checks the role again.
 */
async function AdminGate({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.signIn);
  if (user.role !== "admin") notFound();

  return (
    <div className="flex flex-wrap gap-8">
      <AdminNav login={user.login} name={user.name} image={user.image} />
      <main className="min-w-0 flex-[999_1_560px]">{children}</main>
    </div>
  );
}
