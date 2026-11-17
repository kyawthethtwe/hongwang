import type { BookingEmailBase, EmailTemplate, EmailTemplateData } from '@hongwang/shared';

/**
 * Sample data for the dev preview (GET /notifications/dev/preview) and the template tests.
 * Matches the design canvas: Daniel books Ploy's "Sunny studio near BTS Ari", Sat, Dec 12 – Tue, Dec 15.
 */
export interface EmailSample<T extends EmailTemplate> {
  /** URL-safe name, e.g. 'default', 'hold', 'by-host' */
  variant: string;
  data: EmailTemplateData[T];
}

export type EmailSamples = { readonly [T in EmailTemplate]: readonly [EmailSample<T>, ...EmailSample<T>[]] };

const BOOKING_ID = '3f6c2a9e-1b7d-4e2a-9c51-7a0d2e8b4f10';
const LISTING_ID = '9a1d4c7e-52b0-4f3a-8e6d-1c2b3a4d5e6f';

export function emailSamples(webOrigin = 'http://localhost:3000'): EmailSamples {
  const o = webOrigin.replace(/\/+$/, '');
  const stay = { listingTitle: 'Sunny studio near BTS Ari', ref: 'BK-7F3K2Q', checkIn: 'Sat, Dec 12', checkOut: 'Tue, Dec 15', nights: 3, guests: 2 };
  const guest: BookingEmailBase = { firstName: 'Daniel', otherName: 'Ploy', ...stay };
  const host: BookingEmailBase = { firstName: 'Ploy', otherName: 'Daniel', ...stay };
  const tripUrl = `${o}/trips/${BOOKING_ID}`;
  const reservationUrl = `${o}/host/reservations/${BOOKING_ID}`;
  const listingUrl = `${o}/rooms/${LISTING_ID}`;

  return {
    'verify-email': [{ variant: 'default', data: { firstName: 'Daniel', verifyUrl: `${o}/verify-email?token=sample-verify-token`, expiresIn: '24 hours' } }],
    'password-reset': [{ variant: 'default', data: { firstName: 'Daniel', resetUrl: `${o}/reset-password?token=sample-reset-token`, expiresIn: '30 minutes' } }],
    welcome: [{ variant: 'default', data: { firstName: 'Daniel', exploreUrl: `${o}/` } }],
    'booking-requested-host': [
      {
        variant: 'default',
        data: {
          ...host,
          message: 'Hi Ploy! I’m in Ari for a design workshop that week.\nCould I drop my bags off around noon?',
          payout: '฿3,720',
          respondBy: 'Fri, Dec 11, 14:02',
          reservationUrl,
        },
      },
      { variant: 'no-message', data: { ...host, message: null, payout: '฿3,720', respondBy: 'Fri, Dec 11, 14:02', reservationUrl } },
    ],
    'booking-request-sent-guest': [
      { variant: 'default', data: { ...guest, total: '฿4,290', respondBy: 'Fri, Dec 11, 14:02', tripUrl } },
    ],
    'booking-approved-guest': [
      { variant: 'default', data: { ...guest, total: '฿4,290', payBy: 'Thu, Dec 10, 14:17', checkoutUrl: `${o}/checkout/${BOOKING_ID}` } },
    ],
    'booking-rejected-guest': [
      { variant: 'default', data: { ...guest, searchUrl: `${o}/search?checkIn=2026-12-12&checkOut=2026-12-15&guests=2` } },
    ],
    'booking-expired-guest': [
      { variant: 'hold', data: { ...guest, reason: 'hold', listingUrl } },
      { variant: 'request', data: { ...guest, reason: 'request', listingUrl } },
    ],
    'booking-confirmed-guest': [
      {
        variant: 'default',
        data: {
          ...guest,
          total: '฿4,290',
          address: '88/12 Phahon Yothin Soi 7, Ari, Bangkok 10400',
          checkInFrom: '14:00',
          checkOutBy: '11:00',
          tripUrl,
        },
      },
    ],
    'booking-confirmed-host': [{ variant: 'default', data: { ...host, payout: '฿3,720', reservationUrl } }],
    'booking-cancelled-guest': [
      { variant: 'by-guest', data: { ...guest, cancelledBy: 'guest', refund: '฿2,100', tripUrl } },
      { variant: 'by-host', data: { ...guest, cancelledBy: 'host', refund: '฿4,290', tripUrl } },
      { variant: 'no-refund', data: { ...guest, cancelledBy: 'guest', refund: '฿0', tripUrl } },
      { variant: 'by-admin', data: { ...guest, cancelledBy: 'admin', refund: '฿4,290', tripUrl } },
      { variant: 'by-system', data: { ...guest, cancelledBy: 'system', refund: '฿0', tripUrl } },
    ],
    'booking-cancelled-host': [
      { variant: 'by-guest', data: { ...host, cancelledBy: 'guest', penalty: null, reservationUrl } },
      { variant: 'by-host', data: { ...host, cancelledBy: 'host', penalty: '฿372', reservationUrl } },
      { variant: 'by-host-no-fee', data: { ...host, cancelledBy: 'host', penalty: null, reservationUrl } },
      { variant: 'by-admin', data: { ...host, cancelledBy: 'admin', penalty: null, reservationUrl } },
      { variant: 'by-system', data: { ...host, cancelledBy: 'system', penalty: null, reservationUrl } },
    ],
    'listing-published-host': [{ variant: 'default', data: { firstName: 'Ploy', listingTitle: 'Sunny studio near BTS Ari', listingUrl } }],
  };
}

/** The URL each template's primary button points at (what the tests assert is in the HTML). */
export const MAIN_URL_KEY: { readonly [T in EmailTemplate]: keyof EmailTemplateData[T] & string } = {
  'verify-email': 'verifyUrl',
  'password-reset': 'resetUrl',
  welcome: 'exploreUrl',
  'booking-requested-host': 'reservationUrl',
  'booking-request-sent-guest': 'tripUrl',
  'booking-approved-guest': 'checkoutUrl',
  'booking-rejected-guest': 'searchUrl',
  'booking-expired-guest': 'listingUrl',
  'booking-confirmed-guest': 'tripUrl',
  'booking-confirmed-host': 'reservationUrl',
  'booking-cancelled-guest': 'tripUrl',
  'booking-cancelled-host': 'reservationUrl',
  'listing-published-host': 'listingUrl',
};
