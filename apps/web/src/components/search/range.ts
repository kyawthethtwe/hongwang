import { eachNight, type IsoDate } from '@hongwang/shared';

export interface DateRange {
  checkIn: IsoDate | null;
  checkOut: IsoDate | null;
}

/**
 * Next range after clicking `day` (pure). Nights are [checkIn, checkOut): an unavailable night can
 * still be the check-out day, but can't be slept in. Returns null when the click is ignored.
 */
export function nextRange(cur: DateRange, day: IsoDate, isUnavailable: (night: IsoDate) => boolean = () => false): DateRange | null {
  const startAt = (d: IsoDate): DateRange | null => (isUnavailable(d) ? null : { checkIn: d, checkOut: null });
  if (!cur.checkIn || cur.checkOut) return startAt(day);
  if (day <= cur.checkIn) return startAt(day);
  if (eachNight(cur.checkIn, day).some(isUnavailable)) return startAt(day);
  return { checkIn: cur.checkIn, checkOut: day };
}

/** True when any night of the range is unavailable. */
export function rangeHasUnavailable(r: DateRange, isUnavailable: (night: IsoDate) => boolean): boolean {
  return !!r.checkIn && !!r.checkOut && eachNight(r.checkIn, r.checkOut).some(isUnavailable);
}
