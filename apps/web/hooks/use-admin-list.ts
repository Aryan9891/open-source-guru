"use client";

import { useCallback, useEffect, useState } from "react";
import type { Page } from "@/lib/admin";
import { apiFetch } from "@/lib/api-client";

/** Waits this long after the last keystroke before searching. */
const SEARCH_DELAY_MS = 300;

/**
 * A paginated, searchable admin list (`/v1/admin/...?q=&page=`). `filters` are extra query
 * parameters; changing the search or a filter goes back to the first page.
 */
export function useAdminList<T>(path: string, filters: Record<string, string | undefined> = {}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a filter change resets the page
  useEffect(() => setPage(1), [filterKey]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (query) params.set("q", query);
    for (const [name, value] of Object.entries(JSON.parse(filterKey) as typeof filters)) {
      if (value) params.set(name, value);
    }
    try {
      setData(await apiFetch<Page<T>>(`${path}?${params}`));
      setError(null);
    } catch (caught) {
      setError((caught as Error).message);
    }
  }, [path, page, query, filterKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return { search, setSearch, page, setPage, data, error, reload: load };
}
