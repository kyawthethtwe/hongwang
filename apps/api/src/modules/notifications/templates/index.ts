import { EMAIL_TEMPLATES, type EmailTemplate, type EmailTemplateData } from '@hongwang/shared';
import * as bookingApprovedGuest from './booking-approved-guest';
import * as bookingCancelledGuest from './booking-cancelled-guest';
import * as bookingCancelledHost from './booking-cancelled-host';
import * as bookingConfirmedGuest from './booking-confirmed-guest';
import * as bookingConfirmedHost from './booking-confirmed-host';
import * as bookingExpiredGuest from './booking-expired-guest';
import * as bookingRejectedGuest from './booking-rejected-guest';
import * as bookingRequestSentGuest from './booking-request-sent-guest';
import * as bookingRequestedHost from './booking-requested-host';
import type { EmailRenderer, RenderedEmail } from './layout';
import * as listingPublishedHost from './listing-published-host';
import * as passwordReset from './password-reset';
import * as verifyEmail from './verify-email';
import * as welcome from './welcome';

export { escapeHtml, type RenderedEmail } from './layout';

/**
 * One renderer per EMAIL_TEMPLATES entry. The mapped type makes this exhaustive: adding a
 * template to @hongwang/shared without a file here is a compile error.
 */
export const EMAIL_RENDERERS: { readonly [T in EmailTemplate]: EmailRenderer<T> } = {
  'verify-email': verifyEmail.render,
  'password-reset': passwordReset.render,
  welcome: welcome.render,
  'booking-requested-host': bookingRequestedHost.render,
  'booking-request-sent-guest': bookingRequestSentGuest.render,
  'booking-approved-guest': bookingApprovedGuest.render,
  'booking-rejected-guest': bookingRejectedGuest.render,
  'booking-expired-guest': bookingExpiredGuest.render,
  'booking-confirmed-guest': bookingConfirmedGuest.render,
  'booking-confirmed-host': bookingConfirmedHost.render,
  'booking-cancelled-guest': bookingCancelledGuest.render,
  'booking-cancelled-host': bookingCancelledHost.render,
  'listing-published-host': listingPublishedHost.render,
};

export function isEmailTemplate(value: unknown): value is EmailTemplate {
  return typeof value === 'string' && (EMAIL_TEMPLATES as readonly string[]).includes(value);
}

/** Renders a template to { subject, html, text }. Throws on an unknown template name. */
export function renderEmail<T extends EmailTemplate>(template: T, data: EmailTemplateData[T]): RenderedEmail {
  if (!isEmailTemplate(template)) throw new Error(`Unknown email template "${String(template)}"`);
  const render: EmailRenderer<T> = EMAIL_RENDERERS[template];
  return render(data);
}
