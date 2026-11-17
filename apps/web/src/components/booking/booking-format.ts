import {
  addDays,
  CANCELLATION_POLICY_INFO,
  PLATFORM_TIMEZONE,
  type BookingDto,
  type CancellationPolicy,
  type IsoDate,
  type ListingDetailDto,
  type PaymentMethod,
  type QuoteReason,
} from '@hongwang/shared';
import { formatDay, pluralize } from '@/lib/format';

const momentFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: PLATFORM_TIMEZONE,
});

/** A moment in Bangkok time: 'Thu, Dec 10, 14:07'. */
export const formatMoment = (iso: string) => momentFmt.format(new Date(iso)).replace(' at ', ', ');

/** Hours or minutes left: '19 h', '42 min', or null once past. */
export function hoursLeft(untilIso: string, now: number): string | null {
  const mins = Math.floor((Date.parse(untilIso) - now) / 60_000);
  if (mins <= 0) return null;
  return mins >= 60 ? `${Math.floor(mins / 60)} h` : `${mins} min`;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: 'Card',
  promptpay: 'PromptPay',
  mobile_banking: 'Mobile banking',
};

/** 'card •••• 4242', 'PromptPay' ... */
export function paidWith(payment: BookingDto['payment'], lower = false): string {
  if (!payment) return lower ? 'your original payment method' : 'Original payment method';
  const label = PAYMENT_METHOD_LABELS[payment.method ?? 'card'];
  const text = payment.last4 ? `${label} •••• ${payment.last4}` : label;
  return lower && payment.method !== 'promptpay' ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

/** 'Moderate' etc. */
export const policyLabel = (p: CancellationPolicy) => CANCELLATION_POLICY_INFO[p].label;

/**
 * The cancellation line under "Pay" (design A3): "Free cancellation until Mon, Dec 7. After that,
 * 50% back until check-in."
 */
export function cancellationSummary(policy: CancellationPolicy, freeUntil: IsoDate, checkIn: IsoDate, today: IsoDate): string {
  const halfUntil = addDays(checkIn, -CANCELLATION_POLICY_INFO.strict.halfRefundDays);
  const after =
    policy === 'flexible'
      ? 'After that, no refund.'
      : policy === 'moderate'
        ? 'After that, 50% of the nightly total back until check-in.'
        : `After that, 50% of the nightly total back until ${formatDay(halfUntil)}, then no refund.`;
  if (today <= freeUntil) return `Free cancellation until ${formatDay(freeUntil)}. ${after}`;
  if (policy === 'moderate' && today < checkIn) return 'Free cancellation has passed. You get 50% of the nightly total back if you cancel before check-in.';
  if (policy === 'strict' && today < halfUntil) return `Free cancellation has passed. You get 50% of the nightly total back until ${formatDay(halfUntil)}.`;
  return 'Free cancellation has passed: these dates are non-refundable now.';
}

type Rules = Pick<ListingDetailDto, 'minNights' | 'maxNights' | 'maxGuests' | 'advanceNoticeDays' | 'bookingWindowMonths'>;

/** Human text for a quote reason (QuoteDto.reasons). */
export function reasonMessage(reason: QuoteReason, l: Rules): string {
  switch (reason) {
    case 'min_nights':
      return `The minimum stay is ${pluralize(l.minNights, 'night')}.`;
    case 'max_nights':
      return `Stays here can be at most ${pluralize(l.maxNights, 'night')}.`;
    case 'max_guests':
      return `This place fits up to ${pluralize(l.maxGuests, 'guest')}.`;
    case 'unavailable':
      return 'Some of these nights are already booked.';
    case 'advance_notice':
      return l.advanceNoticeDays > 0
        ? `The host needs ${pluralize(l.advanceNoticeDays, 'day')} notice before check-in.`
        : 'Check-in can’t be in the past.';
    case 'booking_window':
      return `The host takes bookings up to ${l.bookingWindowMonths} months ahead.`;
    case 'own_listing':
      return 'This is your listing, so you can’t book it.';
  }
}

/** Link back to the listing with the booking's dates (e.g. "Check the dates again"). */
export const listingHref = (b: Pick<BookingDto, 'listing' | 'checkIn' | 'checkOut' | 'guests'>) =>
  `/rooms/${b.listing.id}?checkIn=${b.checkIn}&checkOut=${b.checkOut}&guests=${b.guests}`;

/** The 'HH:MM' four hours before another 'HH:MM' (design: keycard code arrives 4 h before check-in). */
export function hoursBefore(hhmm: string, hours: number): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  const total = (((h - hours) % 24) + 24) % 24;
  return `${String(total).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
