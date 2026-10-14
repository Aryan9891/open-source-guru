"use client";

import { useId, useMemo } from "react";

const selectClasses =
  "min-h-11 w-full rounded-md border-2 border-border bg-background px-3 text-sm text-foreground focus:border-accent focus:outline-none";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const formatHour = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

/** The user's time zone and when daily digests arrive; with `email`, also where emails go. */
export function EmailSettings({
  email,
  timezone,
  digestHour,
  onTimezoneChange,
  onDigestHourChange,
}: {
  /** Shown as "Notifications go to …" (onboarding). */
  email?: string;
  timezone: string;
  digestHour: number;
  onTimezoneChange: (timezone: string) => void;
  onDigestHourChange: (hour: number) => void;
}) {
  const ids = { timezone: useId(), hour: useId() };
  const timezones = useMemo(() => {
    const all = Intl.supportedValuesOf("timeZone");
    return all.includes(timezone) ? all : [timezone, ...all];
  }, [timezone]);

  return (
    <div className="flex flex-col gap-4">
      {email && (
        <p className="text-subtle">
          Notifications go to <strong className="text-foreground">{email}</strong>, your primary
          email on GitHub. You can add other addresses later in your settings.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.timezone} className="text-sm font-semibold">
            Your time zone
          </label>
          <select
            id={ids.timezone}
            value={timezone}
            onChange={(event) => onTimezoneChange(event.target.value)}
            className={selectClasses}
          >
            {timezones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.hour} className="text-sm font-semibold">
            Daily digests arrive at
          </label>
          <select
            id={ids.hour}
            value={digestHour}
            onChange={(event) => onDigestHourChange(Number(event.target.value))}
            className={selectClasses}
          >
            {HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {formatHour(hour)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
