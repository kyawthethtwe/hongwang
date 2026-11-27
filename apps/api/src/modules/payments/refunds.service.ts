import { ERROR_CODES, type Satang } from '@hongwang/shared';
import { Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { AppException } from '../../common/errors';
import { InjectDb, type Database, type DbOrTx } from '../../database/database.module';
import { payments } from '../../database/schema';
import { StripeService } from './stripe.service';

export type RefundPurpose = 'cancel' | 'late-payment';

/**
 * Owner: Bookings & Payments module. Money going back to the guest, and PaymentIntents that should
 * no longer be payable. Used by booking cancellation, the timeout worker and late payments.
 */
@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly stripe: StripeService,
  ) {}

  /**
   * Refunds up to `amount` of the booking's captured payment and records it on the payments row.
   * Call it inside the transaction that cancels the booking: if Stripe refuses, the cancellation
   * rolls back too. The Stripe call is idempotent per booking and purpose, so a retry after a
   * failed commit can't refund twice; `charge.refunded` webhooks later sync the exact amount.
   * If Stripe refuses (for example a PromptPay refund the account can't email the guest about),
   * it's 502 REFUND_FAILED and the caller's transaction rolls back, so nothing changes.
   * Returns what was refunded (0 when nothing was charged).
   */
  async refund(tx: DbOrTx, bookingId: string, amount: Satang, purpose: RefundPurpose): Promise<Satang> {
    if (amount <= 0) return 0;
    const [pay] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.bookingId, bookingId), inArray(payments.status, ['succeeded', 'partially_refunded'])))
      .orderBy(desc(payments.createdAt))
      .limit(1)
      .for('update');
    if (!pay) return 0;
    const value = Math.min(amount, pay.amount - pay.refundedAmount);
    if (value <= 0) return 0;

    if (pay.provider === 'stripe' && pay.stripePaymentIntentId) {
      const stripe = this.stripe.client;
      if (!stripe) {
        throw new AppException(503, 'PAYMENTS_UNAVAILABLE', 'Refunds are unavailable right now. Please try again later.');
      }
      try {
        await stripe.refunds.create(
          { payment_intent: pay.stripePaymentIntentId, amount: value, metadata: { bookingId, purpose } },
          { idempotencyKey: `refund-${purpose}-${bookingId}` },
        );
      } catch (err) {
        this.logger.error({ err, bookingId, purpose, paymentIntent: pay.stripePaymentIntentId }, 'Stripe refused the refund');
        throw new AppException(
          502,
          ERROR_CODES.refundFailed,
          'We couldn’t start the refund, so nothing was changed. Please try again in a few minutes, or contact us.',
        );
      }
    }

    const refunded = pay.refundedAmount + value;
    await tx
      .update(payments)
      .set({ refundedAmount: refunded, status: refunded >= pay.amount ? 'refunded' : 'partially_refunded', updatedAt: new Date() })
      .where(eq(payments.id, pay.id));
    return value;
  }

  /**
   * Cancels PaymentIntents still waiting for money (booking expired or cancelled before payment).
   * Best effort: if Stripe says the intent already succeeded, the webhook arrives and
   * PaymentsService.confirmPayment refunds the late payment in full.
   */
  async cancelPending(bookingId: string): Promise<void> {
    try {
      const rows = await this.db
        .select()
        .from(payments)
        .where(and(eq(payments.bookingId, bookingId), inArray(payments.status, ['pending', 'failed'])));
      for (const p of rows) {
        if (p.stripePaymentIntentId && this.stripe.client) {
          try {
            await this.stripe.client.paymentIntents.cancel(p.stripePaymentIntentId);
          } catch (err) {
            this.logger.warn({ err, bookingId, paymentIntent: p.stripePaymentIntentId }, 'Could not cancel PaymentIntent');
            continue;
          }
        }
        await this.db
          .update(payments)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(and(eq(payments.id, p.id), inArray(payments.status, ['pending', 'failed'])));
      }
    } catch (err) {
      this.logger.warn({ err, bookingId }, 'Could not cancel pending payments');
    }
  }
}
