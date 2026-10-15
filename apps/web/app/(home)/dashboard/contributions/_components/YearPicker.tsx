import Link from "next/link";
import { ROUTES } from "@/lib/constants";

/** "Last 12 months" and each year since the GitHub account was created; kept in `?year=`. */
export function YearPicker({ years, selected }: { years: number[]; selected: number | null }) {
  const options = [
    { year: null, label: "Last 12 months" },
    ...years.map((year) => ({ year, label: String(year) })),
  ];
  return (
    <nav aria-label="Period">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {options.map(({ year, label }) => {
          const active = year === selected;
          return (
            <li key={label}>
              <Link
                href={
                  year === null
                    ? ROUTES.dashboard.contributions
                    : `${ROUTES.dashboard.contributions}?year=${year}`
                }
                aria-current={active ? "page" : undefined}
                scroll={false}
                className={`flex min-h-9 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-subtle hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
