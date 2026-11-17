import { PLATFORM_TIMEZONE, type IsoDate } from '@hongwang/shared';

const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: PLATFORM_TIMEZONE,
});

/** '2026-12-12' -> 'Sat, Dec 12' (stay dates are calendar dates, no timezone shift). */
export const formatEmailDay = (d: IsoDate) => dayFmt.format(new Date(`${d}T00:00:00Z`));

/** A moment in Bangkok time: 'Sat, Dec 12, 14:30'. */
export const formatBangkokDateTime = (d: Date) => dateTimeFmt.format(d).replace(' at ', ', ');

/** When a stay ends in the sense of the sweep (`check_out < today` in Bangkok): 00:00 Bangkok the day after check-out. */
export function stayCompletesAt(checkOut: IsoDate): Date {
  const next = new Date(`${checkOut}T00:00:00+07:00`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
