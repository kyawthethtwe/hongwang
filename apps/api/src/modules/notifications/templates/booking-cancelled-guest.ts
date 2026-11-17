import type { EmailTemplateData } from '@hongwang/shared';
import { b, button, callout, p, renderLayout, type EmailRenderer } from './layout';
import { bookingSummary, FOOTERS, isZeroMoney, shortRange } from './parts';

type Data = EmailTemplateData['booking-cancelled-guest'];

const WHO: Record<Data['cancelledBy'], (d: Data) => { subject: string; heading: string; intro: string }> = {
  guest: (d) => ({
    subject: `Booking cancelled: ${d.listingTitle}, ${shortRange(d.checkIn, d.checkOut)}`,
    heading: 'Your booking is cancelled',
    intro: `Hi ${d.firstName}, you cancelled your stay at ${d.listingTitle}.`,
  }),
  host: (d) => ({
    subject: `${d.otherName} cancelled your stay, ${shortRange(d.checkIn, d.checkOut)}`,
    heading: `${d.otherName} had to cancel`,
    intro: `Hi ${d.firstName}, sorry: ${d.otherName} had to cancel your stay at ${d.listingTitle}.`,
  }),
  admin: (d) => ({
    subject: `Booking cancelled: ${d.listingTitle}, ${shortRange(d.checkIn, d.checkOut)}`,
    heading: 'Your booking is cancelled',
    intro: `Hi ${d.firstName}, our support team cancelled your stay at ${d.listingTitle}.`,
  }),
  system: (d) => ({
    subject: `Booking cancelled: ${d.listingTitle}, ${shortRange(d.checkIn, d.checkOut)}`,
    heading: 'Your booking is cancelled',
    intro: `Hi ${d.firstName}, your stay at ${d.listingTitle} was cancelled.`,
  }),
};

/** To the guest whenever a booking is cancelled, by anyone. */
export const render: EmailRenderer<'booking-cancelled-guest'> = (d) => {
  const who = (WHO[d.cancelledBy] ?? WHO.system)(d);
  const refunded = !isZeroMoney(d.refund);
  return renderLayout({
    subject: who.subject,
    preheader: refunded ? `${d.refund} is on its way back to you.` : 'No refund is due on this booking.',
    heading: who.heading,
    blocks: [
      p(who.intro),
      refunded
        ? callout('brand', b(`${d.refund} is on its way back`), ' to your payment method and should arrive within 5–10 business days.')
        : p('No refund is due on this booking.'),
      bookingSummary(d, refunded ? [['Refund', d.refund]] : []),
      d.cancelledBy === 'guest' && p('The dates are open to other guests again.'),
      button('View your trip', d.tripUrl),
    ],
    footer: FOOTERS.guest,
  });
};
