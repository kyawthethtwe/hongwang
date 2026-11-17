import { ERROR_CODES, quoteStay } from '@hongwang/shared';
import { createMockDb } from '../../../test/helpers/mock-db';
import { AbilityFactory } from '../../authz/ability';
import type { AuthUser } from '../../common/auth';
import type { Env } from '../../config/env';
import { PaymentsService } from './payments.service';

const GUEST: AuthUser = { id: '00000000-0000-4000-8000-00000000000b', role: 'user', sessionId: 's' };
const HOST: AuthUser = { id: '00000000-0000-4000-8000-00000000000a', role: 'user', sessionId: 's' };
const NOW = new Date('2026-12-01T03:00:00Z');
const price = quoteStay({ checkIn: '2026-12-12', checkOut: '2026-12-15', basePrice: 120000, cleaningFee: 30000 });

const booking = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  ref: 'BK-7F3K2Q',
  guestId: GUEST.id,
  hostId: HOST.id,
  status: 'payment_hold',
  checkIn: '2026-12-12',
  checkOut: '2026-12-15',
  holdExpiresAt: new Date(NOW.getTime() + 10 * 60_000),
  refundAmount: null,
  ...price,
  ...over,
});

function fakeStripe() {
  return {
    paymentIntents: {
      create: jest.fn(async () => ({ id: 'pi_1', client_secret: 'pi_1_secret' })),
      retrieve: jest.fn(),
      update: jest.fn(async (id: string) => ({ id, client_secret: 'pi_1_secret' })),
    },
    charges: { retrieve: jest.fn() },
    webhooks: { constructEvent: jest.fn() },
  };
}

function setup(results: unknown[], opts: { stripe?: ReturnType<typeof fakeStripe> | null; env?: Partial<Env> } = {}) {
  const m = createMockDb(results);
  const stripe = opts.stripe ?? null;
  const stripeService = { client: stripe, publishableKey: stripe ? 'pk_test_1' : null, webhookSecret: stripe ? 'whsec_1' : null };
  const refunds = { refund: jest.fn(async (_tx: unknown, _id: string, amount: number) => amount), cancelPending: jest.fn() };
  const read = { findDto: jest.fn(async (id: string) => ({ id, status: 'confirmed' })) };
  const emails = { confirmed: jest.fn() };
  const timeouts = { completeAfter: jest.fn() };
  const env = { NODE_ENV: 'development', ...opts.env } as Env;
  const service = new PaymentsService(
    m.db,
    env,
    new AbilityFactory(),
    stripeService as never,
    refunds as never,
    read as never,
    emails as never,
    timeouts as never,
  );
  return { m, service, stripe, refunds, emails, timeouts, read };
}

