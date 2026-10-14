"use client";

import { useId } from "react";

export type Frequency = "instant" | "hourly" | "daily";

const options: { value: Frequency; title: string; description: string }[] = [
  {
    value: "instant",
    title: "Right away",
    description: "Within a few minutes. Several matches close together arrive in one email.",
  },
  { value: "hourly", title: "Hourly digest", description: "At most one email per hour." },
  { value: "daily", title: "Daily digest", description: "One email a day, at your digest time." },
];

/** How often to email about a subscription: radio cards. */
export function FrequencyPicker({
  value,
  onChange,
}: {
  value: Frequency;
  onChange: (value: Frequency) => void;
}) {
  const name = useId();

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm font-semibold">How often should we email you?</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer flex-col gap-1 rounded-lg border-2 border-border bg-background p-4 transition-colors hover:border-accent has-checked:border-primary has-checked:bg-surface-muted has-focus-visible:outline-2 has-focus-visible:outline-ring"
          >
            <span className="flex items-center gap-2 font-semibold">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className="size-4 accent-primary"
              />
              {option.title}
            </span>
            <span className="text-sm text-subtle">{option.description}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
