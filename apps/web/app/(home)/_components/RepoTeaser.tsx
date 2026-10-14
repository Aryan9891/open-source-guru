"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { RepoLabelPicker } from "@/components/subscriptions/RepoLabelPicker";
import { useRepoLabels } from "@/components/subscriptions/use-repo-labels";
import { buttonClasses } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants";
import { withPendingSubscription } from "@/lib/pending-subscription";

/**
 * Hero form: pick a repository and labels, then sign in to be notified.
 * The choice travels to the sign-in page in the URL, so it survives the GitHub round trip.
 */
export function RepoTeaser() {
  const router = useRouter();
  const { state: auth } = useAuth();
  const picker = useRepoLabels();
  const { status, selected } = picker;

  function continueToSignIn() {
    if (status.kind !== "ready") return;
    // Signed-in users skip the sign-in page; the dashboard creates the subscription.
    const target = auth.status === "signed-in" ? ROUTES.dashboard.feed : ROUTES.signIn;
    router.push(withPendingSubscription(target, { repo: status.repo, labels: [...selected] }));
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <RepoLabelPicker picker={picker} />
      {status.kind === "ready" && status.labels.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {selected.size === 0
              ? "Pick at least one label."
              : `We'll email you about new issues labeled ${[...selected].join(", ")}.`}
          </p>
          <button
            type="button"
            onClick={continueToSignIn}
            disabled={selected.size === 0}
            className={buttonClasses({ size: "lg" })}
          >
            Notify me
          </button>
        </div>
      )}
    </div>
  );
}
