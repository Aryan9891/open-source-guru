"use client";

/** A row of mutually exclusive filters (pill buttons), next to an admin list's search. */
export function FilterTabs<T extends string | undefined>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-surface p-1">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-9 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors ${
            value === option.value
              ? "bg-primary text-primary-foreground"
              : "text-subtle hover:bg-surface-muted hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
