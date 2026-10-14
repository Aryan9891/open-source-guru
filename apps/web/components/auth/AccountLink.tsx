"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants";
import { useAuth } from "./AuthProvider";

/**
 * "Sign in" for visitors, "Dashboard" for signed-in users. While the session is being read,
 * an empty placeholder of the same size keeps the layout from jumping.
 */
export function AccountLink({ variant }: { variant: "button" | "link" }) {
  const { state } = useAuth();

  if (state.status === "loading") {
    return (
      <span
        aria-hidden="true"
        className={variant === "button" ? "inline-block h-9 w-24" : "inline-block w-16"}
      />
    );
  }

  const signedIn = state.status === "signed-in";
  const href = signedIn ? ROUTES.dashboard.feed : ROUTES.signIn;
  const text = signedIn ? "Dashboard" : "Sign in";

  if (variant === "link") {
    return (
      <Link href={href} className="hover:text-foreground">
        {text}
      </Link>
    );
  }
  return (
    <Link href={href} className={buttonClasses({ className: "min-h-9 px-4" })}>
      {text}
    </Link>
  );
}
