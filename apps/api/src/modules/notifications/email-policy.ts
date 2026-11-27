import type { EmailTemplate, NotificationEvent } from '@hongwang/shared';

/**
 * Which preferences row (design B6) governs each email. `null` = account mail (verify, reset,
 * welcome, listing live) that is always sent. Every current booking email maps to
 * 'booking_updates', whose email channel is locked, so today nothing is skipped. Reminder,
 * message and marketing emails added later map to their event and then honour the toggle.
 */
export const EMAIL_TEMPLATE_EVENT: { readonly [T in EmailTemplate]: NotificationEvent | null } = {
  'verify-email': null,
  'password-reset': null,
  welcome: null,
  'booking-requested-host': 'booking_updates',
  'booking-request-sent-guest': 'booking_updates',
  'booking-approved-guest': 'booking_updates',
  'booking-rejected-guest': 'booking_updates',
  'booking-expired-guest': 'booking_updates',
  'booking-confirmed-guest': 'booking_updates',
  'booking-confirmed-host': 'booking_updates',
  'booking-cancelled-guest': 'booking_updates',
  'booking-cancelled-host': 'booking_updates',
  'booking-payment-refunded-late': 'booking_updates',
  'listing-published-host': null,
};
