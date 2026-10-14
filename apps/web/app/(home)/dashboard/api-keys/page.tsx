import type { Metadata } from "next";
import { ApiKeysView } from "./_components/ApiKeysView";

export const metadata: Metadata = { title: "API keys" };

export default function ApiKeysPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">API keys</h1>
        <p className="text-subtle">
          Personal keys to use the API from your own scripts and tools. You can have up to 10.
        </p>
      </header>
      <ApiKeysView />
    </div>
  );
}
