import type { EmailTemplateData } from '@hongwang/shared';
import { b, button, callout, p, renderLayout, type Block, type EmailRenderer } from './layout';
import { bookingSummary, FOOTERS, possessive, shortRange } from './parts';

type Data = EmailTemplateData['booking-cancelled-host'];

const WHO: Record<Data['cancelledBy'], (d: Data) => { subject: string; heading: string; intro: string; after?: Block }> = {
  guest: (d) => ({
    subject: `${d.otherName} cancelled: ${shortRange(d.checkIn, d.checkOut)}`,
    heading: `${d.otherName} cancelled`,
    intro: `Hi ${d.firstName}, ${d.otherName} cancelled their stay at ${d.listingTitle}. The dates are open for new bookings again.`,
    after: p('Any payout you’re still due under your cancellation policy shows in the reservation.'),
  }),
  host: (d) => ({
    subject: `You cancelled ${possessive(d.otherName)} stay, ${shortRange(d.checkIn, d.checkOut)}`,
    heading: 'Reservation cancelled',
    intro: `Hi ${d.firstName}, you cancelled ${possessive(d.otherName)} stay at ${d.listingTitle}. ${d.otherName} gets a full refund.`,
  }),
  admin: (d) => ({
    subject: `Reservation cancelled: ${d.otherName}, ${shortRange(d.checkIn, d.checkOut)}`,
    heading: 'Reservation cancelled',
    intro: `Hi ${d.firstName}, our support team cancelled ${possessive(d.otherName)} stay at ${d.listingTitle}.`,
  }),
  system: (d) => ({
    subject: `Reservation cancelled: ${d.otherName}, ${shortRange(d.checkIn, d.checkOut)}`,
    heading: 'Reservation cancelled',
    intro: `Hi ${d.firstName}, ${possessive(d.otherName)} stay at ${d.listingTitle} was cancelled.`,
  }),
};

/** To the host whenever one of their reservations is cancelled, by anyone. */
export const render: EmailRenderer<'booking-cancelled-host'> = (d) => {
  const who = (WHO[d.cancelledBy] ?? WHO.system)(d);
  const range = shortRange(d.checkIn, d.checkOut);
  return renderLayout({
    subject: who.subject,
    preheader: d.penalty ? `A ${d.penalty} fee comes out of your next payout.` : `${range} at ${d.listingTitle} is cancelled.`,
    heading: who.heading,
    blocks: [
      p(who.intro),
      d.penalty &&
        callout('warn', b(`A ${d.penalty} fee comes out of your next payout`), d.cancelledBy === 'host' ? `, and ${range} stay blocked so they can’t be rebooked.` : '.'),
      !d.penalty && d.cancelledBy === 'host' && p(`${range} stay blocked so they can’t be rebooked.`),
      bookingSummary(d, d.penalty ? [['Fee', d.penalty]] : []),
      who.after,
      button('View reservation', d.reservationUrl),
    ],
    footer: FOOTERS.host,
  });
};
