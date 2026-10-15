import type { Metadata } from "next";
import { GoalsView } from "./_components/GoalsView";

export const metadata: Metadata = { title: "Goals" };

export default function GoalsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Goals</h1>
        <p className="text-subtle">
          Targets for your Open Source Contributions, updated after each sync. Weeks run Sunday to
          Saturday.
        </p>
      </header>
      <GoalsView />
    </div>
  );
}
