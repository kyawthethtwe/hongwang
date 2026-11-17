import { b, button, callout, note, p, renderLayout, type EmailRenderer } from './layout';
import { bookingSummary, FOOTERS, shortRange } from './parts';

/** To the guest when the host approves: the dates are on payment hold. */
export const render: EmailRenderer<'booking-approved-guest'> = (d) => {
  const range = shortRange(d.checkIn, d.checkOut);
  return renderLayout({
    subject: `${d.otherName} approved your stay. Pay by ${d.payBy}`,
    preheader: `${range} is held for you. Pay ${d.total} by ${d.payBy} to confirm.`,
    heading: 'Your request is approved',
    blocks: [
      p(`Good news, ${d.firstName}: ${d.otherName} approved your request for ${d.listingTitle}.`),
      callout('warn', b(`${range} is held for you.`), ` Pay by ${d.payBy} or the dates go back on sale to other guests.`),
      bookingSummary(d, [['Total', d.total]]),
      button(`Pay ${d.total}`, d.checkoutUrl),
      note('You aren’t charged until you pay. If the hold runs out, nothing is charged.'),
    ],
    footer: FOOTERS.guest,
  });
};
