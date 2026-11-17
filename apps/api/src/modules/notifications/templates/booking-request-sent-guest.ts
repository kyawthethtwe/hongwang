import { button, p, renderLayout, type EmailRenderer } from './layout';
import { bookingSummary, FOOTERS, HOLD_MINUTES, shortRange } from './parts';

/** To the guest right after they send a request. */
export const render: EmailRenderer<'booking-request-sent-guest'> = (d) =>
  renderLayout({
    subject: `Request sent to ${d.otherName}: ${shortRange(d.checkIn, d.checkOut)}`,
    preheader: `${d.otherName} has until ${d.respondBy} to answer. You haven’t been charged.`,
    heading: 'Your request is sent',
    blocks: [
      p(`Hi ${d.firstName}, we’ve sent your request to ${d.otherName}, who has until ${d.respondBy} to answer. You haven’t been charged.`),
      bookingSummary(d, [['Total', d.total]]),
      p(`If ${d.otherName} approves, the dates are held for you for ${HOLD_MINUTES} minutes while you pay.`),
      button('View your trip', d.tripUrl),
    ],
    footer: FOOTERS.guest,
  });
