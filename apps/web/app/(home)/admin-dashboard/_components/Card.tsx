import Link from "next/link";

/** A titled panel, with an optional "See all" link. */
export function Card({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-extrabold">{title}</h2>
        {href && (
          <Link
            href={href}
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            See all →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
