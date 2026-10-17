"use client";

import { buttonClasses } from "@/components/ui/Button";
import type { Page } from "@/lib/admin";
import { formatNumber } from "@/lib/contributions";

/** "1–25 of 132" with previous and next buttons. */
export function Pagination({
  data,
  onPage,
}: {
  data: Page<unknown>;
  onPage: (page: number) => void;
}) {
  const from = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const to = Math.min(data.total, data.page * data.pageSize);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-muted tabular-nums">
        {formatNumber(from)}–{formatNumber(to)} of {formatNumber(data.total)}
      </span>
      <span className="flex gap-2">
        <button
          type="button"
          disabled={data.page <= 1}
          onClick={() => onPage(data.page - 1)}
          className={buttonClasses({ variant: "secondary" })}
        >
          ← Previous
        </button>
        <button
          type="button"
          disabled={data.page >= pages}
          onClick={() => onPage(data.page + 1)}
          className={buttonClasses({ variant: "secondary" })}
        >
          Next →
        </button>
      </span>
    </nav>
  );
}
