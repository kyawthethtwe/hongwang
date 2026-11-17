import { PAYMENT_HOLD_TTL_MS, REQUEST_TTL_MS, type BookingEmailBase } from '@hongwang/shared';
import { summary, type Block } from './layout';

/** Minutes a guest has to pay once dates are held (15). */
export const HOLD_MINUTES = Math.round(PAYMENT_HOLD_TTL_MS / 60_000);
/** Hours a host has to answer a request (24). */
export const REQUEST_HOURS = Math.round(REQUEST_TTL_MS / 3_600_000);

export const FOOTERS = {
  account: 'You’re getting this because of your Hongwang account.',
  guest: 'Booking emails are always sent, because they hold your receipt and check-in details.',
  host: 'You’re getting this because you host on Hongwang.',
} as const;

/** plural(3, 'night') -> '3 nights' */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Ploy" -> "Ploy’s", "Chris" -> "Chris’" */
export const possessive = (name: string) => (/s$/i.test(name) ? `${name}’` : `${name}’s`);

/** 'Sat, Dec 12 – Tue, Dec 15 · 3 nights · 2 guests' (the line under the title on TripDetail). */
export const stayLine = (d: BookingEmailBase) =>
  `${d.checkIn} – ${d.checkOut} · ${plural(d.nights, 'night')} · ${plural(d.guests, 'guest')}`;

const DAY = /(?:^|,\s*)([A-Z][a-z]{2,8})\.?\s+(\d{1,2})$/;

/**
 * Compact range for subjects and banners, as in the design ("Dec 12 – 15 is held for you"):
 * ('Sat, Dec 12', 'Tue, Dec 15') -> 'Dec 12 – 15'; across months 'Dec 30 – Jan 2'.
 * Falls back to the full strings when they don't look like 'Sat, Dec 12'.
 */
export function shortRange(checkIn: string, checkOut: string): string {
  const a = DAY.exec(checkIn.trim());
  const z = DAY.exec(checkOut.trim());
  if (!a || !z) return `${checkIn} – ${checkOut}`;
  return a[1] === z[1] ? `${a[1]} ${a[2]} – ${z[2]}` : `${a[1]} ${a[2]} – ${z[1]} ${z[2]}`;
}

/** '฿0', '฿0.00', '0' -> true. Money arrives preformatted with formatTHB. */
export const isZeroMoney = (amount: string) => /^[^\d-]*0+(?:\.0+)?$/.test(amount.replace(/[\s,]/g, ''));

/** The booking card every booking email shows: listing, dates, nights, guests, extra rows, booking ref. */
export function bookingSummary(d: BookingEmailBase, rows: ReadonlyArray<readonly [string, string]> = []): Block {
  return summary(d.listingTitle, stayLine(d), [...rows, ['Booking ref', d.ref]]);
}
