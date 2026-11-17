import { button, p, renderLayout, type EmailRenderer } from './layout';
import { bookingSummary, FOOTERS, shortRange } from './parts';

/** To the guest when the host declines the request. */
export const render: EmailRenderer<'booking-rejected-guest'> = (d) =>
  renderLayout({
    subject: `${d.otherName} can’t host you on ${shortRange(d.checkIn, d.checkOut)}`,
    preheader: 'You haven’t been charged. Other rooms may be free for the same dates.',
    heading: 'Your request was declined',
    blocks: [
      p(`Hi ${d.firstName}, ${d.otherName} can’t host you at ${d.listingTitle} this time. You haven’t been charged.`),
      bookingSummary(d),
      p('Other rooms nearby may still be free for the same dates.'),
      button('Find another room', d.searchUrl),
    ],
    footer: FOOTERS.guest,
  });
