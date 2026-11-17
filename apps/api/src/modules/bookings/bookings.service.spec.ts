import { ERROR_CODES, PAYMENT_HOLD_TTL_MS, quoteStay } from '@hongwang/shared';
import { PgDialect } from 'drizzle-orm/pg-core';
import { createMockDb, pgError, throwing } from '../../../test/helpers/mock-db';
import { AbilityFactory } from '../../authz/ability';
import type { AuthUser } from '../../common/auth';
import { REF_PATTERN } from './booking-ref';
import { BookingsService, tabWhere } from './bookings.service';

const HOST: AuthUser = { id: '00000000-0000-4000-8000-00000000000a', role: 'user', sessionId: 's1' };
const GUEST: AuthUser = { id: '00000000-0000-4000-8000-00000000000b', role: 'user', sessionId: 's2' };
const STRANGER: AuthUser = { id: '00000000-0000-4000-8000-00000000000c', role: 'user', sessionId: 's3' };
const LISTING_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-12-01T03:00:00Z'); // 10:00 in Bangkok, today = 2026-12-01

const listing = (over: Record<string, unknown> = {}) => ({
  id: LISTING_ID,
  hostId: HOST.id,
  status: 'published',
  deletedAt: null,
  basePrice: 120000,
  cleaningFee: 30000,
  weeklyDiscountPct: 0,
  instantBook: true,
  minNights: 1,
  maxNights: 90,
  maxGuests: 2,
  advanceNoticeDays: 0,
  bookingWindowMonths: 12,
  cancellationPolicy: 'moderate',
  ...over,
});

const price = quoteStay({ checkIn: '2026-12-12', checkOut: '2026-12-15', basePrice: 120000, cleaningFee: 30000 });
const booking = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  ref: 'BK-7F3K2Q',
  listingId: LISTING_ID,
  guestId: GUEST.id,
  hostId: HOST.id,
  status: 'confirmed',
  checkIn: '2026-12-12',
  checkOut: '2026-12-15',
  guests: 2,
  cancellationPolicy: 'moderate',
  requestExpiresAt: null,
  holdExpiresAt: null,
  refundAmount: null,
  ...price,
  ...over,
});

const stay = { listingId: LISTING_ID, checkIn: '2026-12-12', checkOut: '2026-12-15', guests: 2 };

function setup(results: unknown[]) {
  const m = createMockDb(results);
  const read = { findDto: jest.fn(async (id: string) => ({ id })), findDtos: jest.fn(async () => []) };
  const emails = {
    requested: jest.fn(),
    approved: jest.fn(),
    rejected: jest.fn(),
    expired: jest.fn(),
    confirmed: jest.fn(),
    cancelled: jest.fn(),
  };
  const timeouts = { expireHoldAt: jest.fn(), expireRequestAt: jest.fn(), completeAfter: jest.fn() };
  const refunds = { refund: jest.fn(async (_tx: unknown, _id: string, amount: number) => amount), cancelPending: jest.fn() };
  const service = new BookingsService(m.db, new AbilityFactory(), read as never, emails as never, timeouts as never, refunds as never);
  return { m, service, read, emails, timeouts, refunds };
}

/** DB results for create() up to (not including) the booking insert. */
const createPrelude = (l = listing()) => [[l], [], [], [], { rows: [] }, []];

