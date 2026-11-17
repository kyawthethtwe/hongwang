import {
  LOCKED_NOTIFICATIONS_NOTE,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENT_INFO,
  NOTIFICATION_EVENTS,
  type NotificationChannel,
  type NotificationEvent,
  type NotificationPreferenceDto,
  type UpdateNotificationPrefsInput,
} from '@hongwang/shared';
import { badRequest } from '../../common/errors';

/** A notification_preferences row as read from the database. */
export interface StoredPreference {
  event: string;
  channel: string;
  enabled: boolean;
}

export type PreferenceChange = UpdateNotificationPrefsInput['changes'][number];

const CHANNEL_NAMES: Record<NotificationChannel, string> = { email: 'by email', line: 'on LINE', push: 'as push notifications' };

export const isLocked = (event: NotificationEvent, channel: NotificationChannel) =>
  NOTIFICATION_EVENT_INFO[event].lockedChannels.includes(channel);

/** Locked channels are always on; otherwise the stored choice, else the event's default. */
export function resolveEnabled(event: NotificationEvent, channel: NotificationChannel, stored: boolean | undefined): boolean {
  if (isLocked(event, channel)) return true;
  return stored ?? NOTIFICATION_EVENT_INFO[event].defaults.includes(channel);
}

/** Defaults from NOTIFICATION_EVENT_INFO merged with the user's stored rows, in table order. */
export function mergePreferences(rows: readonly StoredPreference[]): NotificationPreferenceDto[] {
  const stored = new Map(rows.map((r) => [`${r.event}:${r.channel}`, r.enabled]));
  return NOTIFICATION_EVENTS.map((event) => {
    const info = NOTIFICATION_EVENT_INFO[event];
    const channels = Object.fromEntries(
      NOTIFICATION_CHANNELS.map((channel) => [
        channel,
        { enabled: resolveEnabled(event, channel, stored.get(`${event}:${channel}`)), locked: isLocked(event, channel) },
      ]),
    ) as NotificationPreferenceDto['channels'];
    return { event, label: info.label, sub: info.sub, channels };
  });
}

/**
 * Validates a PUT body beyond its schema. Turning off a locked channel is a 400 VALIDATION_FAILED
 * with zod-style issues (path changes.<i>.enabled), so the web's fieldErrors() can read it.
 * Returns the rows to upsert: last change per (event, channel) wins; locked channels are not
 * stored (they are always on).
 */
export function normalizeChanges(changes: readonly PreferenceChange[]): PreferenceChange[] {
  const issues = changes.flatMap((c, i) =>
    isLocked(c.event, c.channel) && !c.enabled
      ? [{ path: ['changes', i, 'enabled'], message: `${NOTIFICATION_EVENT_INFO[c.event].label} ${CHANNEL_NAMES[c.channel]} can’t be turned off.` }]
      : [],
  );
  if (issues.length) throw badRequest(`${issues[0]!.message} ${LOCKED_NOTIFICATIONS_NOTE}`, issues);

  const byKey = new Map<string, PreferenceChange>();
  for (const c of changes) {
    if (isLocked(c.event, c.channel)) continue;
    const key = `${c.event}:${c.channel}`;
    byKey.delete(key); // keep the latest change's position
    byKey.set(key, { event: c.event, channel: c.channel, enabled: c.enabled });
  }
  return [...byKey.values()];
}
