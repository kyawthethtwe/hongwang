import type { IsoDate } from '@hongwang/shared';

/** '2026-01-31' + 1 -> '2026-02-28' (clamped). */
export function addMonthsIso(d: IsoDate, months: number): IsoDate {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ny, nm, Math.min(day, last))).toISOString().slice(0, 10);
}

/** First day of the month of `d`. */
export const monthStartIso = (d: IsoDate): IsoDate => `${d.slice(0, 7)}-01`;

/** 'Sat, Dec 12 – Tue, Dec 15, 2026' */
export function formatStayLong(checkIn: IsoDate, checkOut: IsoDate, formatDay: (d: IsoDate) => string) {
  return `${formatDay(checkIn)} – ${formatDay(checkOut)}, ${checkOut.slice(0, 4)}`;
}
