"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { buttonClasses } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ROUTES } from "@/lib/constants";

export function SignOutButton() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function confirm() {
    setSigningOut(true);
    await signOut();
    router.push(ROUTES.home);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={signingOut}
        className={buttonClasses({ variant: "ghost", className: "w-full justify-start" })}
      >
        Sign out
      </button>
      <ConfirmDialog
        open={confirming}
        title="Sign out?"
        confirmLabel={signingOut ? "Signing out…" : "Sign out"}
        busy={signingOut}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(false)}
      >
        You'll need to sign in with GitHub again to see your dashboard. Your API keys keep working.
      </ConfirmDialog>
    </>
  );
}