describe('BookingsService.create', () => {
  it('instant book: inserts a payment_hold with the price snapshot and schedules the hold expiry', async () => {
    const { m, service, timeouts, emails } = setup([...createPrelude(), [{ id: 'new' }], []]);
    await expect(service.create(GUEST, stay, NOW)).resolves.toEqual({ id: 'new' });

    const insert = m.ops('insert')[0]!;
    expect(insert.values).toMatchObject({
      status: 'payment_hold',
      guestId: GUEST.id,
      hostId: HOST.id,
      total: 429000,
      serviceFee: 39000,
      nights: 3,
      cancellationPolicy: 'moderate',
      instant: true,
      holdExpiresAt: new Date(NOW.getTime() + PAYMENT_HOLD_TTL_MS),
      requestExpiresAt: null,
    });
    expect((insert.values as { ref: string }).ref).toMatch(REF_PATTERN);
    expect(m.ops('insert')[1]!.values).toMatchObject({ bookingId: 'new', fromStatus: null, toStatus: 'payment_hold', actor: 'guest' });
    expect(m.transactions()).toBe(1);
    expect(timeouts.expireHoldAt).toHaveBeenCalledWith('new', new Date(NOW.getTime() + PAYMENT_HOLD_TTL_MS));
    expect(emails.requested).not.toHaveBeenCalled();
    expect(m.remaining()).toBe(0);
  });

  it('request to book: inserts requested, schedules the 24h expiry and emails both sides', async () => {
    const { m, service, timeouts, emails } = setup([...createPrelude(listing({ instantBook: false })), [{ id: 'req' }], []]);
    await service.create(GUEST, { ...stay, message: 'Hi Ploy!' }, NOW);
    expect(m.ops('insert')[0]!.values).toMatchObject({ status: 'requested', holdExpiresAt: null, message: 'Hi Ploy!' });
    expect(timeouts.expireRequestAt).toHaveBeenCalledWith('req', new Date(NOW.getTime() + 24 * 3600_000));
    expect(emails.requested).toHaveBeenCalledWith('req');
  });

  it('turns the exclusion constraint into 409 DATES_UNAVAILABLE', async () => {
    const { service, timeouts } = setup([...createPrelude(), throwing(pgError('23P01', 'bookings_no_overlap'))]);
    await expect(service.create(GUEST, stay, NOW)).rejects.toMatchObject({
      status: 409,
      code: ERROR_CODES.datesUnavailable,
    });
    expect(timeouts.expireHoldAt).not.toHaveBeenCalled();
  });

  it('retries the transaction with a new ref when the ref collides', async () => {
    const { m, service } = setup([
      ...createPrelude(),
      throwing(pgError('23505', 'bookings_ref_unique')),
      { rows: [] },
      [],
      [{ id: 'second' }],
      [],
    ]);
    await expect(service.create(GUEST, stay, NOW)).resolves.toEqual({ id: 'second' });
    expect(m.transactions()).toBe(2);
    const refs = m.ops('insert').filter((q) => (q.values as { ref?: string }).ref).map((q) => (q.values as { ref: string }).ref);
    expect(refs).toHaveLength(2);
  });

  it('expires stale holds first and emails their guests after commit', async () => {
    const { service, emails, refunds } = setup([[listing()], [], [], [], { rows: [{ id: 'stale' }] }, [], [], [{ id: 'new' }], []]);
    await service.create(GUEST, stay, NOW);
    expect(refunds.cancelPending).toHaveBeenCalledWith('stale');
    expect(emails.expired).toHaveBeenCalledWith('stale', 'hold');
  });

  it('refuses the host’s own listing with 403 OWN_LISTING', async () => {
    const { service } = setup([[listing()]]);
    await expect(service.create(HOST, stay, NOW)).rejects.toMatchObject({ status: 403, code: ERROR_CODES.ownListing });
  });

  it('refuses unpublished listings', async () => {
    const { service } = setup([[listing({ status: 'paused' })]]);
    await expect(service.create(GUEST, stay, NOW)).rejects.toMatchObject({ status: 403 });
  });

  it('rejects stays that break listing rules with the reasons', async () => {
    const { service } = setup([[listing()]]);
    await expect(service.create(GUEST, { ...stay, guests: 3 }, NOW)).rejects.toMatchObject({
      status: 400,
      details: { reasons: ['max_guests'] },
    });
  });

  it('requires a message for request to book', async () => {
    const { service } = setup([[listing({ instantBook: false })]]);
    await expect(service.create(GUEST, stay, NOW)).rejects.toMatchObject({ status: 400 });
  });

  it('returns 409 before the transaction when the nights are already held', async () => {
    const { m, service } = setup([[listing()], [{ id: 'other' }], []]);
    await expect(service.create(GUEST, stay, NOW)).rejects.toMatchObject({ code: ERROR_CODES.datesUnavailable });
    expect(m.transactions()).toBe(0);
  });
});

