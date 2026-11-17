import { button, p, renderLayout, type EmailRenderer } from './layout';
import { FOOTERS } from './parts';

/** To the host when a listing goes live (after review, or straight away with AUTO_APPROVE_LISTINGS). */
export const render: EmailRenderer<'listing-published-host'> = (d) =>
  renderLayout({
    subject: `${d.listingTitle} is live on Hongwang`,
    preheader: 'Guests can find it in search and book it now.',
    heading: 'Your listing is live',
    blocks: [
      p(`Hi ${d.firstName}, ${d.listingTitle} is now in search, and guests can book it from today.`),
      p('Keep your calendar up to date so you only get requests you can say yes to.'),
      button('View your listing', d.listingUrl),
    ],
    footer: FOOTERS.host,
  });
