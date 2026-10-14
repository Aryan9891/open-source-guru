"use client";

import { useEffect, useState } from "react";
import { EmailSettings } from "@/components/account/EmailSettings";
import { useAuth } from "@/components/auth/AuthProvider";
import { buttonClasses } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";

/** Time zone and daily digest hour. */
export function DeliverySettings() {
  const { state, refresh } = useAuth();
  const user = state.user;
  const [timezone, setTimezone] = useState("UTC");
  const [digestHour, setDigestHour] = useState(8);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    setTimezone(user.timezone);
    setDigestHour(user.digestHour);
  }, [user]);

  if (!user)
    return <div aria-busy="true" className="h-24 animate-pulse rounded-md bg-surface-muted" />;

  const unchanged = timezone === user.timezone && digestHour === user.digestHour;

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await apiFetch("/v1/me", { method: "PATCH", body: { timezone, digestHour } });
      await refresh();
      setMessage({ ok: true, text: "Saved." });
    } catch (error) {
      setMessage({ ok: false, text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <EmailSettings
        timezone={timezone}
        digestHour={digestHour}
        onTimezoneChange={setTimezone}
        onDigestHourChange={setDigestHour}
      />
      <div className="flex flex-wrap items-center justify-end gap-3">
        <p
          role="status"
          className={`text-sm empty:hidden ${message?.ok === false ? "text-danger" : "text-muted"}`}
        >
          {message?.text ?? ""}
        </p>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || unchanged}
          className={buttonClasses()}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