describe('PaymentsService.createIntent', () => {
  it('simulated mode when Stripe is not configured', async () => {
    const { m, service } = setup([[booking()], [], []]);
    const dto = await service.createIntent(GUEST, { bookingId: 'b1', method: 'promptpay' }, NOW);
    expect(dto).toEqual({
      mode: 'simulated',
      clientSecret: null,
      publishableKey: null,
      amount: 429000,
      currency: 'THB',
      holdExpiresAt: booking().holdExpiresAt.toISOString(),
    });
    expect(m.ops('insert')[0]!.values).toMatchObject({ provider: 'simulated', method: 'promptpay', status: 'pending', amount: 429000 });
  });

  it('creates a PaymentIntent for the booking total in THB', async () => {
    const stripe = fakeStripe();
    const { m, service } = setup([[booking()], [], [{ n: 0 }], []], { stripe });
    const dto = await service.createIntent(GUEST, { bookingId: 'b1', method: 'promptpay' }, NOW);
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 429000,
        currency: 'thb',
        payment_method_types: ['promptpay'],
        metadata: { bookingId: 'b1', ref: 'BK-7F3K2Q' },
      }),
      { idempotencyKey: 'booking-b1-pi-0-promptpay' },
    );
    expect(dto).toMatchObject({ mode: 'stripe', clientSecret: 'pi_1_secret', publishableKey: 'pk_test_1', amount: 429000 });
    expect(m.ops('insert')[0]!.values).toMatchObject({ provider: 'stripe', stripePaymentIntentId: 'pi_1', method: 'promptpay' });
  });

  it('reuses the open PaymentIntent and switches its method (mobile banking pays by card)', async () => {
    const stripe = fakeStripe();
    stripe.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_1',
      status: 'requires_payment_method',
      amount: 429000,
      payment_method_types: ['promptpay'],
    });
    const { service } = setup([[booking()], [{ pi: 'pi_1' }], []], { stripe });
    await service.createIntent(GUEST, { bookingId: 'b1', method: 'mobile_banking' }, NOW);
    expect(stripe.paymentIntents.update).toHaveBeenCalledWith('pi_1', { payment_method_types: ['card'] });
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it('410 HOLD_EXPIRED once the hold has run out', async () => {
    const { service } = setup([[booking({ holdExpiresAt: new Date(NOW.getTime() - 1) })]]);
    await expect(service.createIntent(GUEST, { bookingId: 'b1' }, NOW)).rejects.toMatchObject({ status: 410, code: ERROR_CODES.holdExpired });
    const expired = setup([[booking({ status: 'expired' })]]);
    await expect(expired.service.createIntent(GUEST, { bookingId: 'b1' }, NOW)).rejects.toMatchObject({ status: 410 });
  });

  it('only the guest pays, and only a booking on hold', async () => {
    const host = setup([[booking()]]);
    await expect(host.service.createIntent(HOST, { bookingId: 'b1' }, NOW)).rejects.toMatchObject({ status: 403 });
    const paid = setup([[booking({ status: 'confirmed' })]]);
    await expect(paid.service.createIntent(GUEST, { bookingId: 'b1' }, NOW)).rejects.toMatchObject({ code: ERROR_CODES.invalidTransition });
  });
});

describe('PaymentsService.confirmPayment', () => {
  it('payment_hold -> confirmed, marks the payment paid, emails and schedules completion', async () => {
    const { m, service, emails, timeouts } = setup([
      [booking()],
      [{ id: 'p1' }], // pending simulated payment
      [], // mark it succeeded
      [{ ...booking(), status: 'confirmed' }], // conditional status update
      [], // booking_events
    ]);
    await expect(service.confirmPayment('b1', { provider: 'simulated', amount: 429000, last4: '4242', paidAt: NOW })).resolves.toBe('confirmed');
    expect(m.ops('update')[0]!.set).toMatchObject({ status: 'succeeded', last4: '4242', paidAt: NOW });
    expect(m.ops('update')[1]!.set).toMatchObject({ status: 'confirmed', confirmedAt: NOW });
    expect(emails.confirmed).toHaveBeenCalledWith('b1');
    expect(timeouts.completeAfter).toHaveBeenCalledWith('b1', '2026-12-15');
  });

  it('is idempotent for a booking that is already confirmed', async () => {
    const { service, emails, refunds } = setup([[booking({ status: 'confirmed' })], []]);
    await expect(service.confirmPayment('b1', { provider: 'stripe', paymentIntentId: 'pi_1', amount: 429000 })).resolves.toBe(
      'already_confirmed',
    );
    expect(emails.confirmed).not.toHaveBeenCalled();
    expect(refunds.refund).not.toHaveBeenCalled();
  });

  it('refunds in full when the money arrives after the hold expired', async () => {
    const { m, service, refunds, emails } = setup([[booking({ status: 'expired' })], [], []]);
    await expect(service.confirmPayment('b1', { provider: 'stripe', paymentIntentId: 'pi_1', amount: 429000 })).resolves.toBe('refunded_late');
    expect(refunds.refund).toHaveBeenCalledWith(m.db, 'b1', 429000, 'late-payment');
    expect(m.ops('update').at(-1)!.set).toMatchObject({ refundAmount: 429000 });
    expect(emails.confirmed).not.toHaveBeenCalled();
  });

  it('handles losing the race with the expiry worker', async () => {
    const { service, refunds } = setup([[booking()], [], [], [], [booking({ status: 'expired' })], []]);
    await expect(service.confirmPayment('b1', { provider: 'simulated', amount: 429000 })).resolves.toBe('refunded_late');
    expect(refunds.refund).toHaveBeenCalled();
  });
});

