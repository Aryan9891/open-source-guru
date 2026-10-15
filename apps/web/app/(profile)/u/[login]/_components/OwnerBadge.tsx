"use client";

import { BadgeSnippet } from "@/components/account/BadgeSnippet";
import { useAuth } from "@/components/auth/AuthProvider";

/** On your own profile only: the README badge to copy. */
export function OwnerBadge({ login }: { login: string }) {
  const { state } = useAuth();
  if (state.user?.login.toLowerCase() !== login.toLowerCase()) return null;
  return (
    <section className="rounded-lg border border-dashed border-border bg-surface p-5">
      <BadgeSnippet login={state.user.login} />
    </section>
  );
}
