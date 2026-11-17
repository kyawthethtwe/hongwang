import { ERROR_CODES, type BookingActor, type BookingStatus, type BookingTransition } from '@hongwang/shared';
import { createMockDb } from '../../../test/helpers/mock-db';
import { applyTransition, assertTransition } from './booking-transitions';

describe('assertTransition (state machine guard)', () => {
  const allowed: [BookingStatus, BookingTransition, BookingActor, BookingStatus][] = [
    ['requested', 'approve', 'host', 'payment_hold'],
    ['requested', 'reject', 'host', 'rejected'],
    ['requested', 'expire', 'system', 'expired'],
    ['payment_hold', 'expire', 'system', 'expired'],
    ['payment_hold', 'pay', 'system', 'confirmed'],
    ['confirmed', 'complete', 'system', 'completed'],
    ['requested', 'cancel', 'guest', 'cancelled'],
    ['payment_hold', 'cancel', 'guest', 'cancelled'],
    ['confirmed', 'cancel', 'guest', 'cancelled'],
    ['confirmed', 'cancel', 'host', 'cancelled'],
    ['payment_hold', 'cancel', 'admin', 'cancelled'],
  ];
  it.each(allowed)('%s --%s by %s--> %s', (from, t, actor, to) => {
    expect(assertTransition(from, t, actor)).toBe(to);
  });

  const forbidden: [BookingStatus, BookingTransition, BookingActor][] = [
    ['requested', 'approve', 'guest'], // a guest can't approve their own request
    ['requested', 'approve', 'admin'],
    ['payment_hold', 'approve', 'host'], // already approved
    ['requested', 'cancel', 'host'], // hosts decline requests instead
    ['payment_hold', 'cancel', 'host'],
    ['payment_hold', 'pay', 'guest'], // only the webhook/simulator confirms
    ['cancelled', 'cancel', 'guest'],
    ['completed', 'cancel', 'admin'],
    ['expired', 'pay', 'system'],
    ['confirmed', 'expire', 'system'],
  ];
  it.each(forbidden)('%s --%s by %s--> 409', (from, t, actor) => {
    expect(() => assertTransition(from, t, actor)).toThrow(
      expect.objectContaining({ code: ERROR_CODES.invalidTransition }),
    );
  });
});

describe('applyTransition', () => {
  const booking = { id: 'b1', status: 'payment_hold' as const };

  it('throws before touching the database when the state machine forbids it', async () => {
    const m = createMockDb();
    await expect(applyTransition(m.db, { booking, transition: 'approve', actor: 'host' })).rejects.toMatchObject({
      code: ERROR_CODES.invalidTransition,
    });
    expect(m.queries).toHaveLength(0);
  });

  it('updates conditionally on the current status and logs an event', async () => {
    const m = createMockDb([[{ id: 'b1', status: 'expired' }], []]);
    const row = await applyTransition(m.db, {
      booking,
      transition: 'expire',
      actor: 'system',
      set: { expiredAt: new Date(0) },
      note: 'hold ran out',
    });
    expect(row).toMatchObject({ id: 'b1', status: 'expired' });
    const [update, insert] = m.queries;
    expect(update!.kind).toBe('update');
    expect(update!.set).toMatchObject({ status: 'expired', expiredAt: new Date(0) });
    expect(update!.ops.map((o) => o.name)).toEqual(['update', 'set', 'where', 'returning']);
    expect(insert!.kind).toBe('insert');
    expect(insert!.values).toMatchObject({ bookingId: 'b1', fromStatus: 'payment_hold', toStatus: 'expired', actor: 'system' });
  });

  it('returns null and logs nothing when another writer changed the row first', async () => {
    const m = createMockDb([[]]);
    const row = await applyTransition(m.db, { booking, transition: 'pay', actor: 'system' });
    expect(row).toBeNull();
    expect(m.ops('insert')).toHaveLength(0);
  });
});
