import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** SMTP transport. Imported by NotificationsWorkerModule only: the HTTP app never sends mail inline. */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
