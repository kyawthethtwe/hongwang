import { ERROR_CODES, NOTIFICATION_EVENTS, type UpdateNotificationPrefsInput } from '@hongwang/shared';
import { AppException } from '../../common/errors';
import { NotificationPreferencesService } from './notification-preferences.service';
import { mergePreferences, normalizeChanges, resolveEnabled } from './preferences';
import { fakeDb } from './testing';

const USER = '11111111-1111-4111-8111-111111111111';

describe('mergePreferences', () => {
  it('returns every event in table order with defaults when nothing is stored', () => {
    const prefs = mergePreferences([]);
    expect(prefs.map((p) => p.event)).toEqual([...NOTIFICATION_EVENTS]);
    const booking = prefs[0]!;
    expect(booking).toEqual({
      event: 'booking_updates',
      label: 'Booking updates',
      sub: 'Requests, holds, confirmations, check-in codes',
      channels: {
        email: { enabled: true, locked: true },
        line: { enabled: false, locked: false },
        push: { enabled: true, locked: false },
      },
    });
    expect(prefs.find((p) => p.event === 'news')!.channels.email).toEqual({ enabled: false, locked: false });
  });

  it('applies stored rows over defaults, but never turns a locked channel off', () => {
    const prefs = mergePreferences([
      { event: 'messages', channel: 'email', enabled: false },
      { event: 'news', channel: 'line', enabled: true },
      { event: 'booking_updates', channel: 'email', enabled: false },
      { event: 'booking_updates', channel: 'line', enabled: true },
      { event: 'retired_event', channel: 'email', enabled: true },
    ]);
    const by = (e: string) => prefs.find((p) => p.event === e)!.channels;
    expect(by('messages').email.enabled).toBe(false);
    expect(by('messages').push.enabled).toBe(true);
    expect(by('news').line.enabled).toBe(true);
    expect(by('booking_updates').email).toEqual({ enabled: true, locked: true });
    expect(by('booking_updates').line.enabled).toBe(true);
    expect(prefs).toHaveLength(NOTIFICATION_EVENTS.length);
  });

  it('resolveEnabled: locked > stored > default', () => {
    expect(resolveEnabled('booking_updates', 'email', false)).toBe(true);
    expect(resolveEnabled('price_drops', 'email', undefined)).toBe(true);
    expect(resolveEnabled('price_drops', 'email', false)).toBe(false);
    expect(resolveEnabled('price_drops', 'push', undefined)).toBe(false);
  });
});

describe('normalizeChanges', () => {
  it('rejects turning off a locked channel with 400 VALIDATION_FAILED and a field path', () => {
    const changes: UpdateNotificationPrefsInput['changes'] = [
      { event: 'messages', channel: 'push', enabled: false },
      { event: 'booking_updates', channel: 'email', enabled: false },
    ];
    let error: unknown;
    try {
      normalizeChanges(changes);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(AppException);
    const ex = error as AppException;
    expect(ex.getStatus()).toBe(400);
    expect(ex.code).toBe(ERROR_CODES.validation);
    expect(ex.message).toContain('Booking updates by email can’t be turned off.');
    expect(ex.details).toEqual([{ path: ['changes', 1, 'enabled'], message: 'Booking updates by email can’t be turned off.' }]);
  });

  it('keeps the last change per event and channel, and skips locked channels being enabled', () => {
    expect(
      normalizeChanges([
        { event: 'messages', channel: 'push', enabled: false },
        { event: 'booking_updates', channel: 'email', enabled: true },
        { event: 'news', channel: 'line', enabled: true },
        { event: 'messages', channel: 'push', enabled: true },
      ]),
    ).toEqual([
      { event: 'news', channel: 'line', enabled: true },
      { event: 'messages', channel: 'push', enabled: true },
    ]);
  });
});

describe('NotificationPreferencesService', () => {
  it('list merges the stored rows for the user', async () => {
    const fake = fakeDb([[{ event: 'messages', channel: 'email', enabled: false }]]);
    const prefs = await new NotificationPreferencesService(fake.db as never).list(USER);
    expect(prefs.find((p) => p.event === 'messages')!.channels.email.enabled).toBe(false);
    expect(fake.chains[0]!.map((c) => c.op)).toEqual(['select', 'from', 'where']);
  });

  it('update upserts the changed rows, then returns the merged table', async () => {
    const fake = fakeDb([undefined, [{ event: 'news', channel: 'line', enabled: true }]]);
    const prefs = await new NotificationPreferencesService(fake.db as never).update(USER, {
      changes: [{ event: 'news', channel: 'line', enabled: true }],
    });
    expect(fake.chains[0]!.map((c) => c.op)).toEqual(['insert', 'values', 'onConflictDoUpdate']);
    expect(fake.call(0, 'values')).toEqual([[{ userId: USER, event: 'news', channel: 'line', enabled: true }]]);
    const conflict = fake.call(0, 'onConflictDoUpdate')![0] as { target: unknown[]; set: Record<string, unknown> };
    expect(conflict.target).toHaveLength(3);
    expect(Object.keys(conflict.set).sort()).toEqual(['enabled', 'updatedAt']);
    expect(prefs.find((p) => p.event === 'news')!.channels.line.enabled).toBe(true);
  });

  it('update with a locked channel turned off fails before touching the database', async () => {
    const fake = fakeDb();
    await expect(
      new NotificationPreferencesService(fake.db as never).update(USER, {
        changes: [{ event: 'booking_updates', channel: 'email', enabled: false }],
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.validation });
    expect(fake.chains).toHaveLength(0);
  });

  it('update with only no-op changes skips the write', async () => {
    const fake = fakeDb([[]]);
    await new NotificationPreferencesService(fake.db as never).update(USER, {
      changes: [{ event: 'booking_updates', channel: 'email', enabled: true }],
    });
    expect(fake.chains.map((c) => c[0]!.op)).toEqual(['select']);
  });

  it('isEnabled: locked channels skip the query; otherwise stored row or default', async () => {
    const locked = fakeDb();
    expect(await new NotificationPreferencesService(locked.db as never).isEnabled(USER, 'booking_updates', 'email')).toBe(true);
    expect(locked.chains).toHaveLength(0);

    const off = fakeDb([[{ enabled: false }]]);
    expect(await new NotificationPreferencesService(off.db as never).isEnabled(USER, 'messages', 'email')).toBe(false);

    const none = fakeDb([[]]);
    expect(await new NotificationPreferencesService(none.db as never).isEnabled(USER, 'messages', 'email')).toBe(true);
  });
});
