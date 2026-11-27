/**
 * The whiteboard's MVP test: "50 parallel bookings, exactly 1 wins". Runs BookingsService against a
 * real Postgres, where the only guard is the EXCLUDE constraint on bookings
 * (migrations/0002_booking_constraints.sql). Queues and email are mocked.
 *
 *   DATABASE_URL_TEST=postgres://hongwang:hongwang@localhost:5433/hongwang_test pnpm --filter @hongwang/api test:e2e
 */
import { addDays, ERROR_CODES, todayInBangkok, type CreateBookingInput } from '@hongwang/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { AuthUser } from '../src/common/auth';
import { bookingEvents, bookings } from '../src/database/schema';
import { createBookingTestApp, type BookingTestApp } from './setup/booking-app';
import { SKIP_ENV, testDatabaseUrl, truncateAll } from './setup/database';
import { createListing, createUser, createUsers } from './setup/fixtures';

const skipReason = process.env[SKIP_ENV];
const describeDb = skipReason ? describe.skip : describe;
if (skipReason) {
  // eslint-disable-next-line no-console
  console.warn(`[e2e] booking-concurrency skipped: ${skipReason}`);
}

type Settled = PromiseSettledResult<unknown>;
const fulfilled = (rs: Settled[]) => rs.filter((r): r is PromiseFulfilledResult<unknown> => r.status === 'fulfilled');
const rejected = (rs: Settled[]) => rs.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
const expectDatesUnavailable = (rs: PromiseRejectedResult[]) => {
  for (const r of rs) expect(r.reason).toMatchObject({ status: 409, code: ERROR_CODES.datesUnavailable });
};

