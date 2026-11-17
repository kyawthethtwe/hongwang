import { b, button, callout, p, quote, renderLayout, type EmailRenderer } from './layout';
import { bookingSummary, FOOTERS, HOLD_MINUTES, plural, shortRange } from './parts';

/** To the host when a guest sends a request (not instant book). */
export const render: EmailRenderer<'booking-requested-host'> = (d) =>
  renderLayout({
    subject: `New request: ${d.otherName}, ${shortRange(d.checkIn, d.checkOut)}`,
    preheader: `${d.otherName} wants to stay ${plural(d.nights, 'night')} at ${d.listingTitle}. Respond by ${d.respondBy}.`,
    heading: `${d.otherName} wants to stay`,
    blocks: [
      p(`Hi ${d.firstName}, ${d.otherName} asked to book ${d.listingTitle} for ${plural(d.nights, 'night')}.`),
      callout('warn', b(`Respond by ${d.respondBy}.`), ` If you don’t, the request expires and ${d.otherName} isn’t charged.`),
      d.message && quote(d.message, `${d.otherName} wrote`),
      bookingSummary(d, [['You earn', d.payout]]),
      p(`If you approve, ${d.otherName} has ${HOLD_MINUTES} minutes to pay before the dates go back on sale.`),
      button('Review request', d.reservationUrl),
    ],
    footer: FOOTERS.host,
  });
