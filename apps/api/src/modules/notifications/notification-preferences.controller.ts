import { updateNotificationPrefsInputSchema, type NotificationPreferenceDto } from '@hongwang/shared';
import { Body, Controller, Get, Put } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, type AuthUser } from '../../common/auth';
import { NotificationPreferencesService } from './notification-preferences.service';

export class UpdateNotificationPrefsDto extends createZodDto(updateNotificationPrefsInputSchema) {}

/** GET / PUT /users/me/notification-preferences (contract: packages/shared/src/schemas/notifications.ts). */
@Controller('users/me/notification-preferences')
export class NotificationPreferencesController {
  constructor(private readonly prefs: NotificationPreferencesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<NotificationPreferenceDto[]> {
    return this.prefs.list(user.id);
  }

  @Put()
  update(@CurrentUser() user: AuthUser, @Body() body: UpdateNotificationPrefsDto): Promise<NotificationPreferenceDto[]> {
    return this.prefs.update(user.id, body);
  }
}
