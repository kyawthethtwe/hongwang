/**
 * BullMQ queues shared by the API (producer) and the worker entrypoint (consumer).
 * Producers: inject with @InjectQueue(QUEUES.x). Consumers live in *WorkerModule classes that only
 * apps/api/src/worker.module.ts imports.
 */
export const QUEUES = {
  /** Transactional email. Producer: NotificationsService. Consumer: notifications worker. */
  email: 'email',
  /** Delayed state-machine timeouts. Producer: BookingsService. Consumer: bookings worker. */
  bookingTimeouts: 'booking-timeouts',
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const BOOKING_TIMEOUT_JOBS = {
  /** Fires at hold_expires_at: payment_hold -> expired if still unpaid. */
  expireHold: 'expire-hold',
  /** Fires at request_expires_at: requested -> expired if host hasn't answered. */
  expireRequest: 'expire-request',
  /** Fires after check-out: confirmed -> completed. */
  completeStay: 'complete-stay',
  /** Repeatable safety-net sweep (every minute) for any timeouts a delayed job missed. */
  sweep: 'sweep',
} as const;

export interface BookingTimeoutJob {
  bookingId: string;
}

/** Every email the platform sends. Templates live in apps/api/src/modules/notifications/templates. */
export const EMAIL_TEMPLATES = [
  'verify-email',
  'password-reset',
  'welcome',
  'booking-requested-host',
  'booking-request-sent-guest',
  'booking-approved-guest',
  'booking-rejected-guest',
  'booking-expired-guest',
  'booking-confirmed-guest',
  'booking-confirmed-host',
  'booking-cancelled-guest',
  'booking-cancelled-host',
  'listing-published-host',
] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

/** Fields every booking email gets. Dates preformatted like 'Sat, Dec 12'; names are first names. */
export interface BookingEmailBase {
  /** Recipient's first name */
  firstName: string;
  /** The other party's first name (host for guest emails, guest for host emails) */
  otherName: string;
  listingTitle: string;
  ref: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
}

/**
 * The `data` each template reads. Senders (auth, bookings, listings) and the renderer
 * (notifications worker) both type against this. Money is preformatted with formatTHB ('฿4,290').
 * URLs are absolute (WEB_ORIGIN + path).
 */
export interface EmailTemplateData {
  'verify-email': {
    firstName: string;
    verifyUrl: string;
    /** Optional, how long the link works, e.g. '24 hours'. Shown as "The link works for 24 hours." */
    expiresIn?: string;
  };
  'password-reset': {
    firstName: string;
    resetUrl: string;
    /** Optional, how long the link works, e.g. '30 minutes'. Shown as "It works for 30 minutes." */
    expiresIn?: string;
  };
  welcome: { firstName: string; exploreUrl: string };
  'booking-requested-host': BookingEmailBase & {
    /** The guest's note to the host, or null */
    message: string | null;
    payout: string;
    /** When the request expires, e.g. 'Fri, Dec 11, 14:02' (Bangkok time) */
    respondBy: string;
    reservationUrl: string;
  };
  'booking-request-sent-guest': BookingEmailBase & { total: string; respondBy: string; tripUrl: string };
  'booking-approved-guest': BookingEmailBase & {
    total: string;
    /** When the payment hold ends, e.g. 'Thu, Dec 10, 14:17' or '14:17' (Bangkok time) */
    payBy: string;
    checkoutUrl: string;
  };
  'booking-rejected-guest': BookingEmailBase & { searchUrl: string };
  'booking-expired-guest': BookingEmailBase & { reason: 'request' | 'hold'; listingUrl: string };
  'booking-confirmed-guest': BookingEmailBase & {
    total: string;
    address: string;
    /** Time only, e.g. '14:00'. Shown as "Sat, Dec 12, from 14:00". */
    checkInFrom: string;
    /** Time only, e.g. '11:00'. Shown as "Tue, Dec 15, by 11:00". */
    checkOutBy: string;
    tripUrl: string;
  };
  'booking-confirmed-host': BookingEmailBase & { payout: string; reservationUrl: string };
  'booking-cancelled-guest': BookingEmailBase & {
    cancelledBy: 'guest' | 'host' | 'admin' | 'system';
    /** Amount going back to the guest; '฿0' when nothing is refunded */
    refund: string;
    tripUrl: string;
  };
  'booking-cancelled-host': BookingEmailBase & {
    cancelledBy: 'guest' | 'host' | 'admin' | 'system';
    /** Fee charged to the host when they cancelled, else null */
    penalty: string | null;
    reservationUrl: string;
  };
  'listing-published-host': { firstName: string; listingTitle: string; listingUrl: string };
}

export interface EmailJob<T extends EmailTemplate = EmailTemplate> {
  template: T;
  to: string;
  data: EmailTemplateData[T];
  /** Optional user id, for the email log and preferences. */
  userId?: string;
}
