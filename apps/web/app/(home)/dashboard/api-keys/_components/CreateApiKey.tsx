"use client";

import { type SubmitEvent, useId, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";

const EXPIRY_OPTIONS = [
  { value: "", label: "Never" },
  { value: "30", label: "In 30 days" },
  { value: "90", label: "In 90 days" },
  { value: "365", label: "In 1 year" },
];

const fieldClasses =
  "min-h-11 rounded-md border-2 border-border bg-background px-3 text-sm focus:border-accent focus:outline-none";

/** Creates a key, then shows it once with a copy button. */
export function CreateApiKey({ onCreated }: { onCreated: () => void }) {
  const ids = { name: useId(), expiry: useId() };
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function create(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ name: string; key: string }>("/v1/me/api-keys", {
        method: "POST",
        body: { name: name.trim(), ...(expiry && { expiresInDays: Number(expiry) }) },
      });
      setCreated(result);
      setCopied(false);
      setName("");
      setExpiry("");
      onCreated();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!created) return;
    await navigator.clipboard.writeText(created.key);
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {created && (
        <div role="status" className="flex flex-col gap-3 rounded-lg border-2 border-highlight p-4">
          <p className="font-semibold">
            Your new key "{created.name}". Copy it now: it won't be shown again.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <code className="flex-1 overflow-x-auto rounded-md bg-surface-muted px-3 py-2.5 font-mono text-sm">
              {created.key}
            </code>
            <button type="button" onClick={() => void copy()} className={buttonClasses()}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCreated(null)}
            className={buttonClasses({ variant: "ghost", className: "self-end" })}
          >
            I've stored it safely
          </button>
        </div>
      )}

      <form onSubmit={create} className="flex flex-col gap-3 rounded-lg bg-surface-muted p-4">
        <p className="text-sm font-semibold">Create a key</p>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <label htmlFor={ids.name} className="flex flex-col gap-1 text-sm">
            Name
            <input
              id={ids.name}
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="My script"
              className={`${fieldClasses} placeholder:text-muted`}
            />
          </label>
          <label htmlFor={ids.expiry} className="flex flex-col gap-1 text-sm">
            Expires
            <select
              id={ids.expiry}
              value={expiry}
              onChange={(event) => setExpiry(event.target.value)}
              className={fieldClasses}
            >
              {EXPIRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy || name.trim() === ""} className={buttonClasses()}>
            {busy ? "Creating…" : "Create key"}
          </button>
        </div>
        <p role="alert" className="text-sm text-danger empty:hidden">
          {error ?? ""}
        </p>
      </form>
    </div>
  );
}
