import { ERROR_CODES } from '@hongwang/shared';
import { Logger } from '@nestjs/common';
import { createMockDb } from '../../../test/helpers/mock-db';
import { RefundsService } from './refunds.service';

const stripePayment = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  provider: 'stripe',
  stripePaymentIntentId: 'pi_1',
  status: 'succeeded',
  amount: 297000,
  refundedAmount: 0,
  ...over,
});

function setup(results: unknown[], refundsCreate = jest.fn(async () => ({ id: 're_1' }))) {
  const m = createMockDb(results);
  const stripe = { client: { refunds: { create: refundsCreate } } };
  return { m, service: new RefundsService(m.db, stripe as never), refundsCreate };
}

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterAll(() => jest.restoreAllMocks());

describe('RefundsService.refund', () => {
  it('refunds through Stripe once per booking and purpose, then records it', async () => {
    const { m, service, refundsCreate } = setup([[stripePayment()], []]);
    await expect(service.refund(m.db, 'b1', 297000, 'cancel')).resolves.toBe(297000);
    expect(refundsCreate).toHaveBeenCalledWith(
      { payment_intent: 'pi_1', amount: 297000, metadata: { bookingId: 'b1', purpose: 'cancel' } },
      { idempotencyKey: 'refund-cancel-b1' },
    );
    expect(m.ops('update')[0]!.set).toMatchObject({ refundedAmount: 297000, status: 'refunded' });
  });

  it('never refunds more than is left', async () => {
    const { m, service, refundsCreate } = setup([[stripePayment({ refundedAmount: 200000, status: 'partially_refunded' })], []]);
    await expect(service.refund(m.db, 'b1', 297000, 'cancel')).resolves.toBe(97000);
    expect(refundsCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 97000 }), expect.anything());
  });

  it('turns a Stripe refusal into 502 REFUND_FAILED and records nothing', async () => {
    const refused = jest.fn(async () => {
      throw Object.assign(new Error('Cannot send email. In order to complete this refund, we must collect refund details through email.'), {
        type: 'StripeInvalidRequestError',
      });
    });
    const { m, service } = setup([[stripePayment()]], refused);
    await expect(service.refund(m.db, 'b1', 297000, 'cancel')).rejects.toMatchObject({ status: 502, code: ERROR_CODES.refundFailed });
    expect(m.ops('update')).toHaveLength(0);
  });

  it('does nothing when nothing was charged', async () => {
    const { m, service, refundsCreate } = setup([[]]);
    await expect(service.refund(m.db, 'b1', 297000, 'cancel')).resolves.toBe(0);
    await expect(service.refund(m.db, 'b1', 0, 'cancel')).resolves.toBe(0);
    expect(refundsCreate).not.toHaveBeenCalled();
  });
});
