/** Whether `timezone` is an IANA time zone that this runtime knows (e.g. "Europe/Paris"). */
export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** The hour (0–23) on the wall clock in `timezone` at `date`. */
export function localHour(timezone: string, date: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hourCycle: "h23",
  }).format(date);
  return Number(hour);
}

/**
 * Whether a daily digest is due: the hourly `send-digest` job sends daily digests to users
 * whose local hour equals their chosen `digestHour`.
 */
export function isDailyDigestDue(timezone: string, digestHour: number, now: Date): boolean {
  return localHour(timezone, now) === digestHour;
}
