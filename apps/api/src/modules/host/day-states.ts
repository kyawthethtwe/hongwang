import {
  addDays,
  isDateHolding,
  type BookingStatus,
  type CalendarDayState,
  type HostCalendarDay,
  type IsoDate,
  type Satang,
} from '@hongwang/shared';

/**
 * Pure helpers that turn bookings, blocks and special prices into per-night states for the
 * host calendar (C5) and the "Next two weeks" timeline (C2). No database access here.
 *
 * Strongest state wins on a night: booked (confirmed/completed) > payment_hold > blocked >
 * requested > open. A request never holds dates, so a blocked night beats it.
 */

/** A booking as far as the calendar cares. */
export interface StayLike {
  id: string;
  status: BookingStatus;
  checkIn: IsoDate;
  checkOut: IsoDate;
  /** Shown on the first night, e.g. "Daniel M." */
  guestName: string;
}

export interface DayState {
  date: IsoDate;
  state: CalendarDayState;
  bookingId: string | null;
  guestName: string | null;
  /** First night of the booking within the given dates (the guest label is drawn once). */
  isBookingStart: boolean;
}

const RANK: Record<CalendarDayState, number> = { open: 0, requested: 1, blocked: 2, payment_hold: 3, booked: 4 };

/** Statuses that show on a calendar. */
export const CALENDAR_STATUSES = ['requested', 'payment_hold', 'confirmed', 'completed'] as const satisfies readonly BookingStatus[];

/** Calendar state a booking gives its nights, or null when it doesn't show (rejected, expired, cancelled). */
export function stayState(status: BookingStatus): CalendarDayState | null {
  switch (status) {
    case 'confirmed':
    case 'completed':
      return 'booked';
    case 'payment_hold':
      return 'payment_hold';
    case 'requested':
      return 'requested';
    default:
      return null;
  }
}

/** `count` consecutive dates starting at `from`. */
export function dateRange(from: IsoDate, count: number): IsoDate[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}

/** Every date of a 'YYYY-MM' month. */
export function monthDates(month: string): IsoDate[] {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y!, m, 0)).getUTCDate();
  return dateRange(`${month}-01`, days);
}

/** 'YYYY-MM' of a date. */
export const monthOf = (date: IsoDate) => date.slice(0, 7);

/** Sorted, de-duplicated copy. */
export const uniqueSorted = (dates: readonly IsoDate[]) => [...new Set(dates)].sort();

const covers = (s: Pick<StayLike, 'checkIn' | 'checkOut'>, date: IsoDate) => s.checkIn <= date && date < s.checkOut;

export function buildDayStates(dates: readonly IsoDate[], stays: readonly StayLike[], blocked: Iterable<IsoDate>): DayState[] {
  const blockedSet = new Set(blocked);
  const out: DayState[] = dates.map((date) => {
    let best: { state: CalendarDayState; stay: StayLike } | null = null;
    for (const stay of stays) {
      const state = stayState(stay.status);
      if (!state || !covers(stay, date)) continue;
      if (!best || RANK[state] > RANK[best.state]) best = { state, stay };
    }
    let state: CalendarDayState = best?.state ?? 'open';
    if (blockedSet.has(date) && RANK.blocked > RANK[state]) state = 'blocked';
    const stay = best && best.state === state ? best.stay : null;
    return {
      date,
      state,
      bookingId: stay?.id ?? null,
      guestName: stay?.guestName ?? null,
      isBookingStart: false,
    };
  });
  out.forEach((d, i) => {
    d.isBookingStart = d.bookingId !== null && (i === 0 || out[i - 1]!.bookingId !== d.bookingId);
  });
  return out;
}

export interface CalendarMonthInput {
  month: string;
  today: IsoDate;
  basePrice: Satang;
  overrides: Readonly<Record<IsoDate, Satang>>;
  blocked: Iterable<IsoDate>;
  stays: readonly StayLike[];
}

/** Every day of the month with state, nightly price (special price or base) and past flag. */
export function buildCalendarDays(input: CalendarMonthInput): HostCalendarDay[] {
  const states = buildDayStates(monthDates(input.month), input.stays, input.blocked);
  return states.map((d) => {
    const special = input.overrides[d.date];
    return {
      ...d,
      price: special ?? input.basePrice,
      isSpecialPrice: special !== undefined,
      isPast: d.date < input.today,
    };
  });
}

/** Which of `dates` are nights of a date-holding booking (payment_hold, confirmed, completed). */
export function nightsHeldByBookings(
  dates: readonly IsoDate[],
  stays: readonly Pick<StayLike, 'status' | 'checkIn' | 'checkOut'>[],
): IsoDate[] {
  const holding = stays.filter((s) => isDateHolding(s.status));
  return dates.filter((d) => holding.some((s) => covers(s, d)));
}

/** "Daniel M." from first and last name (same rule as toPublicUser). */
export function shortName(firstName: string, lastName: string): string {
  return lastName ? `${firstName} ${lastName[0]!.toUpperCase()}.` : firstName;
}
