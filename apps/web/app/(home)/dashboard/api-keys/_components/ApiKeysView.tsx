"use client";

import { useCallback, useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import { CreateApiKey } from "./CreateApiKey";

interface ApiKey {
  id: string;
  name: string | null;
  start: string | null;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
const formatDate = (iso: string) => dateFormat.format(new Date(iso));

function expiryText(key: ApiKey): string {
  if (!key.expiresAt) return "Never expires";
  const expired = new Date(key.expiresAt).getTime() <= Date.now();
  return `${expired ? "Expired" : "Expires"} ${formatDate(key.expiresAt)}`;
}

/** Personal API keys: create, list, revoke; plus how to use them. */
export function ApiKeysView() {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("https://<this site>");

  const load = useCallback(async () => {
    try {
      setKeys(await apiFetch<ApiKey[]>("/v1/me/api-keys"));
    } catch (caught) {
      setError((caught as Error).message);
    }
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
  }, [load]);

  async function revoke(id: string) {
    setError(null);
    try {
      await apiFetch(`/v1/me/api-keys/${id}`, { method: "DELETE" });
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setConfirming(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <CreateApiKey onCreated={() => void load()} />

      <p role="alert" className="text-sm text-danger empty:hidden">
        {error ?? ""}
      </p>

      {keys === null ? (
        <div aria-busy="true" className="h-24 animate-pulse rounded-lg bg-surface-muted" />
      ) : keys.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-subtle">
          You don't have any API keys yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {keys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-semibold">
                  {key.name ?? "Unnamed key"}{" "}
                  {key.start && <span className="font-mono text-sm text-muted">{key.start}…</span>}
                </span>
                <span className="text-sm text-muted">
                  Created {formatDate(key.createdAt)} ·{" "}
                  {key.lastUsedAt ? `Last used ${formatDate(key.lastUsedAt)}` : "Never used"} ·{" "}
                  {expiryText(key)}
                </span>
              </div>
              {confirming === key.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">Revoke? Anything using it stops working.</span>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className={buttonClasses({ variant: "ghost" })}
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    onClick={() => void revoke(key.id)}
                    className={buttonClasses({ variant: "danger" })}
                  >
                    Revoke
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(key.id)}
                  className={buttonClasses({ variant: "ghost", className: "text-danger" })}
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-extrabold">Using a key</h2>
        <p className="text-sm text-subtle">
          Send it in the <code className="font-mono">Authorization</code> header. A key acts as you
          for subscriptions, email addresses and your feed. It can't create other keys or delete
          your account.
        </p>
        <pre className="overflow-x-auto rounded-lg bg-plum p-4 font-mono text-sm text-petal">
          <code>
            curl {origin}/api/v1/me/subscriptions \{"\n"}
            {"  "}-H "Authorization: Bearer $OSG_KEY"
          </code>
        </pre>
      </section>
    </div>
  );
}
