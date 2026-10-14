"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { buttonClasses } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants";

export function SignOutButton() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function onClick() {
    setSigningOut(true);
    await signOut();
    router.push(ROUTES.home);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={signingOut}
      className={buttonClasses({ variant: "ghost", className: "w-full justify-start" })}
    >
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
