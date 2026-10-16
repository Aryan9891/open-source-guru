"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { buttonClasses } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants";

/** Hero buttons: "Sign in with GitHub" for visitors, "Go to your dashboard" once signed in. */
export function HeroActions({ shortText }: { shortText?: boolean }) {
  const {
    state: { status },
  } = useAuth();

  const signInText = shortText ? "Sign in" : "Sign in with GitHub";

  return (
    <div className="flex flex-wrap gap-3">
      {status === "loading" && (
        <span className={buttonClasses({ size: "lg", className: "min-w-32" })}>Loading...</span>
      )}
      {status === "signed-out" && (
        <Link href={ROUTES.signIn} className={buttonClasses({ size: "lg", className: "min-w-32" })}>
          {signInText}
        </Link>
      )}
      {status === "signed-in" && (
        <Link
          href={ROUTES.dashboard.feed}
          className={buttonClasses({ size: "lg", className: "min-w-32" })}
        >
          Dashboard
        </Link>
      )}
      <Link href={ROUTES.docs} className={buttonClasses({ size: "lg", variant: "secondary" })}>
        Read the docs
      </Link>
    </div>
  );
}