describeDb('booking concurrency (real Postgres, EXCLUDE constraint)', () => {
  let app: BookingTestApp;
  let host: AuthUser;
  const day = (n: number) => addDays(todayInBangkok(), 30 + n);

  beforeAll(async () => {
    app = await createBookingTestApp(testDatabaseUrl()!);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await truncateAll(app.db);
    jest.clearAllMocks();
    host = await createUser(app.db, 'host');
  });

  const heldCount = async (listingId: string) => {
    const [row] = await app.db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(eq(bookings.listingId, listingId), inArray(bookings.status, ['payment_hold', 'confirmed', 'completed'])));
    return row!.n;
  };

  const book = (guest: AuthUser, input: Omit<CreateBookingInput, 'guests'> & { guests?: number }) =>
    app.bookings.create(guest, { guests: 1, ...input });

  it('50 parallel instant bookings of the same dates: exactly 1 wins, 49 get 409 DATES_UNAVAILABLE', async () => {
    const listing = await createListing(app.db, host.id, { instantBook: true });
    const guests = await createUsers(app.db, 'guest', 50);

    const results = await Promise.allSettled(
      guests.map((g) => book(g, { listingId: listing.id, checkIn: day(0), checkOut: day(3) })),
    );

    expect(fulfilled(results)).toHaveLength(1);
    expect(rejected(results)).toHaveLength(49);
    expectDatesUnavailable(rejected(results));
    expect(fulfilled(results)[0]!.value).toMatchObject({ status: 'payment_hold', checkIn: day(0), checkOut: day(3) });
    expect(await heldCount(listing.id)).toBe(1);
    // The losers' transactions rolled back completely.
    const [all] = await app.db.select({ n: sql<number>`count(*)::int` }).from(bookings);
    expect(all!.n).toBe(1);
  });

  it('overlapping but different ranges: only one of them can hold the nights', async () => {
    const listing = await createListing(app.db, host.id);
    const guests = await createUsers(app.db, 'guest', 3);
    // Every pair overlaps: [0,3) & [1,4) & [2,5).
    const results = await Promise.allSettled([
      book(guests[0]!, { listingId: listing.id, checkIn: day(0), checkOut: day(3) }),
      book(guests[1]!, { listingId: listing.id, checkIn: day(1), checkOut: day(4) }),
      book(guests[2]!, { listingId: listing.id, checkIn: day(2), checkOut: day(5) }),
    ]);
    expect(fulfilled(results)).toHaveLength(1);
    expectDatesUnavailable(rejected(results));

    // A stay that swallows the held one, and one inside it, are refused too.
    const later = await createUsers(app.db, 'late', 2);
    await expect(book(later[0]!, { listingId: listing.id, checkIn: day(-2), checkOut: day(8) })).rejects.toMatchObject({
      code: ERROR_CODES.datesUnavailable,
    });
    await expect(book(later[1]!, { listingId: listing.id, checkIn: day(2), checkOut: day(3) })).rejects.toMatchObject({
      code: ERROR_CODES.datesUnavailable,
    });
    expect(await heldCount(listing.id)).toBe(1);
  });

  it('back-to-back stays are allowed: check-out day = next check-in', async () => {
    const listing = await createListing(app.db, host.id);
    const guests = await createUsers(app.db, 'guest', 3);
    const results = await Promise.allSettled([
      book(guests[0]!, { listingId: listing.id, checkIn: day(-2), checkOut: day(0) }),
      book(guests[1]!, { listingId: listing.id, checkIn: day(0), checkOut: day(3) }),
      book(guests[2]!, { listingId: listing.id, checkIn: day(3), checkOut: day(5) }),
    ]);
    expect(rejected(results)).toEqual([]);
    expect(await heldCount(listing.id)).toBe(3);
  });

  it('the same dates on two different listings do not conflict', async () => {
    const a = await createListing(app.db, host.id);
    const b = await createListing(app.db, host.id, { title: 'Quiet 1-bed with balcony' });
    const [g1, g2] = await createUsers(app.db, 'guest', 2);
    await book(g1!, { listingId: a.id, checkIn: day(0), checkOut: day(3) });
    await expect(book(g2!, { listingId: b.id, checkIn: day(0), checkOut: day(3) })).resolves.toMatchObject({ status: 'payment_hold' });
  });

  it('requests don’t hold dates; approving one when the dates are taken returns 409', async () => {
    const listing = await createListing(app.db, host.id, { instantBook: false });
    const guests = await createUsers(app.db, 'guest', 5);
    const requests = await Promise.allSettled(
      guests.map((g) => book(g, { listingId: listing.id, checkIn: day(0), checkOut: day(3), message: 'Hi! Quiet guest.' })),
    );
    expect(rejected(requests)).toEqual([]);
    expect(await heldCount(listing.id)).toBe(0);
    const ids = fulfilled(requests).map((r) => (r.value as { id: string }).id);
    // Once-only job ids, so a replayed create can't email the host twice.
    expect(app.notifications.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ template: 'booking-requested-host' }), {
      jobId: `booking-requested-host-${ids[0]}`,
    });
    const approvals = await Promise.allSettled(ids.map((id) => app.bookings.approve(host, id)));
    expect(fulfilled(approvals)).toHaveLength(1);
    expect(rejected(approvals)).toHaveLength(4);
    expectDatesUnavailable(rejected(approvals));
    expect(fulfilled(approvals)[0]!.value).toMatchObject({ status: 'payment_hold' });
    expect(await heldCount(listing.id)).toBe(1);
  });

  it('an expired payment hold frees the dates for the next guest', async () => {
    const listing = await createListing(app.db, host.id);
    const [first, second, third] = await createUsers(app.db, 'guest', 3);
    const stay = { listingId: listing.id, checkIn: day(0), checkOut: day(3) };

    const held = await book(first!, stay);
    await expect(book(second!, stay)).rejects.toMatchObject({ code: ERROR_CODES.datesUnavailable });

    // The 15 minutes run out (no worker needed: create expires stale holds in its own transaction).
    await app.db
      .update(bookings)
      .set({ holdExpiresAt: sql`now() - interval '1 minute'` })
      .where(eq(bookings.id, held.id));

    const next = await book(second!, stay);
    expect(next).toMatchObject({ status: 'payment_hold' });

    const [old] = await app.db.select().from(bookings).where(eq(bookings.id, held.id));
    expect(old!.status).toBe('expired');
    const events = await app.db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, held.id));
    expect(events.map((e) => [e.fromStatus, e.toStatus, e.actor])).toEqual([
      [null, 'payment_hold', 'guest'],
      ['payment_hold', 'expired', 'system'],
    ]);
    expect(app.notifications.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'booking-expired-guest', data: expect.objectContaining({ reason: 'hold' }) }),
    );

    // Paying (simulated, same code path as the webhook) keeps the dates locked.
    await expect(app.payments.simulate(second!, next.id)).resolves.toMatchObject({ status: 'confirmed' });
    await expect(book(third!, stay)).rejects.toMatchObject({ code: ERROR_CODES.datesUnavailable });
    expect(await heldCount(listing.id)).toBe(1);
  });

  it('Idempotency-Key: 10 parallel attempts with one key make one booking and all get it back', async () => {
    const listing = await createListing(app.db, host.id, { instantBook: true });
    const [guest] = await createUsers(app.db, 'guest', 1);
    const key = 'c0ffee00-1111-4222-8333-444455556666';
    const stay = { listingId: listing.id, checkIn: day(0), checkOut: day(3), guests: 1 };

    const results = await Promise.allSettled(Array.from({ length: 10 }, () => app.bookings.create(guest!, stay, new Date(), key)));
    expect(rejected(results)).toEqual([]);
    const ids = new Set(fulfilled(results).map((r) => (r.value as { id: string }).id));
    expect(ids.size).toBe(1);

    // A later retry (the response was lost) gets the same hold instead of a 409 against itself.
    await expect(app.bookings.create(guest!, stay, new Date(), key)).resolves.toMatchObject({ id: [...ids][0], status: 'payment_hold' });
    const [all] = await app.db.select({ n: sql<number>`count(*)::int` }).from(bookings);
    expect(all!.n).toBe(1);

    // Without the key (or with a new one) it's a new attempt, and the dates are taken.
    await expect(book(guest!, stay)).rejects.toMatchObject({ code: ERROR_CODES.datesUnavailable });
    await expect(app.bookings.create(guest!, { ...stay, guests: 2 }, new Date(), key)).rejects.toMatchObject({
      status: 422,
      code: ERROR_CODES.idempotencyKeyReused,
    });
  });

  it('Idempotency-Key: parallel requests to book with one key make one request (requests hold no dates)', async () => {
    const listing = await createListing(app.db, host.id, { instantBook: false });
    const [guest, other] = await createUsers(app.db, 'guest', 2);
    const key = 'c0ffee00-1111-4222-8333-777788889999';
    const stay = { listingId: listing.id, checkIn: day(0), checkOut: day(3), guests: 1, message: 'Hi! Quiet guest.' };

    const results = await Promise.allSettled(Array.from({ length: 5 }, () => app.bookings.create(guest!, stay, new Date(), key)));
    expect(rejected(results)).toEqual([]);
    expect(new Set(fulfilled(results).map((r) => (r.value as { id: string }).id)).size).toBe(1);
    const [mine] = await app.db.select({ n: sql<number>`count(*)::int` }).from(bookings).where(eq(bookings.guestId, guest!.id));
    expect(mine!.n).toBe(1);

    // Keys are per guest: another guest's request with the same key is its own booking.
    await expect(app.bookings.create(other!, stay, new Date(), key)).resolves.toMatchObject({ status: 'requested' });
  });

  it('a guest can’t book their own listing', async () => {
    const listing = await createListing(app.db, host.id);
    await expect(book(host, { listingId: listing.id, checkIn: day(0), checkOut: day(2) })).rejects.toMatchObject({
      status: 403,
      code: ERROR_CODES.ownListing,
    });
  });
});
