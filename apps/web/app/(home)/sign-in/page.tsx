import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LogoMark } from "@/components/Logo";
import { ROUTES } from "@/lib/constants";
import { readPendingSubscription, withPendingSubscription } from "@/lib/pending-subscription";
import { getCurrentUser } from "@/lib/session";
import { appName } from "@/lib/shared";
import { SignInButton } from "./_components/SignInButton";

export const metadata: Metadata = {
  title: "Sign in",
  description: `Sign in to ${appName} with your GitHub account.`,
};

/** Friendly messages for the error codes Better Auth and GitHub send back. */
const errorMessages: Record<string, string> = {
  access_denied: "You cancelled the authorization on GitHub. You can try again whenever you like.",
  email_not_found:
    "We couldn't read your email address from GitHub, and we need it to send you notifications. Check that you have a verified email on GitHub, then try again.",
  state_mismatch:
    "The sign-in took too long or was started in another tab. Please try again from here.",
  please_restart_the_process:
    "The sign-in took too long or was started in another tab. Please try again from here.",
};
const defaultErrorMessage = "Something went wrong while signing in with GitHub. Please try again.";

export default function SignInPage(props: PageProps<"/sign-in">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <LogoMark size={56} />
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Sign in to {appName}
          </h1>
          <p className="text-subtle">
            Use your GitHub account. We read your public profile and your email address, which is
            where your notifications go. We never post anything on your behalf.
          </p>
        </div>
        <Suspense fallback={<div className="h-12 animate-pulse rounded-full bg-surface-muted" />}>
          <SignInPanel searchParams={props.searchParams} />
        </Suspense>
        <p className="text-center text-sm text-muted">
          No GitHub account?{" "}
          <Link
            href="https://github.com/signup"
            className="font-semibold text-primary hover:text-accent"
            target="_blank"
          >
            Create one on GitHub
          </Link>
          , then come back here.
        </p>
      </div>
    </main>
  );
}

/** Reads the request (session and URL), so it renders inside <Suspense>. */
async function SignInPanel({
  searchParams,
}: {
  searchParams: PageProps<"/sign-in">["searchParams"];
}) {
  const params = await searchParams;
  const pending = readPendingSubscription(params);

  if (await getCurrentUser()) redirect(withPendingSubscription(ROUTES.dashboard.feed, pending));

  const error = typeof params.error === "string" ? params.error : null;
  const redirects = {
    callbackURL: withPendingSubscription(ROUTES.dashboard.feed, pending),
    newUserCallbackURL: withPendingSubscription(ROUTES.onboarding, pending),
    errorCallbackURL: withPendingSubscription(ROUTES.signIn, pending),
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-md bg-surface-muted px-4 py-3 text-sm">
          {errorMessages[error] ?? defaultErrorMessage}
        </p>
      )}
      {pending && (
        <div className="rounded-md border border-border bg-background px-4 py-3 text-sm">
          <p className="text-muted">After signing in, you'll follow</p>
          <p className="font-mono font-semibold text-accent">{pending.repo}</p>
          {pending.labels.length > 0 && (
            <p className="text-subtle">Labels: {pending.labels.join(", ")}</p>
          )}
        </div>
      )}
      <SignInButton redirects={redirects} />
    </div>
  );
}
