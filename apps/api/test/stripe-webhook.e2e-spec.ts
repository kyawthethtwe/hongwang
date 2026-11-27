/**
 * Stripe webhook replay (implementation plan, M0 5.3): Stripe delivers at least once, sometimes the
 * same event twice and even at the same time. The second delivery must change nothing: one
 * confirmation, one payment row, one booking event, one set of emails (stripe_events + the
 * conditional status update). The real Stripe SDK checks the signatures; nothing calls Stripe.
 *
 *   DATABASE_URL_TEST=postgres://hongwang:hongwang@localhost:5433/hongwang_test pnpm --filter @hongwang/api test:e2e
 */
import { addDays, todayInBangkok } from '@hongwang/shared';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import type { AuthUser } from '../src/common/auth';
import { bookingEvents, bookings, payments, stripeEvents } from '../src/database/schema';
import { createBookingTestApp, type BookingTestApp } from './setup/booking-app';
import { SKIP_ENV, testDatabaseUrl, truncateAll } from './setup/database';
import { createListing, createUser } from './setup/fixtures';

const skipReason = process.env[SKIP_ENV];
const describeDb = skipReason ? describe.skip : describe;

const WEBHOOK_SECRET = 'whsec_e2e_test_secret';
const signer = new Stripe('sk_test_e2e_not_a_real_key');

describeDb('Stripe webhook replay (real Postgres)', () => {
  let app: BookingTestApp;
  let host: AuthUser;
  let guest: AuthUser;

  beforeAll(async () => {
    app = await createBookingTestApp(testDatabaseUrl()!, {
      stripe: { secretKey: 'sk_test_e2e_not_a_real_key', webhookSecret: WEBHOOK_SECRET },
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await truncateAll(app.db);
    jest.clearAllMocks();
    host = await createUser(app.db, 'host');
    guest = await createUser(app.db, 'guest');
  });

  /** An instant booking on hold, and a signed payment_intent.succeeded event that pays it. */
  async function heldBookingAndEvent(eventId: string) {
    const listing = await createListing(app.db, host.id, { instantBook: true });
    const checkIn = addDays(todayInBangkok(), 40);
    const held = await app.bookings.create(guest, { listingId: listing.id, checkIn, checkOut: addDays(checkIn, 3), guests: 1 });
    const payload = JSON.stringify({
      id: eventId,
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: `pi_${eventId}`,
          object: 'payment_intent',
          amount: held.pricing.total,
          amount_received: held.pricing.total,
          currency: 'thb',
          metadata: { bookingId: held.id, ref: held.ref },
          // Inline, so chargeDetails doesn't call Stripe.
          latest_charge: { id: `ch_${eventId}`, object: 'charge', payment_method_details: { type: 'card', card: { last4: '4242' } } },
        },
      },
    });
    const deliver = () =>
      app.payments.handleWebhook(Buffer.from(payload), signer.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }));
    return { held, deliver };
  }

  async function sideEffects(bookingId: string) {
    const [b] = await app.db.select().from(bookings).where(eq(bookings.id, bookingId));
    const pays = await app.db.select().from(payments).where(eq(payments.bookingId, bookingId));
    const events = await app.db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, bookingId));
    const emails = app.notifications.sendEmail.mock.calls.map((c) => (c[0] as { template: string }).template).filter((t) => t.startsWith('booking-confirmed'));
    return { status: b!.status, payments: pays.map((p) => [p.status, p.last4]), events: events.map((e) => e.toStatus), emails };
  }

  it('the same event twice: confirms once, and the replay is reported as a duplicate', async () => {
    const { held, deliver } = await heldBookingAndEvent('evt_replay_1');

    await expect(deliver()).resolves.toEqual({ received: true });
    const first = await sideEffects(held.id);
    await expect(deliver()).resolves.toEqual({ received: true, duplicate: true });

    expect(await sideEffects(held.id)).toEqual(first);
    expect(first).toEqual({
      status: 'confirmed',
      payments: [['succeeded', '4242']],
      events: ['payment_hold', 'confirmed'],
      emails: ['booking-confirmed-guest', 'booking-confirmed-host'],
    });
    const recorded = await app.db.select().from(stripeEvents);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.processedAt).toBeInstanceOf(Date);
  });

  it('the same event delivered twice at once: still one confirmation and one set of emails', async () => {
    const { held, deliver } = await heldBookingAndEvent('evt_replay_2');

    const results = await Promise.all([deliver(), deliver()]);
    expect(results.every((r) => r.received)).toBe(true);
    expect(await sideEffects(held.id)).toEqual({
      status: 'confirmed',
      payments: [['succeeded', '4242']],
      events: ['payment_hold', 'confirmed'],
      emails: ['booking-confirmed-guest', 'booking-confirmed-host'],
    });
  });

  it('a bad signature changes nothing', async () => {
    const { held } = await heldBookingAndEvent('evt_forged');
    await expect(app.payments.handleWebhook(Buffer.from('{"id":"evt_forged"}'), 't=1,v1=deadbeef')).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_SIGNATURE',
    });
    expect((await sideEffects(held.id)).status).toBe('payment_hold');
    expect(await app.db.select().from(stripeEvents)).toHaveLength(0);
  });
});
