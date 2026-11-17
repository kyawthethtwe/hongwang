import { button, note, p, renderLayout, type EmailRenderer } from './layout';
import { bookingSummary, FOOTERS, possessive, shortRange } from './parts';

/** To the host once the guest has paid. */
export const render: EmailRenderer<'booking-confirmed-host'> = (d) =>
  renderLayout({
    subject: `Booked: ${d.otherName}, ${shortRange(d.checkIn, d.checkOut)}`,
    preheader: `${d.otherName} paid. You earn ${d.payout}.`,
    heading: 'Your room is booked',
    blocks: [
      p(`Hi ${d.firstName}, ${d.otherName} paid, so ${d.listingTitle} is booked for ${d.checkIn} – ${d.checkOut}. ${possessive(d.otherName)} phone number is now in the reservation.`),
      bookingSummary(d, [['You earn', d.payout]]),
      note('Payouts release 24 hours after check-in.'),
      button('View reservation', d.reservationUrl),
    ],
    footer: FOOTERS.host,
  });
