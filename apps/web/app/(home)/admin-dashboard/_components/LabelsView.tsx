"use client";

import { useAdminList } from "@/hooks/use-admin-list";
import type { FollowedLabel } from "@/lib/admin";
import { formatNumber } from "@/lib/contributions";
import { AdminTable, EmptyRow } from "./AdminTable";
import { Pagination } from "./Pagination";
import { SearchBox } from "./SearchBox";

const HEAD = ["Label", "Subscriptions", "Users", "Repositories"];

/** Labels named in subscriptions (case-insensitive), most followed first. */
export function LabelsView() {
  const list = useAdminList<FollowedLabel>("/v1/admin/labels");
  const { data } = list;

  return (
    <div className="flex flex-col gap-4">
      <SearchBox
        label="Search labels"
        value={list.search}
        onChange={list.setSearch}
        placeholder="Search labels…"
      />
      <p role="alert" className="text-sm text-danger empty:hidden">
        {list.error ?? ""}
      </p>
      <AdminTable head={HEAD} busy={!data}>
        {!data ? (
          <EmptyRow columns={HEAD.length}>Loading…</EmptyRow>
        ) : data.items.length === 0 ? (
          <EmptyRow columns={HEAD.length}>No labels match.</EmptyRow>
        ) : (
          data.items.map((label) => (
            <tr key={label.name}>
              <td className="px-4 py-3">
                <span className="rounded-full bg-chip px-2.5 py-0.5 text-chip-foreground">
                  {label.name}
                </span>
              </td>
              <td className="px-4 py-3 font-semibold tabular-nums">
                {formatNumber(label.subscriptions)}
              </td>
              <td className="px-4 py-3 tabular-nums text-subtle">{formatNumber(label.users)}</td>
              <td className="px-4 py-3 tabular-nums text-subtle">
                {formatNumber(label.repositories)}
              </td>
            </tr>
          ))
        )}
      </AdminTable>
      {data && <Pagination data={data} onPage={list.setPage} />}
    </div>
  );
}
