import { b, button, callout, p, renderLayout, type EmailRenderer } from './layout';
import { bookingSummary, FOOTERS, shortRange } from './parts';

/**
 * To the guest when their payment arrived after the booking had already ended (the hold ran out,
 * or it was cancelled or declined) and was refunded in full (PaymentsService.confirmPayment).
 */
export const render: EmailRenderer<'booking-payment-refunded-late'> = (d) =>
  renderLayout({
    subject: `We refunded your payment for ${d.listingTitle}`,
    preheader: `Your payment arrived after the booking ended, so we sent all ${d.refund} back.`,
    heading: 'Your payment was refunded',
    blocks: [
      p(
        `Hi ${d.firstName}, your payment for ${d.listingTitle} (${shortRange(d.checkIn, d.checkOut)}) arrived after this booking had already ended, so you don’t have a booking and we’ve refunded it in full.`,
      ),
      callout('brand', b(`${d.refund} refunded.`), ' Your bank may take a few business days to show it.'),
      bookingSummary(d),
      p('If the dates are still free, you can book them again.'),
      button('Check the dates again', d.listingUrl),
    ],
    footer: FOOTERS.guest,
  });
