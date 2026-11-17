import type { EmailTemplate, EmailTemplateData } from '@hongwang/shared';

/**
 * Shared email layout. Templates describe their content as blocks; this file turns the blocks
 * into table-based HTML with inline styles (what email clients render reliably) and into the
 * plain-text version. Every value that reaches the HTML goes through escapeHtml here, so
 * templates never build HTML strings themselves.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** One template: typed against the exact `data` its senders pass (EmailTemplateData in @hongwang/shared). */
export type EmailRenderer<T extends EmailTemplate> = (data: EmailTemplateData[T]) => RenderedEmail;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

/** Escapes text for HTML element content and double- or single-quoted attributes. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"'`]/g, (c) => HTML_ESCAPES[c] ?? c);
}

/** Only http(s) and mailto links make it into an href; anything else (javascript:, junk) becomes '#'. */
export function safeUrl(url: string): string {
  const trimmed = String(url ?? '').trim();
  try {
    const { protocol } = new URL(trimmed);
    return protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:' ? trimmed : '#';
  } catch {
    return '#';
  }
}

/** Subjects and other header-ish lines: no line breaks or control characters. */
export const oneLine = (s: string) =>
  String(s ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

// ---------------------------------------------------------------------------------------------
// Content model

/** Inline text: a plain string, or a bold run made with b('...'). */
export type Inline = string | { strong: string };
export type Rich = readonly Inline[];

export type Block =
  | { type: 'paragraph'; content: Rich }
  | { type: 'callout'; tone: CalloutTone; content: Rich }
  | { type: 'quote'; text: string; cite: string }
  | { type: 'summary'; title: string; sub: string; rows: ReadonlyArray<readonly [label: string, value: string]> }
  | { type: 'button'; label: string; url: string }
  | { type: 'note'; content: Rich };

export type CalloutTone = 'brand' | 'warn' | 'danger';
export type MaybeBlock = Block | null | undefined | false | '';

export interface EmailContent {
  subject: string;
  /** Inbox preview line, hidden in the body. */
  preheader: string;
  heading: string;
  /** Falsy entries are dropped, so templates can write `d.message && quote(...)`. */
  blocks: ReadonlyArray<MaybeBlock>;
  /** Why the recipient gets this email, under "Hongwang · Bangkok". */
  footer?: string;
}

export const b = (text: string): Inline => ({ strong: text });
export const p = (...content: Inline[]): Block => ({ type: 'paragraph', content });
export const note = (...content: Inline[]): Block => ({ type: 'note', content });
export const callout = (tone: CalloutTone, ...content: Inline[]): Block => ({ type: 'callout', tone, content });
export const quote = (text: string, cite: string): Block => ({ type: 'quote', text, cite });
export const button = (label: string, url: string): Block => ({ type: 'button', label, url });
export const summary = (title: string, sub: string, rows: ReadonlyArray<readonly [string, string]> = []): Block => ({
  type: 'summary',
  title,
  sub,
  rows,
});

// ---------------------------------------------------------------------------------------------
// Styles (design tokens from apps/web/src/app/globals.css, inlined for email clients)

export const EMAIL_COLORS = {
  brand: '#0F6B63',
  brandSoft: '#E3EFEC',
  brandLine: '#A9CFC7',
  brandInk: '#0A3F3A',
  ink: '#142020',
  ink2: '#3E4A48',
  muted: '#5A6664',
  line: '#E3E5E1',
  lineStrong: '#C9CFCA',
  lineSoft: '#EEF0ED',
  canvas: '#F6F7F5',
  surface: '#FFFFFF',
  warnBg: '#FDF1DC',
  warnLine: '#EFCF92',
  warnInk: '#4A3000',
  dangerBg: '#FBE9E7',
  dangerLine: '#EBB8B1',
  dangerInk: '#5C1A12',
} as const;
const C = EMAIL_COLORS;

const FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const DISPLAY_FONT = "'Bricolage Grotesque', Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

const CALLOUT_STYLES: Record<CalloutTone, { bg: string; line: string; ink: string }> = {
  brand: { bg: C.brandSoft, line: C.brandLine, ink: C.brandInk },
  warn: { bg: C.warnBg, line: C.warnLine, ink: C.warnInk },
  danger: { bg: C.dangerBg, line: C.dangerLine, ink: C.dangerInk },
};

const TABLE = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';

function richHtml(content: Rich, strongColor: string = C.ink): string {
  return content
    .map((i) =>
      typeof i === 'string'
        ? escapeHtml(i)
        : `<strong style="font-weight:600;color:${strongColor};">${escapeHtml(i.strong)}</strong>`,
    )
    .join('');
}

const richText = (content: Rich) => content.map((i) => (typeof i === 'string' ? i : i.strong)).join('');

/** Escaped, with the sender's line breaks kept (guest messages). */
const multiline = (s: string) => escapeHtml(s).replace(/\r?\n/g, '<br>');

function blockHtml(block: Block): string {
  switch (block.type) {
    case 'paragraph':
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.ink};">${richHtml(block.content)}</p>`;
    case 'note':
      return `<p style="margin:0 0 12px;font-size:13px;line-height:1.55;color:${C.muted};">${richHtml(block.content, C.ink2)}</p>`;
    case 'callout': {
      const s = CALLOUT_STYLES[block.tone];
      return (
        `<table ${TABLE} width="100%" style="margin:0 0 20px;border-collapse:separate;"><tr>` +
        `<td style="padding:14px 16px;background:${s.bg};border:1px solid ${s.line};border-radius:12px;font-size:15px;line-height:1.55;color:${s.ink};">` +
        `${richHtml(block.content, s.ink)}</td></tr></table>`
      );
    }
    case 'quote':
      return (
        `<table ${TABLE} width="100%" style="margin:0 0 20px;"><tr>` +
        `<td style="padding:2px 0 2px 14px;border-left:3px solid ${C.lineStrong};">` +
        `<p style="margin:0 0 4px;font-size:13px;line-height:1.4;color:${C.muted};">${escapeHtml(block.cite)}</p>` +
        `<p style="margin:0;font-size:15px;line-height:1.6;color:${C.ink2};">&ldquo;${multiline(block.text)}&rdquo;</p>` +
        `</td></tr></table>`
      );
    case 'summary': {
      const rows = block.rows
        .map(
          ([label, value]) =>
            `<tr><td valign="top" style="padding:10px 12px 10px 0;border-top:1px solid ${C.lineSoft};font-size:14px;line-height:1.45;color:${C.muted};">${escapeHtml(label)}</td>` +
            `<td valign="top" align="right" style="padding:10px 0;border-top:1px solid ${C.lineSoft};font-size:14px;line-height:1.45;font-weight:600;color:${C.ink};text-align:right;">${escapeHtml(value)}</td></tr>`,
        )
        .join('');
      return (
        `<table ${TABLE} width="100%" style="margin:0 0 24px;border:1px solid ${C.line};border-radius:14px;border-collapse:separate;">` +
        `<tr><td style="padding:16px 18px ${rows ? '6px' : '16px'};">` +
        `<p style="margin:0;font-size:16px;line-height:1.4;font-weight:600;color:${C.ink};">${escapeHtml(block.title)}</p>` +
        `<p style="margin:4px 0 ${rows ? '10px' : '0'};font-size:14px;line-height:1.45;color:${C.muted};">${escapeHtml(block.sub)}</p>` +
        (rows ? `<table ${TABLE} width="100%">${rows}</table>` : '') +
        `</td></tr></table>`
      );
    }
    case 'button': {
      const href = escapeHtml(safeUrl(block.url));
      return (
        `<table ${TABLE} style="margin:8px 0 12px;"><tr>` +
        `<td align="center" bgcolor="${C.brand}" style="border-radius:12px;background:${C.brand};">` +
        `<a href="${href}" target="_blank" style="display:inline-block;padding:14px 24px;font-family:${FONT};font-size:16px;font-weight:600;line-height:20px;color:#FFFFFF;text-decoration:none;border-radius:12px;">${escapeHtml(block.label)}</a>` +
        `</td></tr></table>` +
        `<p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:${C.muted};">Button not working? Copy this link into your browser:<br>` +
        `<a href="${href}" target="_blank" style="color:${C.brand};word-break:break-all;">${escapeHtml(block.url)}</a></p>`
      );
    }
  }
}

