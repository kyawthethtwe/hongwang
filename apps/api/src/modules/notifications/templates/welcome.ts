import { button, p, renderLayout, type EmailRenderer } from './layout';
import { FOOTERS } from './parts';

/** Sent by Auth once the account is verified. */
export const render: EmailRenderer<'welcome'> = (d) =>
  renderLayout({
    subject: `Welcome to Hongwang, ${d.firstName}`,
    preheader: 'Rooms across Bangkok, with the full price shown before you book.',
    heading: `Welcome, ${d.firstName}`,
    blocks: [
      p('Your account is ready. Search rooms near the BTS and MRT, see the full price before you book, and keep your trips and messages in one place.'),
      p('Have a room to rent out? Switch to hosting from the menu whenever you like.'),
      button('Start exploring', d.exploreUrl),
    ],
    footer: FOOTERS.account,
  });
