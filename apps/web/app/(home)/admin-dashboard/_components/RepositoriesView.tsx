"use client";

import { useState } from "react";
import { useAdminList } from "@/hooks/use-admin-list";
import type { AdminRepository, RepositorySource } from "@/lib/admin";
import { formatNumber, formatShortDate } from "@/lib/contributions";
import { AdminTable, EmptyRow } from "./AdminTable";
import { FilterTabs } from "./FilterTabs";
import { Pagination } from "./Pagination";
import { SearchBox } from "./SearchBox";

const STATUS_LABELS: Record<AdminRepository["status"], string> = {
  active: "Active",
  not_found: "Not found",
  moved: "Moved",
};

const SOURCES: { value: RepositorySource | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "followed", label: "Followed" },
  { value: "contributions", label: "Contributions only" },
];

const SOURCE_NOTES: Record<RepositorySource, string> = {
  followed: "Repositories with at least one subscription. Only these are polled for issues.",
  contributions:
    "Repositories nobody follows, stored by the contribution sync to classify contributions (license, fork, owner). They are never polled.",
};

const HEAD = ["Repository", "Followers", "Contributors", "Status", "License", "Last polled"];

/** Every repository we know of, most followed first, filterable by where it comes from. */
export function RepositoriesView() {
  const [source, setSource] = useState<RepositorySource | undefined>(undefined);
  const list = useAdminList<AdminRepository>("/v1/admin/repositories", { source });
  const { data } = list;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          label="Search repositories"
          value={list.search}
          onChange={list.setSearch}
          placeholder="Search owner/name…"
        />
        <FilterTabs legend="Source" options={SOURCES} value={source} onChange={setSource} />
      </div>
      {source && <p className="text-sm text-subtle">{SOURCE_NOTES[source]}</p>}
      <p role="alert" className="text-sm text-danger empty:hidden">
        {list.error ?? ""}
      </p>
      <AdminTable head={HEAD} busy={!data}>
        {!data ? (
          <EmptyRow columns={HEAD.length}>Loading…</EmptyRow>
        ) : data.items.length === 0 ? (
          <EmptyRow columns={HEAD.length}>No repositories match.</EmptyRow>
        ) : (
          data.items.map((repo) => (
            <tr key={repo.id}>
              <td className="px-4 py-3">
                <a
                  href={repo.url}
                  className="font-mono font-semibold underline-offset-4 hover:underline"
                >
                  {repo.fullName}
                </a>
              </td>
              <td className="px-4 py-3 font-semibold tabular-nums">
                {formatNumber(repo.followers)}
              </td>
              <td className="px-4 py-3 tabular-nums text-subtle">
                {formatNumber(repo.contributors)}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    repo.status === "active"
                      ? "bg-chip text-chip-foreground"
                      : "bg-danger text-danger-foreground"
                  }`}
                >
                  {STATUS_LABELS[repo.status]}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-subtle">
                {repo.license ?? "—"}
                {repo.isOpenSource && <span className="text-muted"> · open source</span>}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-subtle">
                {repo.lastPolledAt
                  ? formatShortDate(repo.lastPolledAt)
                  : repo.followers > 0
                    ? "Not yet"
                    : "Not polled"}
                {repo.lastPollError && (
                  <span
                    className="block max-w-56 truncate text-xs text-danger"
                    title={repo.lastPollError}
                  >
                    Error: {repo.lastPollError}
                  </span>
                )}
              </td>
            </tr>
          ))
        )}
      </AdminTable>
      {data && <Pagination data={data} onPage={list.setPage} />}
    </div>
  );
}