function blockText(block: Block): string {
  switch (block.type) {
    case 'paragraph':
    case 'note':
    case 'callout':
      return richText(block.content);
    case 'quote':
      return `${block.cite}:\n"${block.text}"`;
    case 'summary':
      return [block.title, block.sub, ...block.rows.map(([label, value]) => `${label}: ${value}`)].join('\n');
    case 'button':
      return `${block.label}: ${block.url}`;
  }
}

const isBlock = (b: MaybeBlock): b is Block => Boolean(b);

/** Renders subject, HTML and plain text from one content description. */
export function renderLayout(content: EmailContent): RenderedEmail {
  const subject = oneLine(content.subject);
  const blocks = content.blocks.filter(isBlock);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.canvas};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(oneLine(content.preheader))}${'&#8199;&#847;'.repeat(40)}</div>
<table ${TABLE} width="100%" bgcolor="${C.canvas}" style="background:${C.canvas};">
<tr><td align="center" style="padding:32px 16px 40px;">
<table ${TABLE} width="100%" style="max-width:560px;font-family:${FONT};">
<tr><td style="padding:0 4px 20px;">
<table ${TABLE}><tr>
<td width="32" height="32" align="center" valign="middle" bgcolor="${C.brand}" style="width:32px;height:32px;border-radius:9px;background:${C.brand};color:#FFFFFF;font-family:${DISPLAY_FONT};font-size:17px;font-weight:700;line-height:32px;text-align:center;">H</td>
<td style="padding-left:10px;font-family:${DISPLAY_FONT};font-size:22px;font-weight:700;letter-spacing:-0.02em;line-height:32px;color:${C.ink};">Hongwang</td>
</tr></table>
</td></tr>
<tr><td style="padding:32px 28px 20px;background:${C.surface};border:1px solid ${C.line};border-radius:16px;">
<h1 style="margin:0 0 16px;font-family:${DISPLAY_FONT};font-size:24px;line-height:1.25;font-weight:600;letter-spacing:-0.01em;color:${C.ink};">${escapeHtml(content.heading)}</h1>
${blocks.map(blockHtml).join('\n')}
</td></tr>
<tr><td align="center" style="padding:24px 8px 0;font-size:13px;line-height:1.6;color:${C.muted};text-align:center;">
<p style="margin:0;font-weight:600;color:${C.ink2};">Hongwang · Bangkok</p>
${content.footer ? `<p style="margin:4px 0 0;">${escapeHtml(content.footer)}</p>` : ''}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;

  const text = [
    'Hongwang',
    content.heading,
    ...blocks.map(blockText),
    ['--', 'Hongwang · Bangkok', content.footer].filter(Boolean).join('\n'),
  ].join('\n\n');

  return { subject, html, text: `${text}\n` };
}
