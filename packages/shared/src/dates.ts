/**
 * Stay dates are plain calendar dates 'YYYY-MM-DD' in Asia/Bangkok. A stay is the half-open range
 * [checkIn, checkOut): the guest sleeps the nights of checkIn .. checkOut-1. This matches the
 * Postgres daterange '[)' used by the bookings exclusion constraint.
 */
export type IsoDate = string;

export const PLATFORM_TIMEZONE = 'Asia/Bangkok';

const DAY_MS = 86_400_000;

function parse(d: IsoDate): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y!, m! - 1, day!);
}

function format(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(d: IsoDate, n: number): IsoDate {
  return format(parse(d) + n * DAY_MS);
}

/** Number of nights in [checkIn, checkOut). */
export function nightsBetween(checkIn: IsoDate, checkOut: IsoDate): number {
  return Math.round((parse(checkOut) - parse(checkIn)) / DAY_MS);
}

/** Each night of the stay, as the date the night starts. */
export function eachNight(checkIn: IsoDate, checkOut: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let t = parse(checkIn); t < parse(checkOut); t += DAY_MS) out.push(format(t));
  return out;
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((parse(to) - parse(from)) / DAY_MS);
}

/** Today's date in Bangkok. */
export function todayInBangkok(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PLATFORM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Postgres daterange literal for a stay: '[2026-12-12,2026-12-15)'. */
export const toDateRangeLiteral = (checkIn: IsoDate, checkOut: IsoDate) => `[${checkIn},${checkOut})`;

export function rangesOverlap(aIn: IsoDate, aOut: IsoDate, bIn: IsoDate, bOut: IsoDate): boolean {
  return aIn < bOut && bIn < aOut;
}
