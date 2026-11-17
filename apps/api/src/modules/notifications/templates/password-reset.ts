import { button, note, p, renderLayout, type EmailRenderer } from './layout';
import { FOOTERS } from './parts';

/** Sent by Auth from "Forgot your password?". */
export const render: EmailRenderer<'password-reset'> = (d) =>
  renderLayout({
    subject: 'Reset your Hongwang password',
    preheader: 'Set a new password with the link inside.',
    heading: 'Reset your password',
    blocks: [
      p(`Hi ${d.firstName}, we got a request to reset the password for your Hongwang account. Set a new one with the button below.`),
      button('Set a new password', d.resetUrl),
      d.expiresIn && note(`It works for ${d.expiresIn}.`),
      note('Didn’t ask for this? Ignore this email and your password stays the same.'),
    ],
    footer: FOOTERS.account,
  });
