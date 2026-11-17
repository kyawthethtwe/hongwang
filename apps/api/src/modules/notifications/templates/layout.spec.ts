import { b, button, callout, escapeHtml, note, oneLine, p, quote, renderLayout, safeUrl, summary } from './layout';
import { isZeroMoney, plural, possessive, shortRange } from './parts';

describe('escapeHtml', () => {
  it('escapes the HTML special characters', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&\`</a>`)).toBe('&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&#96;&lt;/a&gt;');
  });

  it('leaves Thai text, baht signs and dashes alone', () => {
    expect(escapeHtml('ห้องสตูดิโอ ฿4,290 · Dec 12 – 15')).toBe('ห้องสตูดิโอ ฿4,290 · Dec 12 – 15');
  });

  it('stringifies numbers and nullish values', () => {
    expect(escapeHtml(3)).toBe('3');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('escapes ampersands of existing entities (escape exactly once)', () => {
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });
});

describe('safeUrl', () => {
  it.each(['https://hongwang.app/trips/1', 'http://localhost:3000/checkout/1?x=1&y=2', 'mailto:help@hongwang.app'])('keeps %s', (url) => {
    expect(safeUrl(url)).toBe(url);
  });
  it.each(['javascript:alert(1)', 'data:text/html,hi', '/relative', ''])('replaces %p with #', (url) => {
    expect(safeUrl(url)).toBe('#');
  });
});

describe('oneLine', () => {
  it('removes control characters and squeezes spaces', () => {
    expect(oneLine(' a\r\n\tb   c ')).toBe('a b c');
  });
});

describe('renderLayout', () => {
  const email = renderLayout({
    subject: 'Subject <1>',
    preheader: 'Preview & more',
    heading: 'Heading "2"',
    blocks: [
      p('Hello ', b('<bold>'), '.'),
      callout('warn', b('Held.'), ' Pay soon.'),
      quote('Line 1\nLine <2>', 'Daniel wrote'),
      summary('Room', 'Sat, Dec 12 – Tue, Dec 15', [['Total', '฿4,290']]),
      button('Pay ฿4,290', 'https://x.test/pay?a=1&b=2'),
      note('Small print'),
      null,
      false,
      '',
    ],
    footer: 'Why you got this',
  });

  it('escapes the heading, title, preheader and blocks', () => {
    expect(email.html).toContain('<title>Subject &lt;1&gt;</title>');
    expect(email.html).toContain('Heading &quot;2&quot;');
    expect(email.html).toContain('Preview &amp; more');
    expect(email.html).toContain('<strong style="font-weight:600;color:#142020;">&lt;bold&gt;</strong>');
    expect(email.html).toContain('Line 1<br>Line &lt;2&gt;');
    expect(email.html).toContain('href="https://x.test/pay?a=1&amp;b=2"');
  });

  it('is table-based with inline styles, brand button, wordmark and footer', () => {
    expect(email.html).toContain('role="presentation"');
    expect(email.html).toContain('bgcolor="#0F6B63"');
    expect(email.html).toContain('>Hongwang</td>');
    expect(email.html).toContain('Hongwang · Bangkok');
    expect(email.html).toContain('Why you got this');
    expect(email.html).not.toContain('<style');
  });

  it('renders the same content as plain text', () => {
    expect(email.text).toBe(
      [
        'Hongwang',
        'Heading "2"',
        'Hello <bold>.',
        'Held. Pay soon.',
        'Daniel wrote:\n"Line 1\nLine <2>"',
        'Room\nSat, Dec 12 – Tue, Dec 15\nTotal: ฿4,290',
        'Pay ฿4,290: https://x.test/pay?a=1&b=2',
        'Small print',
        '--\nHongwang · Bangkok\nWhy you got this',
      ].join('\n\n') + '\n',
    );
  });

  it('keeps the subject raw (not HTML-escaped) but on one line', () => {
    expect(email.subject).toBe('Subject <1>');
  });
});

describe('booking parts', () => {
  it('shortRange compacts dates like the design', () => {
    expect(shortRange('Sat, Dec 12', 'Tue, Dec 15')).toBe('Dec 12 – 15');
    expect(shortRange('Wed, Dec 30', 'Sat, Jan 2')).toBe('Dec 30 – Jan 2');
    expect(shortRange('2026-12-12', '2026-12-15')).toBe('2026-12-12 – 2026-12-15');
  });

  it('plural and possessive', () => {
    expect(plural(1, 'night')).toBe('1 night');
    expect(plural(3, 'night')).toBe('3 nights');
    expect(possessive('Ploy')).toBe('Ploy’s');
    expect(possessive('Chris')).toBe('Chris’');
  });

  it('isZeroMoney', () => {
    expect(isZeroMoney('฿0')).toBe(true);
    expect(isZeroMoney('฿0.00')).toBe(true);
    expect(isZeroMoney('฿2,100')).toBe(false);
    expect(isZeroMoney('฿0.50')).toBe(false);
    expect(isZeroMoney('฿10')).toBe(false);
  });
});
