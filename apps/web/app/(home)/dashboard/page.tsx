import type { Metadata } from "next";
import { FeedView } from "./_components/FeedView";

export const metadata: Metadata = { title: "Feed" };

export default function FeedPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Your feed</h1>
        <p className="text-subtle">Issues that matched your subscriptions, newest first.</p>
      </header>
      <FeedView />
    </div>
  );
}
