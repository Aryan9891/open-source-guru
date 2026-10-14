"use client";

import { type SubmitEvent, useCallback, useEffect, useId, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";

interface Channel {
  id: string;
  type: string;
  label: string;
  address: string;
  status: "pending" | "active" | "disabled";
  disabledReason: string | null;
}

function statusText(channel: Channel): string {
  if (channel.status === "active") return "Active";
  if (channel.status === "pending") return "Waiting for confirmation";
  if (channel.disabledReason === "bounced") return "Disabled: emails to it bounced";
  if (channel.disabledReason === "unsubscribed") return "Disabled: you unsubscribed";
  return "Disabled";
}

/** Addresses notifications can go to: add, confirm, remove. */
export function EmailAddresses() {
  const ids = { address: useId(), label: useId() };
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [confirmingRemoval, setConfirmingRemoval] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setChannels(await apiFetch<Channel[]>("/v1/me/channels"));
    } catch (error) {
      setMessage({ ok: false, text: (error as Error).message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ ok: true, text: success });
      await load();
    } catch (error) {
      setMessage({ ok: false, text: (error as Error).message });
    } finally {
      setBusy(false);
      setConfirmingRemoval(null);
    }
  }

  function add(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = address.trim();
    void run(async () => {
      await apiFetch("/v1/me/channels", {
        method: "POST",
        body: { address: trimmed, ...(label.trim() && { label: label.trim() }) },
      });
      setAddress("");
      setLabel("");
    }, `We sent a confirmation link to ${trimmed}. Nothing is sent there until you click it.`);
  }

  return (
    <div className="flex flex-col gap-5">
      {channels === null ? (
        <div aria-busy="true" className="h-20 animate-pulse rounded-md bg-surface-muted" />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {channels.map((channel) => (
            <li key={channel.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{channel.address}</span>
                <span className="text-sm text-muted">
                  {channel.label} · {statusText(channel)}
                </span>
              </div>
              {confirmingRemoval === channel.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">Remove? Subscriptions stop emailing it.</span>
                  <button
                    type="button"
                    onClick={() => setConfirmingRemoval(null)}
                    className={buttonClasses({ variant: "ghost" })}
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => apiFetch(`/v1/me/channels/${channel.id}`, { method: "DELETE" }),
                        `${channel.address} removed.`,
                      )
                    }
                    className={buttonClasses({ variant: "danger" })}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {channel.status === "pending" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            apiFetch(`/v1/me/channels/${channel.id}/resend-verification`, {
                              method: "POST",
                            }),
                          `Confirmation link sent again to ${channel.address}.`,
                        )
                      }
                      className={buttonClasses({ variant: "secondary" })}
                    >
                      Resend confirmation
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmingRemoval(channel.id)}
                    className={buttonClasses({ variant: "ghost", className: "text-danger" })}
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p
        role="status"
        className={`text-sm empty:hidden ${message?.ok === false ? "text-danger" : "text-muted"}`}
      >
        {message?.text ?? ""}
      </p>

      <form onSubmit={add} className="flex flex-col gap-3 rounded-lg bg-surface-muted p-4">
        <p className="text-sm font-semibold">Add an email address</p>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <label htmlFor={ids.address} className="flex flex-col gap-1 text-sm">
            Address
            <input
              id={ids.address}
              type="email"
              required
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              autoComplete="email"
              className="min-h-11 rounded-md border-2 border-border bg-background px-3 focus:border-accent focus:outline-none"
            />
          </label>
          <label htmlFor={ids.label} className="flex flex-col gap-1 text-sm">
            Name (optional)
            <input
              id={ids.label}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Work"
              className="min-h-11 rounded-md border-2 border-border bg-background px-3 placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </label>
          <button type="submit" disabled={busy} className={buttonClasses()}>
            Add
          </button>
        </div>
        <p className="text-sm text-muted">
          To use a disabled address again, remove it, then add it back and confirm it.
        </p>
      </form>
    </div>
  );
}
