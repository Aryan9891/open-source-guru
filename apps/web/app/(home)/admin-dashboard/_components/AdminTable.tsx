/** A bordered table on the surface color; scrolls sideways on narrow screens. */
export function AdminTable({
  head,
  children,
  busy,
}: {
  head: string[];
  children: React.ReactNode;
  busy: boolean;
}) {
  return (
    <div
      aria-busy={busy}
      className="overflow-x-auto rounded-lg border border-border bg-surface aria-busy:opacity-60"
    >
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-muted">
          <tr>
            {head.map((title) => (
              <th key={title} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

/** A row spanning the whole table, for empty and loading states. */
export function EmptyRow({ columns, children }: { columns: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={columns} className="px-4 py-8 text-center text-muted">
        {children}
      </td>
    </tr>
  );
}
