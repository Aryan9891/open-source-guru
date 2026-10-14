import Link from "next/link";

// Placeholder landing page; the real one (pitch, teaser form, sign-in) comes in Phase 1b.
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold">open-source-guru</h1>
      <p className="max-w-xl text-fd-muted-foreground">
        Get notified when issues you can help with appear in the open-source repos you follow, and
        track your Open Source Contributions.
      </p>
      <Link href="/docs" className="font-medium underline">
        Read the docs
      </Link>
    </main>
  );
}
