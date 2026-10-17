import type { Metadata } from "next";
import { LabelsView } from "../_components/LabelsView";
import { PageHeader } from "../_components/PageHeader";

export const metadata: Metadata = { title: "Labels" };

export default function AdminLabelsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Labels">
        Labels subscriptions filter on, across every repository. Matching ignores case.
      </PageHeader>
      <LabelsView />
    </div>
  );
}
