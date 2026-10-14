import type { Metadata } from "next";
import { SubscriptionsView } from "./_components/SubscriptionsView";

export const metadata: Metadata = { title: "Subscriptions" };

export default function SubscriptionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Subscriptions</h1>
        <p className="text-subtle">The repositories you follow, and the labels you care about.</p>
      </header>
      <SubscriptionsView />
    </div>
  );
}
