import { z } from 'zod';
import { NOTIFICATION_CHANNELS, type NotificationChannel } from '../enums';

/**
 * Notifications contract. Owner: Notifications & Workers module.
 *
 *   GET /users/me/notification-preferences    -                              -> NotificationPreferenceDto[]
 *   PUT /users/me/notification-preferences    UpdateNotificationPrefsInput   -> NotificationPreferenceDto[]
 *
 * Booking and payment emails are always sent (they hold receipts and check-in details), so their
 * email channel is `locked`: PUT rejects turning it off with 400 VALIDATION_FAILED. LINE and push
 * choices are stored now and delivered later. Labels and sub-lines follow design B6.
 */

export const NOTIFICATION_EVENTS = [
  'booking_updates',
  'messages',
  'reminders',
  'price_drops',
  'news',
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export const NOTIFICATION_EVENT_INFO: Record<
  NotificationEvent,
  { label: string; sub: string; lockedChannels: NotificationChannel[]; defaults: NotificationChannel[] }
> = {
  booking_updates: {
    label: 'Booking updates',
    sub: 'Requests, holds, confirmations, check-in codes',
    lockedChannels: ['email'],
    defaults: ['email', 'push'],
  },
  messages: { label: 'Messages', sub: 'New messages from hosts or guests', lockedChannels: [], defaults: ['email', 'push'] },
  reminders: { label: 'Trip reminders', sub: 'Check-in details and reviews to write', lockedChannels: [], defaults: ['email', 'push'] },
  price_drops: { label: 'Saved rooms', sub: 'Price drops and availability', lockedChannels: [], defaults: ['email'] },
  news: { label: 'Tips and offers', sub: 'Occasional news from Hongwang', lockedChannels: [], defaults: [] },
};

/** Shown under the table on /account (design B6) and returned with 400s for locked channels. */
export const LOCKED_NOTIFICATIONS_NOTE =
  'Booking and payment emails are always sent, because they hold your receipt and check-in details.';

export interface NotificationPreferenceDto {
  event: NotificationEvent;
  label: string;
  sub: string;
  channels: Record<NotificationChannel, { enabled: boolean; locked: boolean }>;
}

export const updateNotificationPrefsInputSchema = z.object({
  changes: z
    .array(
      z.object({
        event: z.enum(NOTIFICATION_EVENTS),
        channel: z.enum(NOTIFICATION_CHANNELS),
        enabled: z.boolean(),
      }),
    )
    .min(1)
    .max(50),
});
export type UpdateNotificationPrefsInput = z.infer<typeof updateNotificationPrefsInputSchema>;
