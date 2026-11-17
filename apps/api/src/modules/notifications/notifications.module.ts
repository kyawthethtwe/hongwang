import { Global, Module } from '@nestjs/common';
import { EmailPreviewController } from './email-preview.controller';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationsService } from './notifications.service';

/**
 * Owner: Notifications & Workers module. Global so any module can inject NotificationsService.
 * HTTP side only (producers, preferences API, dev email preview). The email processor lives in
 * NotificationsWorkerModule, which only the worker entrypoint imports.
 */
@Global()
@Module({
  controllers: [NotificationPreferencesController, EmailPreviewController],
  providers: [NotificationsService, NotificationPreferencesService],
  exports: [NotificationsService, NotificationPreferencesService],
})
export class NotificationsModule {}
