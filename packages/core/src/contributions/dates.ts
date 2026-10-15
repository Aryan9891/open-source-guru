// Calendar dates as `YYYY-MM-DD` strings (the `date` columns), with arithmetic done in UTC so
// daylight saving time never shifts a day.

/** A calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

const DAY_MS = 24 * 60 * 60 * 1000;

const toUtc = (date: IsoDate) => Date.parse(`${date}T00:00:00Z`);
const fromUtc = (ms: number): IsoDate => new Date(ms).toISOString().slice(0, 10);

/** The calendar date of `instant` in `timeZone` (an IANA name such as `Europe/Paris`). */
export function dateInTimeZone(instant: Date, timeZone: string): IsoDate {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** The Sunday starting the week of `date`: weeks run Sunday to Saturday, as on GitHub's graph. */
export function weekStart(date: IsoDate): IsoDate {
  return addDays(date, -new Date(toUtc(date)).getUTCDay());
}
