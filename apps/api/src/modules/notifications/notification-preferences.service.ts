import type {
  NotificationChannel,
  NotificationEvent,
  NotificationPreferenceDto,
  UpdateNotificationPrefsInput,
} from '@hongwang/shared';
import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { InjectDb, type Database } from '../../database/database.module';
import { notificationPreferences } from '../../database/schema';
import { isLocked, mergePreferences, normalizeChanges, resolveEnabled } from './preferences';

/**
 * Owner: Notifications & Workers module. Per-user notification choices (design B6).
 * Used by the preferences API and by the email worker's shouldSend hook.
 */
@Injectable()
export class NotificationPreferencesService {
  constructor(@InjectDb() private readonly db: Database) {}

  async list(userId: string): Promise<NotificationPreferenceDto[]> {
    const rows = await this.db
      .select({
        event: notificationPreferences.event,
        channel: notificationPreferences.channel,
        enabled: notificationPreferences.enabled,
      })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return mergePreferences(rows);
  }

  /** Upserts the changed rows and returns the full, merged table. */
  async update(userId: string, input: UpdateNotificationPrefsInput): Promise<NotificationPreferenceDto[]> {
    const changes = normalizeChanges(input.changes);
    if (changes.length) {
      await this.db
        .insert(notificationPreferences)
        .values(changes.map((c) => ({ userId, event: c.event, channel: c.channel, enabled: c.enabled })))
        .onConflictDoUpdate({
          target: [notificationPreferences.userId, notificationPreferences.event, notificationPreferences.channel],
          set: { enabled: sql`excluded.enabled`, updatedAt: new Date() },
        });
    }
    return this.list(userId);
  }

  /** Whether this user wants `event` on `channel` (locked channels are always on). */
  async isEnabled(userId: string, event: NotificationEvent, channel: NotificationChannel): Promise<boolean> {
    if (isLocked(event, channel)) return true;
    const [row] = await this.db
      .select({ enabled: notificationPreferences.enabled })
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.event, event),
          eq(notificationPreferences.channel, channel),
        ),
      )
      .limit(1);
    return resolveEnabled(event, channel, row?.enabled);
  }
}
