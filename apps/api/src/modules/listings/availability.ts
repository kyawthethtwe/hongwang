import { addDays, eachNight, nightsBetween, type AvailabilityDto, type IsoDate, type Satang } from '@hongwang/shared';

/** Longest range GET /listings/:id/availability returns in one call. */
export const MAX_AVAILABILITY_NIGHTS = 400;

/** '2026-01-31' + 1 month -> '2026-02-28' (clamped to the month's last day). */
export function addMonths(d: IsoDate, months: number): IsoDate {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ny, nm, Math.min(day, last))).toISOString().slice(0, 10);
}

export interface AvailabilityInput {
  from: IsoDate;
  to: IsoDate;
  /** Today in Bangkok. */
  today: IsoDate;
  advanceNoticeDays: number;
  bookingWindowMonths: number;
  basePrice: Satang;
  /** Date-holding bookings overlapping [from, to). */
  bookings: { checkIn: IsoDate; checkOut: IsoDate }[];
  /** Host-blocked nights. */
  blocks: IsoDate[];
  /** Host special prices by night. */
  overrides: Record<IsoDate, Satang>;
}

/**
 * Unavailable nights in [from, to): held/booked by someone, blocked by the host, before
 * today + advance notice, or on/after today + booking window. Prices: special price ?? base.
 */
export function computeAvailability(input: AvailabilityInput): Pick<AvailabilityDto, 'unavailable' | 'prices'> {
  const firstBookable = addDays(input.today, input.advanceNoticeDays);
  const windowEnd = addMonths(input.today, input.bookingWindowMonths);
  const blocked = new Set(input.blocks);
  const held = new Set<IsoDate>();
  for (const b of input.bookings) {
    const start = b.checkIn > input.from ? b.checkIn : input.from;
    const end = b.checkOut < input.to ? b.checkOut : input.to;
    if (start < end) for (const n of eachNight(start, end)) held.add(n);
  }
  const unavailable: IsoDate[] = [];
  const prices: Record<IsoDate, Satang> = {};
  for (const night of eachNight(input.from, input.to)) {
    prices[night] = input.overrides[night] ?? input.basePrice;
    if (night < firstBookable || night >= windowEnd || blocked.has(night) || held.has(night)) unavailable.push(night);
  }
  return { unavailable, prices };
}

/** null when the range is fine, else a message. */
export function availabilityRangeError(from: IsoDate, to: IsoDate): string | null {
  const n = nightsBetween(from, to);
  if (n < 1) return '`to` must be after `from`';
  if (n > MAX_AVAILABILITY_NIGHTS) return `Ask for at most ${MAX_AVAILABILITY_NIGHTS} nights at a time`;
  return null;
}
