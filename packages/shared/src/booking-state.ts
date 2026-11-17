import type { BookingActor, BookingStatus } from './enums';

/**
 * Booking lifecycle (whiteboard "Booking lifecycle"):
 *
 *   requested ──approve──▶ payment_hold ──paid──▶ confirmed ──stay ends──▶ completed
 *       │                     │                      │
 *       ├─reject/24h──▶ rejected / expired           └─cancel──▶ cancelled (refund per policy)
 *       └─guest cancel─▶ cancelled                   (payment_hold: 15 min TTL ─▶ expired)
 *
 * Instant book skips `requested` and starts at `payment_hold`.
 * Statuses in DATE_HOLDING_STATUSES occupy the calendar: the Postgres EXCLUDE constraint on
 * (listing_id, stay) applies only to rows in these statuses, so two can never overlap.
 */
export const DATE_HOLDING_STATUSES = ['payment_hold', 'confirmed', 'completed'] as const satisfies readonly BookingStatus[];

export const TERMINAL_STATUSES = ['completed', 'rejected', 'expired', 'cancelled'] as const satisfies readonly BookingStatus[];

/** How long a host has to answer a request. */
export const REQUEST_TTL_MS = 24 * 60 * 60 * 1000;
/** How long dates are held while the guest pays. */
export const PAYMENT_HOLD_TTL_MS = 15 * 60 * 1000;

export type BookingTransition =
  | 'approve'
  | 'reject'
  | 'expire'
  | 'pay'
  | 'complete'
  | 'cancel';

type Rule = { from: BookingStatus; to: BookingStatus; by: readonly BookingActor[] };

export const BOOKING_TRANSITIONS: Record<BookingTransition, readonly Rule[]> = {
  approve: [{ from: 'requested', to: 'payment_hold', by: ['host'] }],
  reject: [{ from: 'requested', to: 'rejected', by: ['host'] }],
  expire: [
    { from: 'requested', to: 'expired', by: ['system'] },
    { from: 'payment_hold', to: 'expired', by: ['system'] },
  ],
  pay: [{ from: 'payment_hold', to: 'confirmed', by: ['system'] }],
  complete: [{ from: 'confirmed', to: 'completed', by: ['system'] }],
  cancel: [
    { from: 'requested', to: 'cancelled', by: ['guest', 'admin'] },
    { from: 'payment_hold', to: 'cancelled', by: ['guest', 'admin'] },
    { from: 'confirmed', to: 'cancelled', by: ['guest', 'host', 'admin'] },
  ],
};

/** Returns the target status, or null if `actor` may not apply `transition` from `from`. */
export function nextStatus(
  from: BookingStatus,
  transition: BookingTransition,
  actor: BookingActor,
): BookingStatus | null {
  const rule = BOOKING_TRANSITIONS[transition].find((r) => r.from === from && r.by.includes(actor));
  return rule ? rule.to : null;
}

export const isDateHolding = (s: BookingStatus) =>
  (DATE_HOLDING_STATUSES as readonly BookingStatus[]).includes(s);

export const isTerminal = (s: BookingStatus) =>
  (TERMINAL_STATUSES as readonly BookingStatus[]).includes(s);

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  requested: 'Requested',
  payment_hold: 'Payment hold',
  confirmed: 'Confirmed',
  completed: 'Completed',
  rejected: 'Declined',
  expired: 'Expired',
  cancelled: 'Cancelled',
};
