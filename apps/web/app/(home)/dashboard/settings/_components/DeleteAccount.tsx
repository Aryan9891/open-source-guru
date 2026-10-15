"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { buttonClasses } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";

/** Deletes the account after the user types their GitHub login. */
export function DeleteAccount() {
  const router = useRouter();
  const { state, signOut } = useAuth();
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const login = state.user?.login ?? "";

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      await apiFetch("/v1/me", { method: "DELETE" });
      await signOut();
      router.push(ROUTES.home);
    } catch (caught) {
      setError((caught as Error).message);
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-subtle">
        This deletes your account, public profile, subscriptions, email addresses, contributions,
        goals and API keys, and stops every email. It can't be undone. Your GitHub account isn't
        affected.
      </p>
      <label htmlFor={inputId} className="flex flex-col gap-1 text-sm">
        <span>
          Type your GitHub login, <strong className="font-mono">{login}</strong>, to confirm
        </span>
        <input
          id={inputId}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="min-h-11 rounded-md border-2 border-border bg-background px-3 font-mono focus:border-danger focus:outline-none sm:max-w-xs"
        />
      </label>
      <p role="alert" className="text-sm text-danger empty:hidden">
        {error ?? ""}
      </p>
      <button
        type="button"
        onClick={() => void remove()}
        disabled={deleting || login === "" || typed.trim() !== login}
        className={buttonClasses({ variant: "danger", className: "self-start" })}
      >
        {deleting ? "Deleting…" : "Delete my account"}
      </button>
    </div>
  );
}
