import type { Metadata } from "next";
import { PageHeader } from "../_components/PageHeader";
import { RepositoriesView } from "../_components/RepositoriesView";

export const metadata: Metadata = { title: "Repositories" };

export default function AdminRepositoriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Repositories">
        Repositories people follow (polled for issues), and those only known from contributions.
      </PageHeader>
      <RepositoriesView />
    </div>
  );
}