describe('BookingsService.quote', () => {
  it('prices the stay and lists every reason it can’t be booked', async () => {
    const { service } = setup([[listing()], [{ id: 'held' }], [], []]);
    const q = await service.quote(HOST, { ...stay, guests: 3 }, NOW);
    expect(q.available).toBe(false);
    expect(q.reasons).toEqual(['max_guests', 'unavailable', 'own_listing']);
    expect(q.quote.total).toBe(429000);
    expect(q.freeCancellationUntil).toBe('2026-12-07');
  });

  it('applies the host’s special prices', async () => {
    const { service } = setup([[listing()], [], [], [{ date: '2026-12-13', price: 150000 }]]);
    const q = await service.quote(undefined, stay, NOW);
    expect(q.available).toBe(true);
    expect(q.quote.nightsSubtotal).toBe(120000 + 150000 + 120000);
  });

  it('404s for listings that are not published', async () => {
    const { service } = setup([[listing({ status: 'draft' })]]);
    await expect(service.quote(undefined, stay, NOW)).rejects.toMatchObject({ status: 404 });
  });
});

describe('BookingsService.approve / reject', () => {
  const request = () => booking({ status: 'requested', requestExpiresAt: new Date(NOW.getTime() + 3600_000) });

  it('moves requested -> payment_hold, schedules the hold and emails the guest', async () => {
    const { m, service, timeouts, emails } = setup([[request()], { rows: [] }, [], [{ id: 'b1', status: 'payment_hold' }], []]);
    await service.approve(HOST, 'b1', NOW);
    expect(m.ops('update')[0]!.set).toMatchObject({ status: 'payment_hold', approvedAt: NOW });
    expect(timeouts.expireHoldAt).toHaveBeenCalledWith('b1', new Date(NOW.getTime() + PAYMENT_HOLD_TTL_MS));
    expect(emails.approved).toHaveBeenCalledWith('b1');
  });

  it('returns 409 DATES_UNAVAILABLE when another booking took the dates', async () => {
    const { service, emails } = setup([[request()], { rows: [] }, [], throwing(pgError('23P01'))]);
    await expect(service.approve(HOST, 'b1', NOW)).rejects.toMatchObject({ status: 409, code: ERROR_CODES.datesUnavailable });
    expect(emails.approved).not.toHaveBeenCalled();
  });

  it('expires a request the host answers too late', async () => {
    const late = booking({ status: 'requested', requestExpiresAt: new Date(NOW.getTime() - 1000) });
    const { m, service, emails } = setup([[late], [{ id: 'b1', status: 'expired' }], []]);
    await expect(service.approve(HOST, 'b1', NOW)).rejects.toMatchObject({ code: ERROR_CODES.invalidTransition });
    expect(m.ops('update')[0]!.set).toMatchObject({ status: 'expired' });
    expect(emails.expired).toHaveBeenCalledWith('b1', 'request');
  });

  it('only the host can approve', async () => {
    const { service } = setup([[request()]]);
    await expect(service.approve(GUEST, 'b1', NOW)).rejects.toMatchObject({ status: 403 });
  });

  it('409s when the request changed concurrently (conditional update matched nothing)', async () => {
    const { service } = setup([[request()], []]);
    await expect(service.reject(HOST, 'b1', {}, NOW)).rejects.toMatchObject({ code: ERROR_CODES.invalidTransition });
  });

  it('rejects with a reason and emails the guest', async () => {
    const { m, service, emails } = setup([[request()], [{ id: 'b1', status: 'rejected' }], []]);
    await service.reject(HOST, 'b1', { reason: 'Family visiting' }, NOW);
    expect(m.ops('update')[0]!.set).toMatchObject({ status: 'rejected', rejectReason: 'Family visiting' });
    expect(emails.rejected).toHaveBeenCalledWith('b1');
  });
});

