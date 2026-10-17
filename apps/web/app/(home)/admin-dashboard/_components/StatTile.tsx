import Link from "next/link";
import { formatNumber } from "@/lib/contributions";

/** One headline number, with an optional detail line and link. */
export function StatTile({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: number;
  detail?: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="text-sm font-semibold text-subtle">{label}</span>
      <span className="font-display text-3xl font-extrabold tabular-nums tracking-tight">
        {formatNumber(value)}
      </span>
      {detail && <span className="text-xs text-muted">{detail}</span>}
    </>
  );
  const className =
    "flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-surface p-5 transition-colors";
  return href ? (
    <Link href={href} className={`${className} hover:border-primary`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
