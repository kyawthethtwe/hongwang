import { EMAIL_TEMPLATES, type BookingEmailBase, type EmailTemplate, type EmailTemplateData } from '@hongwang/shared';
import { EMAIL_RENDERERS, escapeHtml, isEmailTemplate, renderEmail } from './index';
import { emailSamples, MAIN_URL_KEY, type EmailSample } from './samples';

const ORIGIN = 'http://localhost:3000';
const samples = emailSamples(ORIGIN);

type AnySample = { template: EmailTemplate; variant: string; data: EmailTemplateData[EmailTemplate] };
const allSamples: AnySample[] = EMAIL_TEMPLATES.flatMap((template) =>
  (samples[template] as readonly EmailSample<EmailTemplate>[]).map((s) => ({ template, variant: s.variant, data: s.data })),
);

const isBooking = (d: object): d is BookingEmailBase => 'ref' in d && 'checkIn' in d;
const mainUrl = (template: EmailTemplate, data: object) => (data as Record<string, string>)[MAIN_URL_KEY[template]]!;

describe('email templates', () => {
  it('has a renderer and sample data for every EMAIL_TEMPLATES entry', () => {
    expect(Object.keys(EMAIL_RENDERERS).sort()).toEqual([...EMAIL_TEMPLATES].sort());
    expect(Object.keys(samples).sort()).toEqual([...EMAIL_TEMPLATES].sort());
  });

  describe.each(allSamples.map((s) => [`${s.template} (${s.variant})`, s] as const))('%s', (_name, { template, data }) => {
    const email = renderEmail(template, data);
    const url = mainUrl(template, data);

    it('has a subject on one line', () => {
      expect(email.subject.trim().length).toBeGreaterThan(5);
      expect(email.subject).not.toMatch(/[\r\n]/);
    });

    it('renders the shared layout with the main URL on a button', () => {
      expect(email.html).toMatch(/^<!doctype html>/);
      expect(email.html).toContain('Hongwang · Bangkok');
      expect(email.html).toContain('#0F6B63');
      expect(email.html).toContain(`href="${escapeHtml(url)}"`);
      expect(email.html).toContain(escapeHtml(data.firstName));
    });

    it('has a plain-text version with the main URL', () => {
      expect(email.text.length).toBeGreaterThan(80);
      expect(email.text).toContain(url);
      expect(email.text).toContain(data.firstName);
      expect(email.text).toContain('Hongwang · Bangkok');
      expect(email.text).not.toMatch(/<[a-z][^>]*>/i);
    });

    if (isBooking(data)) {
      it('shows listing, dates, nights, guests and the booking ref', () => {
        for (const part of [data.listingTitle, data.checkIn, data.checkOut, `${data.nights} nights`, `${data.guests} guests`, data.ref]) {
          expect(email.html).toContain(escapeHtml(part));
          expect(email.text).toContain(part);
        }
      });
    }
  });

  it('matches the design voice on key emails', () => {
    const approved = renderEmail('booking-approved-guest', samples['booking-approved-guest'][0].data);
    expect(approved.text).toContain('Dec 12 – 15 is held for you.');
    expect(approved.text).toContain('Pay ฿4,290: ');

    const hold = renderEmail('booking-expired-guest', samples['booking-expired-guest'][0].data);
    expect(hold.subject).toBe('Your hold on Dec 12 – 15 has expired');
    expect(hold.text).toContain('The dates are back on sale and you haven’t been charged.');

    const confirmed = renderEmail('booking-confirmed-guest', samples['booking-confirmed-guest'][0].data);
    expect(confirmed.text).toContain('Check-in: Sat, Dec 12, from 14:00');
    expect(confirmed.text).toContain('Ploy’s contact details are now unlocked');

    const hostCancel = renderEmail('booking-cancelled-host', samples['booking-cancelled-host'][1]!.data);
    expect(hostCancel.text).toContain('A ฿372 fee comes out of your next payout, and Dec 12 – 15 stay blocked');

    const noRefund = renderEmail('booking-cancelled-guest', samples['booking-cancelled-guest'][2]!.data);
    expect(noRefund.text).toContain('No refund is due');
    expect(noRefund.text).not.toContain('on its way back');
  });

  it('shows the guest message to the host, keeping line breaks', () => {
    const [withMessage, withoutMessage] = samples['booking-requested-host'];
    const a = renderEmail('booking-requested-host', withMessage.data);
    expect(a.html).toContain('Daniel wrote');
    expect(a.html).toContain('that week.<br>Could I');
    const b = renderEmail('booking-requested-host', withoutMessage!.data);
    expect(b.html).not.toContain('Daniel wrote');
  });

  describe('escaping', () => {
    const evil = '<script>alert("x")</script> & \'quotes\'';

    it.each(allSamples.map((s) => [`${s.template} (${s.variant})`, s] as const))('%s escapes every interpolated value', (_n, { template, data }) => {
      const hostile = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, typeof v === 'string' && !k.endsWith('Url') && k !== 'reason' && k !== 'cancelledBy' ? `${v} ${evil}` : v]),
      ) as typeof data;
      const { html, subject, text } = renderEmail(template, hostile);
      expect(html).not.toContain('<script>');
      expect(html).not.toContain(`"x"`);
      expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;quotes&#39;');
      expect(text).toContain(evil); // plain text is not HTML-escaped
      expect(subject).not.toMatch(/[\r\n]/);
    });

    it('escapes URLs in attributes and neutralises non-http links', () => {
      const data = { firstName: 'Ploy', listingTitle: 'Room', listingUrl: 'https://hongwang.test/rooms/1?a=1&b="2"' };
      const { html } = renderEmail('listing-published-host', data);
      expect(html).toContain('href="https://hongwang.test/rooms/1?a=1&amp;b=&quot;2&quot;"');

      const bad = renderEmail('listing-published-host', { ...data, listingUrl: 'javascript:alert(1)' });
      expect(bad.html).not.toContain('href="javascript:');
      expect(bad.html).toContain('href="#"');
    });

    it('strips line breaks from subjects', () => {
      const { subject } = renderEmail('welcome', { firstName: 'Ploy\r\nBcc: someone@example.com', exploreUrl: ORIGIN });
      expect(subject).toBe('Welcome to Hongwang, Ploy Bcc: someone@example.com');
    });
  });

  it('rejects unknown templates', () => {
    expect(isEmailTemplate('booking-confirmed-guest')).toBe(true);
    expect(isEmailTemplate('nope')).toBe(false);
    expect(() => renderEmail('nope' as EmailTemplate, {} as never)).toThrow('Unknown email template "nope"');
  });

  it('uses singular nights and guests', () => {
    const data = { ...samples['booking-confirmed-host'][0].data, nights: 1, guests: 1, checkOut: 'Sun, Dec 13' };
    const { text } = renderEmail('booking-confirmed-host', data);
    expect(text).toContain('Sat, Dec 12 – Sun, Dec 13 · 1 night · 1 guest');
  });
});
