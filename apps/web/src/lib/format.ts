import { formatTHB, nightsBetween, type IsoDate } from '@hongwang/shared';
import { differenceInMinutes, format, formatDistanceToNowStrict, parseISO } from 'date-fns';

export { formatTHB };

const d = (iso: IsoDate) => parseISO(iso);

/** '2026-12-12' -> 'Sat, Dec 12' */
export const formatDay = (iso: IsoDate) => format(d(iso), 'EEE, MMM d');
/** '2026-12-12' -> 'Dec 12' */
export const formatShortDay = (iso: IsoDate) => format(d(iso), 'MMM d');

/** 'Sat, Dec 12 – Tue, Dec 15' */
export const formatStay = (checkIn: IsoDate, checkOut: IsoDate) => `${formatDay(checkIn)} – ${formatDay(checkOut)}`;

/** 'Dec 12 – 15' (same month) or 'Dec 30 – Jan 2' */
export function formatStayShort(checkIn: IsoDate, checkOut: IsoDate) {
  const a = d(checkIn);
  const b = d(checkOut);
  return a.getMonth() === b.getMonth() ? `${format(a, 'MMM d')} – ${format(b, 'd')}` : `${format(a, 'MMM d')} – ${format(b, 'MMM d')}`;
}

export const nightsLabel = (checkIn: IsoDate, checkOut: IsoDate) => {
  const n = nightsBetween(checkIn, checkOut);
  return `${n} night${n === 1 ? '' : 's'}`;
};

export const pluralize = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** '2 days ago', 'in 19 hours' */
export const fromNow = (isoDateTime: string) => formatDistanceToNowStrict(parseISO(isoDateTime), { addSuffix: true });

/** Countdown text 'm:ss' until an ISO timestamp, '0:00' when past. */
export function countdown(untilIso: string, now = Date.now()) {
  const left = Math.max(0, Math.floor((parseISO(untilIso).getTime() - now) / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

/** '19 h' / '42 min' until an ISO timestamp. */
export function timeLeft(untilIso: string) {
  const mins = differenceInMinutes(parseISO(untilIso), new Date());
  if (mins <= 0) return 'expired';
  return mins >= 60 ? `${Math.floor(mins / 60)} h` : `${mins} min`;
}
