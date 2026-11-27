import {
  ERROR_CODES,
  formatTHB,
  type BookingDto,
  type PaymentIntentDto,
  type PaymentMethod,
  type Satang,
} from '@hongwang/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type Stripe from 'stripe';
import { AbilityFactory, assertCan, sub } from '../../authz/ability';
import type { AuthUser } from '../../common/auth';
import { AppException, badRequest, forbidden, notFound } from '../../common/errors';
import { ENV, type Env } from '../../config/env';
import { InjectDb, type Database, type DbOrTx } from '../../database/database.module';
import { bookings, payments, stripeEvents } from '../../database/schema';
import { BookingEmails } from '../bookings/booking-emails.service';
import { BookingReadService } from '../bookings/booking-read.service';
import { BookingTimeouts } from '../bookings/booking-timeouts.service';
import { applyTransition, invalidTransition, type BookingRow } from '../bookings/booking-transitions';
import { RefundsService } from './refunds.service';
import { StripeService } from './stripe.service';

/** What a successful payment tells us, from the webhook or the dev simulator. */
export interface PaymentSuccess {
  provider: 'stripe' | 'simulated';
  paymentIntentId?: string | null;
  amount: Satang;
  method?: PaymentMethod | null;
  last4?: string | null;
  paidAt?: Date;
}

export type ConfirmOutcome = 'confirmed' | 'already_confirmed' | 'refunded_late' | 'missing';

/** Stripe statuses in which an existing PaymentIntent can still be paid. */
const REUSABLE_INTENT = new Set<Stripe.PaymentIntent.Status>([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
]);

/** PromptPay is its own Stripe method; mobile banking is treated like card for now. */
export const paymentMethodTypes = (method: PaymentMethod): string[] => (method === 'promptpay' ? ['promptpay'] : ['card']);

export const holdExpired = () =>
  new AppException(410, ERROR_CODES.holdExpired, 'This hold has expired. The dates are back on sale and you haven’t been charged.');

