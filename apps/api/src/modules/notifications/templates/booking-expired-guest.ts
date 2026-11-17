import { button, p, renderLayout, type EmailRenderer } from './layout';
import { bookingSummary, FOOTERS, HOLD_MINUTES, REQUEST_HOURS, shortRange } from './parts';

/** To the guest when a request goes unanswered (reason 'request') or the payment hold runs out ('hold'). */
export const render: EmailRenderer<'booking-expired-guest'> = (d) => {
  const range = shortRange(d.checkIn, d.checkOut);
  if (d.reason === 'hold') {
    return renderLayout({
      subject: `Your hold on ${range} has expired`,
      preheader: 'The dates are back on sale and you haven’t been charged.',
      heading: 'Your hold has expired',
      blocks: [
        p(`Hi ${d.firstName}, the ${HOLD_MINUTES} minutes to pay for ${d.listingTitle} ran out. The dates are back on sale and you haven’t been charged.`),
        bookingSummary(d),
        p('If they’re still free, you can book them again.'),
        button('Check the dates again', d.listingUrl),
      ],
      footer: FOOTERS.guest,
    });
  }
  return renderLayout({
    subject: `Your request to ${d.otherName} has expired`,
    preheader: `${d.otherName} didn’t answer in time. You haven’t been charged.`,
    heading: 'Your request has expired',
    blocks: [
      p(`Hi ${d.firstName}, ${d.otherName} didn’t answer your request within ${REQUEST_HOURS} hours, so it has expired. You haven’t been charged.`),
      bookingSummary(d),
      p('The dates may still be free. Try again, or look at other rooms nearby.'),
      button('Check the dates again', d.listingUrl),
    ],
    footer: FOOTERS.guest,
  });
};