describe('BookingsService.cancel', () => {
  const nineDec = new Date('2026-12-09T03:00:00Z'); // 3 days before check-in: moderate -> 50% of nights

  it('guest on a confirmed stay: refunds per policy', async () => {
    const { m, service, refunds, emails } = setup([[booking()], [{ id: 'b1', status: 'cancelled' }], []]);
    await service.cancel(GUEST, 'b1', { reason: 'My plans changed' }, nineDec);
    expect(m.ops('update')[0]!.set).toMatchObject({
      status: 'cancelled',
      cancelledBy: 'guest',
      cancelReason: 'My plans changed',
      refundAmount: 210000,
      hostPenalty: null,
    });
    expect(refunds.refund).toHaveBeenCalledWith(m.db, 'b1', 210000, 'cancel');
    expect(refunds.cancelPending).not.toHaveBeenCalled();
    expect(emails.cancelled).toHaveBeenCalledWith('b1');
  });

  it('host on a confirmed stay: full refund, host fee, nights stay blocked', async () => {
    const { m, service, refunds } = setup([[booking()], [{ id: 'b1', status: 'cancelled' }], [], []]);
    await service.cancel(HOST, 'b1', { reason: 'Burst pipe' }, nineDec);
    expect(m.ops('update')[0]!.set).toMatchObject({ cancelledBy: 'host', refundAmount: 429000, hostPenalty: 37200 });
    expect(refunds.refund).toHaveBeenCalledWith(m.db, 'b1', 429000, 'cancel');
    const blocks = m.ops('insert').find((q) => Array.isArray(q.values));
    expect(blocks!.values).toEqual([
      { listingId: LISTING_ID, date: '2026-12-12' },
      { listingId: LISTING_ID, date: '2026-12-13' },
      { listingId: LISTING_ID, date: '2026-12-14' },
    ]);
  });

  it('records what Stripe actually refunded when it is less than the quote', async () => {
    const { m, service, refunds } = setup([[booking()], [{ id: 'b1' }], [], []]);
    refunds.refund.mockResolvedValueOnce(100000);
    await service.cancel(GUEST, 'b1', { reason: 'x' }, nineDec);
    expect(m.ops('update')[1]!.set).toEqual({ refundAmount: 100000 });
  });

  it('guest on a payment hold: no charge, pending intent cancelled', async () => {
    const hold = booking({ status: 'payment_hold', holdExpiresAt: new Date(NOW.getTime() + 60_000) });
    const { m, service, refunds } = setup([[hold], [{ id: 'b1' }], []]);
    await service.cancel(GUEST, 'b1', { reason: 'Changed my mind' }, NOW);
    expect(m.ops('update')[0]!.set).toMatchObject({ refundAmount: 0 });
    expect(refunds.refund).not.toHaveBeenCalled();
    expect(refunds.cancelPending).toHaveBeenCalledWith('b1');
  });

  it('host can’t cancel a request (they decline it)', async () => {
    const { service } = setup([[booking({ status: 'requested' })]]);
    await expect(service.cancel(HOST, 'b1', { reason: 'x' }, NOW)).rejects.toMatchObject({ code: ERROR_CODES.invalidTransition });
  });

  it('404s for someone who is neither guest nor host', async () => {
    const { service } = setup([[booking()]]);
    await expect(service.cancel(STRANGER, 'b1', { reason: 'x' }, NOW)).rejects.toMatchObject({ status: 404 });
  });

  it('admin can cancel any live booking with a full refund and no host fee', async () => {
    const admin: AuthUser = { ...STRANGER, role: 'admin' };
    const { m, service } = setup([[booking()], [{ id: 'b1' }], []]);
    await service.cancel(admin, 'b1', { reason: 'Dispute' }, nineDec);
    expect(m.ops('update')[0]!.set).toMatchObject({ cancelledBy: 'admin', refundAmount: 429000, hostPenalty: null });
  });

  it('cancellation quote is for the caller’s side', async () => {
    const guest = setup([[booking()]]);
    await expect(guest.service.cancellationQuote(GUEST, 'b1', nineDec)).resolves.toMatchObject({ kind: 'partial', refundTotal: 210000 });
    const host = setup([[booking()]]);
    await expect(host.service.cancellationQuote(HOST, 'b1', nineDec)).resolves.toMatchObject({ kind: 'full', hostPenalty: 37200 });
  });
});

describe('tabWhere', () => {
  const dialect = new PgDialect();
  it('upcoming: live statuses still checking out today or later', () => {
    const q = dialect.sqlToQuery(tabWhere('upcoming', '2026-12-01').where);
    expect(q.params).toEqual(['requested', 'payment_hold', 'confirmed', '2026-12-01']);
    expect(q.sql).toContain('"check_out" >=');
  });
  it('past: completed, or confirmed stays that already ended', () => {
    const q = dialect.sqlToQuery(tabWhere('past', '2026-12-01').where);
    expect(q.params).toEqual(['completed', 'confirmed', '2026-12-01']);
    expect(q.sql).toContain('"check_out" <');
  });
  it('cancelled: cancelled, declined and expired', () => {
    expect(dialect.sqlToQuery(tabWhere('cancelled', '2026-12-01').where).params).toEqual(['cancelled', 'rejected', 'expired']);
  });
});
