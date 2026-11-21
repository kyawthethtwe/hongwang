import { QUEUES, type EmailJob, type EmailTemplate } from '@hongwang/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';

/**
 * Owner: Notifications & Workers module.
 * The one way other modules send email. It only enqueues; the worker renders and sends.
 *
 *   await this.notifications.sendEmail({ template: 'password-reset', to: email, data: { firstName, resetUrl } });
 * `data` is type-checked against EmailTemplateData in @hongwang/shared.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@InjectQueue(QUEUES.email) private readonly emailQueue: Queue<EmailJob>) {}

  async sendEmail<T extends EmailTemplate>(job: EmailJob<T>, opts: { delayMs?: number; jobId?: string } = {}): Promise<void> {
    await this.emailQueue.add(job.template, job, { delay: opts.delayMs, jobId: opts.jobId });
    this.logger.debug(`Queued ${job.template} to ${job.to}`);
  }
}
