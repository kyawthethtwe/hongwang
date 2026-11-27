import { NOTIFICATION_EVENT_INFO, QUEUES, type EmailJob } from '@hongwang/shared';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { UnrecoverableError, type Job } from 'bullmq';
import { isPermanentMailError, MailService } from '../../infra/mail/mail.service';
import { EmailLogRepository } from './email-log.repository';
import { EMAIL_TEMPLATE_EVENT } from './email-policy';
import { NotificationPreferencesService } from './notification-preferences.service';
import { isEmailTemplate, renderEmail, type RenderedEmail } from './templates';

/** Emails sent in parallel by one worker process (also the SMTP pool size). */
export const EMAIL_CONCURRENCY = 5;

/** How far a job's own timestamp may be ahead of the database clock when matching its log row. */
const CLOCK_SKEW_MS = 60_000;
/** email_log.error on a row skipped by preferences. */
export const SKIPPED_BY_PREFERENCES = 'Turned off in the user’s notification preferences';

export type EmailJobResult =
  | { status: 'sent'; logId: string; messageId: string }
  | { status: 'already-sent'; logId: string }
  | { status: 'skipped'; reason: 'preferences' };

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Owner: Notifications & Workers module. Consumes QUEUES.email (worker entrypoint only):
 * render the template, send over SMTP, and keep email_log in step (queued -> sent | failed).
 *
 * Failure handling: SMTP outages and 4xx replies throw, so BullMQ retries with backoff
 * (attempts/backoff in src/infra/queues.module.ts) and the same email_log row is reused.
 * An unknown template, a render error or a permanent 5xx rejection throw UnrecoverableError:
 * retrying can't fix them.
 */
@Processor(QUEUES.email, { concurrency: EMAIL_CONCURRENCY })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly mail: MailService,
    private readonly emailLog: EmailLogRepository,
    private readonly prefs: NotificationPreferencesService,
  ) {
    super();
  }

  async process(job: Job<EmailJob>): Promise<EmailJobResult> {
    const { template, to, data } = job.data;
    const entry = { jobId: job.id ?? null, to: String(to ?? ''), template: String(template), userId: job.data.userId ?? null };

    if (!isEmailTemplate(template)) {
      const error = `Unknown email template "${String(template)}"`;
      await this.emailLog.recordFailure(entry, error).catch((err) => this.logger.error(`email_log write failed: ${errorText(err)}`));
      throw new UnrecoverableError(error);
    }

    const since = new Date(job.timestamp - CLOCK_SKEW_MS);
    if (!(await this.shouldSend(job.data))) {
      this.logger.log(`Skipped ${template} (job ${job.id}): turned off in the user's preferences`);
      await this.emailLog
        .recordSkipped(entry, SKIPPED_BY_PREFERENCES, since)
        .catch((err) => this.logger.error(`email_log write failed: ${errorText(err)}`));
      return { status: 'skipped', reason: 'preferences' };
    }

    const log = await this.emailLog.start(entry, since);
    if (log.status === 'sent') {
      // A retry or stalled re-run of a job whose email already went out: never send twice.
      return { status: 'already-sent', logId: log.id };
    }

    let rendered: RenderedEmail;
    try {
      rendered = renderEmail(template, data);
    } catch (err) {
      const error = `Could not render ${template}: ${errorText(err)}`;
      await this.emailLog.markFailed(log.id, error).catch(() => undefined);
      throw new UnrecoverableError(error);
    }

    let messageId: string;
    try {
      ({ messageId } = await this.mail.send({ to: entry.to, ...rendered }));
    } catch (err) {
      const error = errorText(err);
      await this.emailLog.markFailed(log.id, error).catch(() => undefined);
      if (isPermanentMailError(err)) throw new UnrecoverableError(`SMTP rejected ${template}: ${error}`);
      throw err;
    }

    // The email is out. If this write fails, don't throw: a retry would send it again.
    await this.emailLog
      .markSent(log.id, messageId)
      .catch((err) => this.logger.error(`Sent ${template} (job ${job.id}) but could not update email_log: ${errorText(err)}`));
    this.logger.log(`Sent ${template} (job ${job.id}, log ${log.id})`);
    return { status: 'sent', logId: log.id, messageId };
  }

  /**
   * Preferences hook. Account mail and events whose email channel is locked (every current
   * booking email) are always sent. Later reminder/marketing mail maps to its event in
   * EMAIL_TEMPLATE_EVENT and is skipped when the user turned that event's email off.
   */
  async shouldSend(job: EmailJob): Promise<boolean> {
    const event = EMAIL_TEMPLATE_EVENT[job.template];
    if (!event || NOTIFICATION_EVENT_INFO[event].lockedChannels.includes('email')) return true;
    if (!job.userId) return true;
    return this.prefs.isEnabled(job.userId, event, 'email');
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EmailJob> | undefined, err: Error) {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    const final = err instanceof UnrecoverableError || job.attemptsMade >= attempts;
    const msg = `Email ${job.data.template} (job ${job.id}) failed, attempt ${job.attemptsMade} of ${attempts}: ${err.message}`;
    if (final) this.logger.error(`${msg}. Giving up.`);
    else this.logger.warn(`${msg}. Will retry.`);
  }

  @OnWorkerEvent('error')
  onError(err: Error) {
    // Without a listener, a Redis hiccup on the worker would be an unhandled 'error' event.
    this.logger.error(`Email worker error: ${err.message}`);
  }
}
