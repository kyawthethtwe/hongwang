import {
  addDays,
  freeCancellationUntil,
  guestRefund,
  hostCancellationRefund,
  nightsBetween,
  type BookingActor,
  type BookingStatus,
  type CancellationPolicy,
  type IsoDate,
  type MyBookingsQuery,
  type QuoteReason,
  type RefundQuote,
  type Satang,
} from '@hongwang/shared';

/**
 * Pure booking rules (no DB): listing rules for a stay, the /bookings/mine tabs and which refund
 * applies to a cancellation. BookingsService wires them to the database.
 */

export interface StayRules {
  minNights: number;
  maxNights: number;
  maxGuests: number;
  advanceNoticeDays: number;
  bookingWindowMonths: number;
}

export interface StayRequest {
  checkIn: IsoDate;
  checkOut: IsoDate;
  guests: number;
}

/** 'YYYY-MM-DD' + n calendar months, clamped to the last day of the target month. */
export function addMonths(d: IsoDate, months: number): IsoDate {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ty = Math.floor(total / 12);
  const tm = total % 12;
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ty, tm, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

/**
 * Listing rules a stay breaks, in a stable order. Availability ('unavailable') needs the database
 * and is added by the caller.
 * - advance_notice: check-in earlier than today + advanceNoticeDays (or in the past).
 * - booking_window: a night falls after today + bookingWindowMonths.
 */
export function stayRuleViolations(rules: StayRules, stay: StayRequest, today: IsoDate): QuoteReason[] {
  const reasons: QuoteReason[] = [];
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  if (nights < rules.minNights) reasons.push('min_nights');
  if (nights > rules.maxNights) reasons.push('max_nights');
  if (stay.guests > rules.maxGuests) reasons.push('max_guests');
  if (stay.checkIn < addDays(today, Math.max(0, rules.advanceNoticeDays))) reasons.push('advance_notice');
  if (stay.checkOut > addMonths(today, rules.bookingWindowMonths)) reasons.push('booking_window');
  return reasons;
}

export const QUOTE_REASON_MESSAGES: Record<QuoteReason, (r: StayRules) => string> = {
  min_nights: (r) => `This place has a ${r.minNights}-night minimum`,
  max_nights: (r) => `Stays here can be at most ${r.maxNights} nights`,
  max_guests: (r) => `This place fits at most ${r.maxGuests} guest${r.maxGuests === 1 ? '' : 's'}`,
  unavailable: () => 'Some of those nights are already booked',
  advance_notice: (r) =>
    r.advanceNoticeDays > 0
      ? `The host needs ${r.advanceNoticeDays} day${r.advanceNoticeDays === 1 ? '' : 's'} notice before check-in`
      : 'Check-in can’t be in the past',
  booking_window: (r) => `The host takes bookings up to ${r.bookingWindowMonths} months ahead`,
  own_listing: () => 'You can’t book your own listing',
};

export type BookingTab = MyBookingsQuery['tab'];

export const TAB_STATUSES = {
  upcoming: ['requested', 'payment_hold', 'confirmed'],
  cancelled: ['cancelled', 'rejected', 'expired'],
} as const satisfies Partial<Record<BookingTab, readonly BookingStatus[]>>;

/**
 * Which /bookings/mine tab a booking belongs to (mirrors the SQL in BookingsService.tabWhere):
 *   upcoming:  requested | payment_hold | confirmed, with check_out >= today
 *   past:      completed, or confirmed with check_out < today
 *   cancelled: cancelled | rejected | expired
 * A request or hold whose stay has already ended belongs to no tab (the sweep expires it).
 */
export function bookingTab(status: BookingStatus, checkOut: IsoDate, today: IsoDate): BookingTab | null {
  if ((TAB_STATUSES.cancelled as readonly BookingStatus[]).includes(status)) return 'cancelled';
  if (status === 'completed') return 'past';
  if (status === 'confirmed') return checkOut >= today ? 'upcoming' : 'past';
  return checkOut >= today ? 'upcoming' : null;
}

export interface CancellableBooking {
  status: BookingStatus;
  cancellationPolicy: CancellationPolicy;
  checkIn: IsoDate;
  nightsTotal: Satang;
  cleaningFee: Satang;
  serviceFee: Satang;
  total: Satang;
  hostPayout: Satang;
}

/** Nothing has been charged yet (requested / payment_hold): nothing to refund, no fee. */
function nothingCharged(b: CancellableBooking): RefundQuote {
  return {
    kind: 'full',
    refundTotal: 0,
    lines: [
      { label: 'Nights', paid: 0, refund: 0 },
      { label: 'Cleaning fee', paid: 0, refund: 0 },
      { label: 'Service fee', paid: 0, refund: 0 },
    ],
    freeCancellationUntil: freeCancellationUntil(b.cancellationPolicy, b.checkIn),
    hostPenalty: 0,
  };
}

/**
 * The refund a cancellation by `actor` gets:
 * - before payment (requested, payment_hold): nothing was charged, so nothing to refund;
 * - guest cancels a confirmed stay: the listing's policy (guestRefund);
 * - host cancels a confirmed stay: full refund to the guest, host pays a fee (hostCancellationRefund);
 * - admin cancels: full refund, no host fee (support decides any penalty separately).
 */
export function refundFor(b: CancellableBooking, actor: BookingActor, today: IsoDate): RefundQuote {
  if (b.status !== 'confirmed') return nothingCharged(b);
  switch (actor) {
    case 'guest':
      return guestRefund(b.cancellationPolicy, b.checkIn, today, b);
    case 'host':
      return hostCancellationRefund(b.cancellationPolicy, b.checkIn, b);
    default:
      return { ...hostCancellationRefund(b.cancellationPolicy, b.checkIn, b), hostPenalty: 0 };
  }
}
