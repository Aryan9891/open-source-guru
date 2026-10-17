import type { Metadata } from "next";
import { AdminOverview } from "./_components/AdminOverview";
import { PageHeader } from "./_components/PageHeader";

export const metadata: Metadata = { title: "Overview" };

export default function AdminOverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Admin">Everything happening on Open Source Guru, at a glance.</PageHeader>
      <AdminOverview />
    </div>
  );
}
