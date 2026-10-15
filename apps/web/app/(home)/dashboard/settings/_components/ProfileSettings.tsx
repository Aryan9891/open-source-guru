"use client";

import { useState } from "react";
import { ProfileVisibility } from "@/components/account/ProfileVisibility";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch } from "@/lib/api-client";

/** Saved as soon as it's switched: turning the profile off takes effect immediately. */
export function ProfileSettings() {
  const { state, refresh } = useAuth();
  const user = state.user;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return <div aria-busy="true" className="h-16 animate-pulse rounded-md bg-surface-muted" />;
  }

  async function change(profilePublic: boolean) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/v1/me", { method: "PATCH", body: { profilePublic } });
      await refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <ProfileVisibility
        login={user.login}
        value={user.profilePublic}
        disabled={saving}
        onChange={(value) => void change(value)}
      />
      <p role="alert" className="text-sm text-danger empty:hidden">
        {error ?? ""}
      </p>
    </div>
  );
}