/**
 * Owner: Bookings & Payments module. PaymentIntents, the Stripe webhook and the dev simulator.
 * A booking becomes `confirmed` only in `confirmPayment`, which only the webhook and the simulator
 * call: never the browser redirect.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly abilities: AbilityFactory,
    private readonly stripe: StripeService,
    private readonly refunds: RefundsService,
    private readonly read: BookingReadService,
    private readonly emails: BookingEmails,
    private readonly timeouts: BookingTimeouts,
  ) {}

  // ---------------------------------------------------------------- intent

  /**
   * Safe to retry without an Idempotency-Key: a retry finds and returns the booking's open intent
   * (reusableIntent), and two first calls at once send Stripe the same idempotency key (same intent
   * count), so Stripe hands both the same intent and the upsert on stripe_payment_intent_id keeps one row.
   */
  async createIntent(user: AuthUser, input: { bookingId: string; method?: PaymentMethod }, now = new Date()): Promise<PaymentIntentDto> {
    const b = await this.payableBooking(user, input.bookingId, now);
    const method = input.method ?? 'card';
    const base = { amount: b.total, currency: 'THB' as const, holdExpiresAt: b.holdExpiresAt!.toISOString() };
    const stripe = this.stripe.client;

    if (!stripe) {
      await this.upsertSimulated(b, method);
      return { mode: 'simulated', clientSecret: null, publishableKey: null, ...base };
    }

    const types = paymentMethodTypes(method);
    const intent = await this.reusableIntent(stripe, b, types);
    const pi =
      intent ??
      (await stripe.paymentIntents.create(
        {
          amount: b.total,
          currency: 'thb',
          payment_method_types: types,
          description: `Hongwang booking ${b.ref}`,
          metadata: { bookingId: b.id, ref: b.ref },
        },
        { idempotencyKey: `booking-${b.id}-pi-${await this.intentCount(b.id)}-${types.join('+')}` },
      ));

    await this.db
      .insert(payments)
      .values({
        bookingId: b.id,
        provider: 'stripe',
        stripePaymentIntentId: pi.id,
        method,
        status: 'pending',
        amount: b.total,
        currency: 'THB',
      })
      .onConflictDoUpdate({
        target: payments.stripePaymentIntentId,
        set: { method, updatedAt: new Date() },
        setWhere: sql`${payments.status} in ('pending', 'failed')`,
      });

    if (!pi.client_secret) throw new AppException(502, 'PAYMENTS_UNAVAILABLE', 'Stripe didn’t return a client secret');
    return { mode: 'stripe', clientSecret: pi.client_secret, publishableKey: this.stripe.publishableKey, ...base };
  }

  // ---------------------------------------------------------------- simulate (dev only)

  get simulationEnabled() {
    return !this.stripe.client && this.env.NODE_ENV !== 'production';
  }

  async simulate(user: AuthUser, bookingId: string, now = new Date()): Promise<BookingDto> {
    if (!this.simulationEnabled) throw notFound('Route');
    const b = await this.payableBooking(user, bookingId, now);
    const [pending] = await this.pendingSimulated(this.db, b.id);
    const method = pending?.method ?? 'card';
    await this.confirmPayment(b.id, {
      provider: 'simulated',
      amount: b.total,
      method,
      last4: method === 'promptpay' ? null : '4242',
      paidAt: now,
    });
    const dto = await this.read.findDto(b.id, user);
    if (!dto) throw notFound('Booking');
    return dto;
  }

  // ---------------------------------------------------------------- confirmation

  /**
   * The one place a booking gets confirmed: payment_hold -> confirmed (+ confirmedAt), payment
   * succeeded (+ last4, paidAt), then the confirmation emails and the complete-stay job.
   * Idempotent: a repeated event finds the booking already confirmed. If the booking expired or
   * was cancelled before the money arrived, the payment is refunded in full.
   */
  async confirmPayment(bookingId: string, info: PaymentSuccess): Promise<ConfirmOutcome> {
    const paidAt = info.paidAt ?? new Date();
    const result = await this.db.transaction(async (tx) => {
      const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
      if (!b) return { outcome: 'missing' as const };
      await this.recordSucceeded(tx, b, info, paidAt);

      let current: BookingRow = b;
      if (b.status === 'payment_hold') {
        const row = await applyTransition(tx, {
          booking: b,
          transition: 'pay',
          actor: 'system',
          set: { confirmedAt: paidAt },
          note: `Paid ${formatTHB(info.amount)} (${info.provider})`,
        });
        if (row) return { outcome: 'confirmed' as const, booking: row };
        // Lost a race with the expiry: read what it is now.
        const [again] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
        current = again ?? b;
      }
      if (current.status === 'confirmed' || current.status === 'completed') return { outcome: 'already_confirmed' as const };

      // Paid too late (expired / cancelled / declined): give everything back.
      const refunded = await this.refunds.refund(tx, current.id, info.amount, 'late-payment');
      if (refunded > 0) {
        await tx
          .update(bookings)
          .set({ refundAmount: (current.refundAmount ?? 0) + refunded, updatedAt: new Date() })
          .where(eq(bookings.id, current.id));
      }
      this.logger.warn({ bookingId, status: current.status, refunded }, 'Payment arrived after the booking ended; refunded');
      return { outcome: 'refunded_late' as const };
    });

    if (result.outcome === 'confirmed') {
      await this.emails.confirmed(bookingId);
      await this.timeouts.completeAfter(bookingId, result.booking.checkOut);
    }
    return result.outcome;
  }

  // ---------------------------------------------------------------- webhook

  /**
   * Stripe webhook. Verifies the signature over the raw body, records the event id (stripe_events)
   * so a redelivered event is processed once, then dispatches. If handling throws, the event stays
   * unprocessed and Stripe's retry runs it again (every handler is idempotent).
   */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<{ received: true; duplicate?: true }> {
    const stripe = this.stripe.client;
    const secret = this.stripe.webhookSecret;
    if (!stripe || !secret) throw new AppException(400, 'STRIPE_NOT_CONFIGURED', 'Stripe webhooks are not configured');
    if (!rawBody || !signature) throw badRequest('Missing Stripe signature');

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new AppException(400, 'INVALID_SIGNATURE', 'Invalid Stripe signature');
    }

    const [inserted] = await this.db
      .insert(stripeEvents)
      .values({ id: event.id, type: event.type })
      .onConflictDoNothing()
      .returning({ id: stripeEvents.id });
    if (!inserted) {
      const [seen] = await this.db
        .select({ processedAt: stripeEvents.processedAt })
        .from(stripeEvents)
        .where(eq(stripeEvents.id, event.id))
        .limit(1);
      if (seen?.processedAt) return { received: true, duplicate: true };
    }

    await this.dispatch(stripe, event);
    await this.db.update(stripeEvents).set({ processedAt: new Date() }).where(eq(stripeEvents.id, event.id));
    return { received: true };
  }

  private async dispatch(stripe: Stripe, event: Stripe.Event) {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const bookingId = pi.metadata?.bookingId;
        if (!bookingId) {
          this.logger.warn({ paymentIntent: pi.id }, 'PaymentIntent without bookingId metadata');
          return;
        }
        const details = await this.chargeDetails(stripe, pi);
        await this.confirmPayment(bookingId, {
          provider: 'stripe',
          paymentIntentId: pi.id,
          amount: pi.amount_received || pi.amount,
          method: details.method,
          last4: details.last4,
        });
        return;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        await this.db
          .update(payments)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(and(eq(payments.stripePaymentIntentId, pi.id), eq(payments.status, 'pending')));
        return;
      }
      case 'charge.refunded': {
        const charge = event.data.object;
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
        if (!piId) return;
        await this.db
          .update(payments)
          .set({
            refundedAmount: charge.amount_refunded,
            status: charge.refunded ? 'refunded' : 'partially_refunded',
            updatedAt: new Date(),
          })
          .where(eq(payments.stripePaymentIntentId, piId));
        return;
      }
      default:
        return;
    }
  }

  // ---------------------------------------------------------------- helpers

  /** The booking the caller (its guest) can pay now, or the right error. */
  private async payableBooking(user: AuthUser, bookingId: string, now: Date): Promise<BookingRow> {
    const [b] = await this.db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    const ability = this.abilities.for(user);
    if (!b || !ability.can('read', sub('Booking', b))) throw notFound('Booking');
    assertCan(ability, 'pay', 'Booking', b);
    if (b.guestId !== user.id) throw forbidden('Only the guest can pay for this booking');
    if (b.status === 'expired' || (b.status === 'payment_hold' && (!b.holdExpiresAt || b.holdExpiresAt <= now))) {
      throw holdExpired();
    }
    if (b.status !== 'payment_hold') {
      throw invalidTransition(b.status, 'pay', b.status === 'confirmed' || b.status === 'completed' ? 'This booking is already paid' : undefined);
    }
    return b;
  }

  /** An existing PaymentIntent of this booking that can still be paid (switched to `types` if needed). */
  private async reusableIntent(stripe: Stripe, b: BookingRow, types: string[]): Promise<Stripe.PaymentIntent | null> {
    const [row] = await this.db
      .select({ pi: payments.stripePaymentIntentId })
      .from(payments)
      .where(
        and(
          eq(payments.bookingId, b.id),
          eq(payments.provider, 'stripe'),
          isNotNull(payments.stripePaymentIntentId),
          inArray(payments.status, ['pending', 'failed']),
        ),
      )
      .orderBy(desc(payments.createdAt))
      .limit(1);
    if (!row?.pi) return null;
    const pi = await stripe.paymentIntents.retrieve(row.pi);
    if (pi.status === 'processing' || pi.status === 'succeeded') {
      throw new AppException(409, 'PAYMENT_PROCESSING', 'Your payment is already being confirmed');
    }
    if (!REUSABLE_INTENT.has(pi.status) || pi.amount !== b.total) return null;
    const same = pi.payment_method_types.length === types.length && types.every((t) => pi.payment_method_types.includes(t));
    return same ? pi : stripe.paymentIntents.update(pi.id, { payment_method_types: types });
  }

  private async intentCount(bookingId: string) {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(payments)
      .where(and(eq(payments.bookingId, bookingId), eq(payments.provider, 'stripe')));
    return row?.n ?? 0;
  }

  private pendingSimulated(db: DbOrTx, bookingId: string) {
    return db
      .select()
      .from(payments)
      .where(and(eq(payments.bookingId, bookingId), eq(payments.provider, 'simulated'), eq(payments.status, 'pending')))
      .orderBy(desc(payments.createdAt))
      .limit(1);
  }

  private async upsertSimulated(b: BookingRow, method: PaymentMethod) {
    const [pending] = await this.pendingSimulated(this.db, b.id);
    if (pending) {
      await this.db.update(payments).set({ method, updatedAt: new Date() }).where(eq(payments.id, pending.id));
    } else {
      await this.db
        .insert(payments)
        .values({ bookingId: b.id, provider: 'simulated', method, status: 'pending', amount: b.total, currency: 'THB' });
    }
  }

  /** Marks the payment row succeeded (creating it if the intent was made elsewhere). */
  private async recordSucceeded(tx: DbOrTx, b: BookingRow, info: PaymentSuccess, paidAt: Date) {
    const values = {
      status: 'succeeded' as const,
      last4: info.last4 ?? null,
      paidAt,
      amount: info.amount,
      updatedAt: new Date(),
      ...(info.method ? { method: info.method } : {}),
    };
    if (info.provider === 'stripe' && info.paymentIntentId) {
      await tx
        .insert(payments)
        .values({
          bookingId: b.id,
          provider: 'stripe',
          stripePaymentIntentId: info.paymentIntentId,
          currency: 'THB',
          method: info.method ?? null,
          ...values,
        })
        .onConflictDoUpdate({
          target: payments.stripePaymentIntentId,
          set: values,
          setWhere: sql`${payments.status} in ('pending', 'failed', 'cancelled')`,
        });
      return;
    }
    const [pending] = await this.pendingSimulated(tx, b.id);
    if (pending) {
      await tx.update(payments).set(values).where(eq(payments.id, pending.id));
    } else {
      await tx.insert(payments).values({ bookingId: b.id, provider: 'simulated', currency: 'THB', method: info.method ?? 'card', ...values });
    }
  }

  private async chargeDetails(stripe: Stripe, pi: Stripe.PaymentIntent): Promise<{ last4: string | null; method: PaymentMethod | null }> {
    let charge: Stripe.Charge | null = null;
    try {
      charge =
        typeof pi.latest_charge === 'string' ? await stripe.charges.retrieve(pi.latest_charge) : (pi.latest_charge ?? null);
    } catch (err) {
      this.logger.warn({ err, paymentIntent: pi.id }, 'Could not load the charge for card details');
    }
    const d = charge?.payment_method_details;
    const method: PaymentMethod | null = d?.type === 'promptpay' ? 'promptpay' : d?.type === 'card' ? 'card' : null;
    return { last4: d?.card?.last4 ?? null, method };
  }
}
