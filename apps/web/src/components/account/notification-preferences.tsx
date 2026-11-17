'use client';

import {
  LOCKED_NOTIFICATIONS_NOTE,
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
  type NotificationPreferenceDto,
  type UpdateNotificationPrefsInput,
} from '@hongwang/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Banner, Skeleton } from '@/components/ui/feedback';
import { Checkbox } from '@/components/ui/field';
import { apiFetch, errorMessage } from '@/lib/api/client';

/**
 * Owner: Notifications & Workers module. The "Notifications" table on /account (design B6):
 * Event | Email | LINE | Push, from GET/PUT /users/me/notification-preferences.
 * The Auth & Accounts module renders it (and the section heading); keep it prop-less.
 *
 * Each checkbox saves on its own with an optimistic update. A failed save flips just that box
 * back (not the whole table, so quick toggles of other boxes survive) and shows a toast.
 */

export const notificationPreferencesQueryKey = ['users', 'me', 'notification-preferences'] as const;
const mutationKey = [...notificationPreferencesQueryKey, 'update'] as const;
const PATH = '/users/me/notification-preferences';

type Change = UpdateNotificationPrefsInput['changes'][number];

const CHANNEL_LABELS: Record<NotificationChannel, string> = { email: 'Email', line: 'LINE', push: 'Push' };

function applyChange(prefs: NotificationPreferenceDto[] | undefined, change: Change) {
  return prefs?.map((p) =>
    p.event === change.event
      ? { ...p, channels: { ...p.channels, [change.channel]: { ...p.channels[change.channel], enabled: change.enabled } } }
      : p,
  );
}

export function NotificationPreferences() {
  const qc = useQueryClient();
  const noteId = useId();

  const query = useQuery({
    queryKey: notificationPreferencesQueryKey,
    queryFn: () => apiFetch<NotificationPreferenceDto[]>(PATH),
  });

  const mutation = useMutation({
    mutationKey,
    mutationFn: (change: Change) =>
      apiFetch<NotificationPreferenceDto[]>(PATH, { method: 'PUT', body: { changes: [change] } satisfies UpdateNotificationPrefsInput }),
    onMutate: async (change) => {
      await qc.cancelQueries({ queryKey: notificationPreferencesQueryKey });
      qc.setQueryData<NotificationPreferenceDto[]>(notificationPreferencesQueryKey, (old) => applyChange(old, change));
    },
    onError: (err, change) => {
      qc.setQueryData<NotificationPreferenceDto[]>(notificationPreferencesQueryKey, (old) =>
        applyChange(old, { ...change, enabled: !change.enabled }),
      );
      toast.error(errorMessage(err, 'Couldn’t save that change. Please try again.'));
    },
    onSuccess: (data) => {
      // Only the last save in a burst writes the server's table back, so it can't undo a newer toggle.
      if (qc.isMutating({ mutationKey }) === 1) qc.setQueryData(notificationPreferencesQueryKey, data);
    },
    onSettled: (_data, err) => {
      // After a failed save, resync with the server once nothing else is in flight.
      if (err && qc.isMutating({ mutationKey }) === 1) void qc.invalidateQueries({ queryKey: notificationPreferencesQueryKey });
    },
  });

  if (query.isPending) return <PreferencesSkeleton />;

  if (query.isError) {
    return (
      <Banner
        tone="danger"
        title="Couldn’t load your notification settings."
        action={
          <Button variant="outline" size="sm" onClick={() => void query.refetch()} loading={query.isFetching}>
            Try again
          </Button>
        }
      >
        {errorMessage(query.error, 'Please try again.')}
      </Banner>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr className="text-left text-sm text-ink-2">
              <th scope="col" className="border-b border-line py-2.5 font-semibold">
                Event
              </th>
              {NOTIFICATION_CHANNELS.map((channel) => (
                <th key={channel} scope="col" className="border-b border-line px-2.5 py-2.5 text-center font-semibold">
                  {CHANNEL_LABELS[channel]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {query.data.map((pref) => (
              <tr key={pref.event}>
                <th scope="row" className="border-b border-line-soft py-3 pr-3 text-left font-medium">
                  {pref.label}
                  <span className="block text-[13px] font-normal text-muted">{pref.sub}</span>
                </th>
                {NOTIFICATION_CHANNELS.map((channel) => {
                  const { enabled, locked } = pref.channels[channel];
                  return (
                    <td key={channel} className="border-b border-line-soft px-2.5 py-1.5 text-center">
                      <label className="mx-auto flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-center gap-0.5 has-disabled:cursor-not-allowed">
                        <Checkbox
                          className="size-5 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`${CHANNEL_LABELS[channel]} for ${pref.label}`}
                          aria-describedby={locked ? noteId : undefined}
                          checked={locked || enabled}
                          disabled={locked}
                          onChange={(e) => mutation.mutate({ event: pref.event, channel, enabled: e.currentTarget.checked })}
                        />
                        {locked && <span className="text-xs leading-tight text-muted">Always on</span>}
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p id={noteId} className="m-0 text-sm text-muted">
        {LOCKED_NOTIFICATIONS_NOTE}
      </p>
    </div>
  );
}

function PreferencesSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite">
      <span className="sr-only">Loading notification settings</span>
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="flex items-center gap-5 border-b border-line py-3">
            <Skeleton className="h-4 w-16" />
            <span className="flex-1" />
            {NOTIFICATION_CHANNELS.map((c) => (
              <Skeleton key={c} className="h-4 w-11" />
            ))}
          </div>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-5 border-b border-line-soft py-3.5">
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
              {NOTIFICATION_CHANNELS.map((c) => (
                <Skeleton key={c} className="mx-3 size-5 rounded-[5px]" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
