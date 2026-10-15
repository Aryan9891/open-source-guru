"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { buttonClasses } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants";

/** Hero buttons: "Sign in with GitHub" for visitors, "Go to your dashboard" once signed in. */
export function HeroActions({ shortText }: { shortText?: boolean }) {
  const { state } = useAuth();

  const signInText = shortText ? "Sign in" : "Sign in with GitHub";

  return (
    <div className="flex flex-wrap gap-3">
      {state.status === "loading" && <span aria-hidden="true" className="inline-block h-12 w-52" />}
      {state.status === "signed-out" && (
        <Link href={ROUTES.signIn} className={buttonClasses({ size: "lg" })}>
          {signInText}
        </Link>
      )}
      {state.status === "signed-in" && (
        <Link href={ROUTES.dashboard.feed} className={buttonClasses({ size: "lg" })}>
          Go to your dashboard
        </Link>
      )}
      <Link href={ROUTES.docs} className={buttonClasses({ size: "lg", variant: "secondary" })}>
        Read the docs
      </Link>
    </div>
  );
}
