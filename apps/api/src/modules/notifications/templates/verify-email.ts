import { button, note, p, renderLayout, type EmailRenderer } from './layout';
import { FOOTERS } from './parts';

/** Sent by Auth on sign-up and when the user asks for a new link. */
export const render: EmailRenderer<'verify-email'> = (d) =>
  renderLayout({
    subject: 'Confirm your email for Hongwang',
    preheader: 'One tap to confirm, then you can book rooms and message hosts.',
    heading: 'Confirm your email',
    blocks: [
      p(`Hi ${d.firstName}, tap the button to confirm this is your email address. Then you can book rooms and message hosts.`),
      button('Confirm email', d.verifyUrl),
      d.expiresIn && note(`The link works for ${d.expiresIn}.`),
      note('Didn’t create a Hongwang account? You can ignore this email.'),
    ],
    footer: FOOTERS.account,
  });
