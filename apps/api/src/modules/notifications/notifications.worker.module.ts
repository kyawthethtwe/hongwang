import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { MailModule } from '../../infra/mail/mail.module';
import { EmailLogRepository } from './email-log.repository';
import { EmailProcessor } from './email.processor';
import { WorkerLifecycle } from './worker-lifecycle';

/**
 * Owner: Notifications & Workers module.
 * Consumers for QUEUES.email (render template, send via SMTP, write email_log), plus the
 * worker-process lifecycle (startup log of consumed queues, draining jobs on SIGTERM).
 * Imported only by src/worker.module.ts. NotificationPreferencesService comes from the global
 * NotificationsModule (CoreModule).
 */
@Module({
  imports: [MailModule, DiscoveryModule],
  providers: [EmailProcessor, EmailLogRepository, WorkerLifecycle],
  exports: [WorkerLifecycle],
})
export class NotificationsWorkerModule {}
