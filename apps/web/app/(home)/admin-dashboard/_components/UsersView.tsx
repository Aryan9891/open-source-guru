"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAdminList } from "@/hooks/use-admin-list";
import type { AdminUser, UserRole } from "@/lib/admin";
import { apiFetch } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";
import { formatNumber, formatShortDate } from "@/lib/contributions";
import { AdminTable, EmptyRow } from "./AdminTable";
import { FilterTabs } from "./FilterTabs";
import { Pagination } from "./Pagination";
import { SearchBox } from "./SearchBox";

const HEAD = ["User", "Email", "Subscriptions", "Joined", "Role"];
const FILTERS: { value: UserRole | undefined; label: string }[] = [
  { value: undefined, label: "Everyone" },
  { value: "admin", label: "Admins" },
  { value: "user", label: "Users" },
];

/** Every account, newest first; admins can grant or remove the admin role of others. */
export function UsersView() {
  const [role, setRole] = useState<UserRole | undefined>(undefined);
  const list = useAdminList<AdminUser>("/v1/admin/users", { role });
  const { data } = list;
  const me = useAuth().state.user;
  const [changing, setChanging] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  async function changeRole(user: AdminUser) {
    const next: UserRole = user.role === "admin" ? "user" : "admin";
    setBusy(true);
    try {
      await apiFetch(`/v1/admin/users/${user.id}`, { method: "PATCH", body: { role: next } });
      toast.success(
        next === "admin"
          ? `@${user.login} is now an admin.`
          : `@${user.login} is no longer an admin.`,
      );
      await list.reload();
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setBusy(false);
      setChanging(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          label="Search users"
          value={list.search}
          onChange={list.setSearch}
          placeholder="Search login, name or email…"
        />
        <FilterTabs legend="Role" options={FILTERS} value={role} onChange={setRole} />
      </div>
      <p role="alert" className="text-sm text-danger empty:hidden">
        {list.error ?? ""}
      </p>

      <AdminTable head={HEAD} busy={!data}>
        {!data ? (
          <EmptyRow columns={HEAD.length}>Loading…</EmptyRow>
        ) : data.items.length === 0 ? (
          <EmptyRow columns={HEAD.length}>No users match.</EmptyRow>
        ) : (
          data.items.map((user) => (
            <tr key={user.id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {user.image ? (
                    // biome-ignore lint/performance/noImgElement: small external avatar
                    <img
                      src={user.image}
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 rounded-full"
                    />
                  ) : (
                    <span className="size-8 shrink-0 rounded-full bg-surface-muted" />
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{user.name || user.login}</span>
                    {user.profilePublic ? (
                      <a
                        href={ROUTES.profile(user.login)}
                        className="font-mono text-xs text-muted underline-offset-4 hover:text-foreground hover:underline"
                      >
                        @{user.login}
                      </a>
                    ) : (
                      <span className="font-mono text-xs text-muted">@{user.login} · private</span>
                    )}
                  </div>
                </div>
              </td>
              <td className="max-w-56 truncate px-4 py-3 text-subtle">{user.email}</td>
              <td className="px-4 py-3 tabular-nums">{formatNumber(user.subscriptions)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-subtle">
                {formatShortDate(user.createdAt)}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <div className="flex items-center gap-2">
                  {user.role === "admin" ? (
                    <span className="rounded-full bg-highlight px-2.5 py-0.5 text-xs font-semibold text-highlight-foreground">
                      Admin
                    </span>
                  ) : (
                    <span className="rounded-full bg-chip px-2.5 py-0.5 text-xs font-semibold text-chip-foreground">
                      User
                    </span>
                  )}
                  {user.id === me?.id ? (
                    <span className="text-xs text-muted">You</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setChanging(user)}
                      className="min-h-9 rounded-full px-3 text-xs font-semibold text-primary transition-colors hover:bg-surface-muted"
                    >
                      {user.role === "admin" ? "Remove admin" : "Make admin"}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))
        )}
      </AdminTable>
      {data && <Pagination data={data} onPage={list.setPage} />}

      <ConfirmDialog
        open={changing !== null}
        title={changing?.role === "admin" ? "Remove admin role?" : "Make admin?"}
        confirmLabel={changing?.role === "admin" ? "Remove admin" : "Make admin"}
        variant={changing?.role === "admin" ? "danger" : "primary"}
        busy={busy}
        onCancel={() => setChanging(null)}
        onConfirm={() => changing && void changeRole(changing)}
      >
        {changing?.role === "admin" ? (
          <>@{changing.login} will lose access to the admin dashboard.</>
        ) : (
          <>
            @{changing?.login} will see every user's data in the admin dashboard and can grant or
            remove the admin role, including yours.
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
