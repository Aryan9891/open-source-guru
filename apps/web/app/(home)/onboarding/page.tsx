import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ROUTES } from "@/lib/constants";
import { readPendingSubscription, withPendingSubscription } from "@/lib/pending-subscription";
import { getCurrentUser } from "@/lib/session";
import { OnboardingForm } from "./_components/OnboardingForm";

export const metadata: Metadata = { title: "Welcome" };

export default function OnboardingPage(props: PageProps<"/onboarding">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-muted" />}>
        <OnboardingGate searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

/** Reads the session and URL (request-time), so it renders inside <Suspense>. */
async function OnboardingGate({
  searchParams,
}: {
  searchParams: PageProps<"/onboarding">["searchParams"];
}) {
  const pending = readPendingSubscription(await searchParams);
  const user = await getCurrentUser();
  if (!user) redirect(withPendingSubscription(ROUTES.signIn, pending));

  return <OnboardingForm user={user} pending={pending} />;
}
