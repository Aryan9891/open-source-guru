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
  const {
    state: { status },
  } = useAuth();

  if (status === "loading") {
    return (
      <span
        className={
          variant === "button" ? buttonClasses({ className: "min-h-9 min-w-28 px-4" }) : "w-28"
        }
      >
        Loading...
      </span>
    );
  }

  const signedIn = status === "signed-in";
  const href = signedIn ? ROUTES.dashboard.feed : ROUTES.signIn;
  const text = signedIn ? "Dashboard" : "Sign in";

  if (variant === "link") {
    return (
      <Link href={href} className="hover:text-foreground min-w-28">
        {text}
      </Link>
    );
  }
  return (
    <Link href={href} className={buttonClasses({ className: "min-h-9 px-4 min-w-28" })}>
      {text}
    </Link>
  );
}
