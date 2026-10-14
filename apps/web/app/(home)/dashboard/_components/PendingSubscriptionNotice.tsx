"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { readPendingSubscription } from "@/lib/pending-subscription";

interface Subscription {
  repo: { fullName: string };
}

type Notice = { kind: "working" | "created" | "exists" | "error"; text: string };

/**
 * A returning user who picked a repository on the landing page arrives with
 * `?repo=…&label=…`: create that subscription (unless they already follow the repo),
 * say so, and clean up the URL.
 */
export function PendingSubscriptionNotice({ onCreated }: { onCreated: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handled = useRef(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const pending = readPendingSubscription({
      repo: searchParams.get("repo") ?? undefined,
      label: searchParams.getAll("label"),
    });
    if (!pending || handled.current) return;
    // Runs once, even when React mounts effects twice in development.
    handled.current = true;
    const { repo, labels } = pending;
    setNotice({ kind: "working", text: `Following ${repo}…` });

    void (async () => {
      try {
        const existing = await apiFetch<Subscription[]>("/v1/me/subscriptions");
        if (existing.some((sub) => sub.repo.fullName.toLowerCase() === repo.toLowerCase())) {
          setNotice({
            kind: "exists",
            text: `You already follow ${repo}. Edit it in your subscriptions to change its labels.`,
          });
        } else {
          await apiFetch("/v1/me/subscriptions", { method: "POST", body: { repo, labels } });
          setNotice({
            kind: "created",
            text: `You're now following ${repo}${labels.length > 0 ? ` (${labels.join(", ")})` : ""}. We'll email you about new matching issues.`,
          });
          onCreated();
        }
      } catch (error) {
        setNotice({
          kind: "error",
          text: `We couldn't follow ${repo}: ${(error as Error).message}`,
        });
      } finally {
        router.replace(pathname);
      }
    })();
  }, [searchParams, router, pathname, onCreated]);

  if (!notice) return null;
  return (
    <p
      role={notice.kind === "error" ? "alert" : "status"}
      className={`rounded-lg px-4 py-3 text-sm ${
        notice.kind === "created"
          ? "bg-highlight text-highlight-foreground"
          : notice.kind === "error"
            ? "bg-surface-muted text-danger"
            : "bg-surface-muted"
      }`}
    >
      {notice.text}
    </p>
  );
}
