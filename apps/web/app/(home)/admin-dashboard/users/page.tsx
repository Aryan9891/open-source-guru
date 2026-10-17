import type { Metadata } from "next";
import { PageHeader } from "../_components/PageHeader";
import { UsersView } from "../_components/UsersView";

export const metadata: Metadata = { title: "Users" };

export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Users">
        Everyone who signed in with GitHub. Admins can grant the admin role to others.
      </PageHeader>
      <UsersView />
    </div>
  );
}
