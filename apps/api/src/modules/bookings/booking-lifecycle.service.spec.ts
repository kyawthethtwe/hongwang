import { createMockDb } from '../../../test/helpers/mock-db';
import { BookingLifecycleService } from './booking-lifecycle.service';
import { BookingTimeoutsProcessor } from './booking-timeouts.processor';

function setup(results: unknown[]) {
  const m = createMockDb(results);
  const emails = { expired: jest.fn() };
  const refunds = { cancelPending: jest.fn() };
  const service = new BookingLifecycleService(m.db, emails as never, refunds as never);
  return { m, service, emails, refunds };
}

const NOW = new Date('2026-12-01T03:00:00Z');

describe('BookingLifecycleService', () => {
  it('expires an overdue hold once: conditional on status and deadline', async () => {
    const { m, service, emails, refunds } = setup([[{ id: 'b1', status: 'expired' }], []]);
    await expect(service.expireHold('b1', NOW)).resolves.toBe(true);
    expect(m.ops('update')[0]!.set).toMatchObject({ status: 'expired', expiredAt: NOW });
    expect(m.ops('insert')[0]!.values).toMatchObject({ fromStatus: 'payment_hold', toStatus: 'expired', actor: 'system' });
    expect(refunds.cancelPending).toHaveBeenCalledWith('b1');
    expect(emails.expired).toHaveBeenCalledWith('b1', 'hold');
  });

  it('is a no-op when the booking was paid, cancelled or already expired', async () => {
    const { m, service, emails } = setup([[]]);
    await expect(service.expireHold('b1', NOW)).resolves.toBe(false);
    expect(m.ops('insert')).toHaveLength(0);
    expect(emails.expired).not.toHaveBeenCalled();
  });

  it('expires unanswered requests and emails the guest', async () => {
    const { service, emails } = setup([[{ id: 'r1' }], []]);
    await expect(service.expireRequest('r1', NOW)).resolves.toBe(true);
    expect(emails.expired).toHaveBeenCalledWith('r1', 'request');
  });

  it('completes stays after check-out', async () => {
    const { m, service } = setup([[{ id: 's1' }], []]);
    await expect(service.completeStay('s1', NOW)).resolves.toBe(true);
    expect(m.ops('update')[0]!.set).toMatchObject({ status: 'completed', completedAt: NOW });
  });

  it('sweep runs every overdue booking through the same idempotent steps', async () => {
    const { service } = setup([
      [{ id: 'h1' }], // overdue holds
      [{ id: 'r1' }], // overdue requests
      [{ id: 's1' }], // stays to complete
      [{ id: 'h1' }], [], // h1 expired
      [], // r1: someone else got there first
      [{ id: 's1' }], [], // s1 completed
    ]);
    await expect(service.sweep(NOW)).resolves.toEqual({ holdsExpired: 1, requestsExpired: 0, staysCompleted: 1 });
  });
});

describe('BookingTimeoutsProcessor', () => {
  const lifecycle = {
    expireHold: jest.fn(async () => true),
    expireRequest: jest.fn(async () => true),
    completeStay: jest.fn(async () => true),
    sweep: jest.fn(async () => ({ holdsExpired: 0, requestsExpired: 0, staysCompleted: 0 })),
  };
  const processor = new BookingTimeoutsProcessor(lifecycle as never);
  const job = (name: string, data: object = { bookingId: 'b1' }) => ({ name, data }) as never;

  it('routes each job to its idempotent handler', async () => {
    await processor.process(job('expire-hold'));
    await processor.process(job('expire-request'));
    await processor.process(job('complete-stay'));
    await processor.process(job('sweep', {}));
    expect(lifecycle.expireHold).toHaveBeenCalledWith('b1');
    expect(lifecycle.expireRequest).toHaveBeenCalledWith('b1');
    expect(lifecycle.completeStay).toHaveBeenCalledWith('b1');
    expect(lifecycle.sweep).toHaveBeenCalled();
  });

  it('ignores unknown jobs', async () => {
    await expect(processor.process(job('something-else'))).resolves.toBe(false);
  });
});
