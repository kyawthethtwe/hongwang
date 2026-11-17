import { b, button, callout, p, renderLayout, type EmailRenderer } from './layout';
import { bookingSummary, FOOTERS, possessive, shortRange } from './parts';

/** To the guest once payment lands: the receipt, with the address unlocked. */
export const render: EmailRenderer<'booking-confirmed-guest'> = (d) =>
  renderLayout({
    subject: `Confirmed: ${d.listingTitle}, ${shortRange(d.checkIn, d.checkOut)}`,
    preheader: `You’re booked. Check in ${d.checkIn} from ${d.checkInFrom}.`,
    heading: 'Your stay is confirmed',
    blocks: [
      p(`Hi ${d.firstName}, you’re booked at ${d.listingTitle}.`),
      callout('brand', b('Payment received.'), ` The address and ${possessive(d.otherName)} contact details are now unlocked.`),
      bookingSummary(d, [
        ['Address', d.address],
        ['Check-in', `${d.checkIn}, from ${d.checkInFrom}`],
        ['Check-out', `${d.checkOut}, by ${d.checkOutBy}`],
        ['Paid', d.total],
      ]),
      p(`Questions before you arrive? Message ${d.otherName} from your trip page.`),
      button('View your trip', d.tripUrl),
    ],
    footer: FOOTERS.guest,
  });
