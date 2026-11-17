import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { ENV, type Env } from '../../config/env';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailResult {
  /** The SMTP Message-ID, stored as email_log.provider_message_id */
  messageId: string;
}

/** SMTP connections kept open by the pool; matches the email processor's concurrency. */
export const SMTP_MAX_CONNECTIONS = 5;

/**
 * Turns SMTP_URL into a pooled transport URL unless it already says otherwise.
 * Query params are nodemailer options: smtp://user:pass@host:587?pool=false
 */
export function smtpTransportUrl(url: string, maxConnections = SMTP_MAX_CONNECTIONS): string {
  const u = new URL(url);
  if (!u.searchParams.has('pool')) u.searchParams.set('pool', 'true');
  if (!u.searchParams.has('maxConnections')) u.searchParams.set('maxConnections', String(maxConnections));
  return u.toString();
}

/**
 * True when retrying can't help: the server refused this recipient or message for good
 * (5xx on RCPT TO / DATA, or no valid recipient at all). Connection, auth and 4xx errors are
 * temporary and worth retrying (they usually mean SMTP is down or misconfigured for everyone).
 */
export function isPermanentMailError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: unknown; responseCode?: unknown; command?: unknown };
  const status = typeof e.responseCode === 'number' ? e.responseCode : undefined;
  if (e.code === 'EENVELOPE' && (status === undefined || status >= 500)) return true;
  return status !== undefined && status >= 500 && status < 600 && (e.command === 'RCPT TO' || e.command === 'DATA');
}

/**
 * Owner: Notifications & Workers module. Sends one email over SMTP (Mailpit in dev, see SMTP_URL).
 * Only the email worker uses it; HTTP code queues mail with NotificationsService.sendEmail.
 */
@Injectable()
export class MailService implements OnApplicationShutdown {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.transporter = createTransport(smtpTransportUrl(env.SMTP_URL));
  }

  async send(message: MailMessage): Promise<MailResult> {
    const info = (await this.transporter.sendMail({
      from: this.env.MAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    })) as { messageId?: string };
    if (!info.messageId) this.logger.warn('SMTP server returned no Message-ID');
    return { messageId: info.messageId ?? '' };
  }

  onApplicationShutdown() {
    this.transporter.close();
  }
}