describe('PaymentsService.handleWebhook', () => {
  const body = Buffer.from('{}');
  const succeeded = {
    id: 'evt_1',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_1',
        amount: 429000,
        amount_received: 429000,
        metadata: { bookingId: 'b1' },
        latest_charge: { payment_method_details: { type: 'card', card: { last4: '4242' } } },
      },
    },
  };

  it('400 without Stripe, without a signature, or with a bad one', async () => {
    await expect(setup([]).service.handleWebhook(body, 'sig')).rejects.toMatchObject({ status: 400 });
    const stripe = fakeStripe();
    const s = setup([], { stripe });
    await expect(s.service.handleWebhook(body, undefined)).rejects.toMatchObject({ status: 400 });
    stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });
    await expect(s.service.handleWebhook(body, 'bad')).rejects.toMatchObject({ status: 400, code: 'INVALID_SIGNATURE' });
  });

  it('payment_intent.succeeded confirms the booking from metadata, with the card last4', async () => {
    const stripe = fakeStripe();
    stripe.webhooks.constructEvent.mockReturnValue(succeeded);
    const { m, service } = setup([[{ id: 'evt_1' }], []], { stripe });
    const confirm = jest.spyOn(service, 'confirmPayment').mockResolvedValue('confirmed');
    await expect(service.handleWebhook(body, 'sig')).resolves.toEqual({ received: true });
    expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(body, 'sig', 'whsec_1');
    expect(confirm).toHaveBeenCalledWith('b1', {
      provider: 'stripe',
      paymentIntentId: 'pi_1',
      amount: 429000,
      method: 'card',
      last4: '4242',
    });
    expect(m.ops('update')[0]!.set).toHaveProperty('processedAt');
  });

  it('skips an event it already processed', async () => {
    const stripe = fakeStripe();
    stripe.webhooks.constructEvent.mockReturnValue(succeeded);
    const { service } = setup([[], [{ processedAt: NOW }]], { stripe });
    const confirm = jest.spyOn(service, 'confirmPayment');
    await expect(service.handleWebhook(body, 'sig')).resolves.toEqual({ received: true, duplicate: true });
    expect(confirm).not.toHaveBeenCalled();
  });

  it('reprocesses an event whose earlier attempt failed', async () => {
    const stripe = fakeStripe();
    stripe.webhooks.constructEvent.mockReturnValue(succeeded);
    const { service } = setup([[], [{ processedAt: null }], []], { stripe });
    const confirm = jest.spyOn(service, 'confirmPayment').mockResolvedValue('confirmed');
    await service.handleWebhook(body, 'sig');
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('charge.refunded syncs the refunded amount', async () => {
    const stripe = fakeStripe();
    stripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_2',
      type: 'charge.refunded',
      data: { object: { payment_intent: 'pi_1', amount_refunded: 210000, refunded: false } },
    });
    const { m, service } = setup([[{ id: 'evt_2' }], [], []], { stripe });
    await service.handleWebhook(body, 'sig');
    expect(m.ops('update')[0]!.set).toMatchObject({ refundedAmount: 210000, status: 'partially_refunded' });
  });
});

describe('PaymentsService.simulate', () => {
  it('is not available when Stripe is configured or in production', async () => {
    await expect(setup([], { stripe: fakeStripe() }).service.simulate(GUEST, 'b1', NOW)).rejects.toMatchObject({ status: 404 });
    await expect(setup([], { env: { NODE_ENV: 'production' } }).service.simulate(GUEST, 'b1', NOW)).rejects.toMatchObject({ status: 404 });
  });

  it('confirms through confirmPayment and returns the booking', async () => {
    const { service } = setup([[booking()], [{ id: 'p1', method: 'card' }]]);
    const confirm = jest.spyOn(service, 'confirmPayment').mockResolvedValue('confirmed');
    await expect(service.simulate(GUEST, 'b1', NOW)).resolves.toMatchObject({ status: 'confirmed' });
    expect(confirm).toHaveBeenCalledWith('b1', { provider: 'simulated', amount: 429000, method: 'card', last4: '4242', paidAt: NOW });
  });
});
