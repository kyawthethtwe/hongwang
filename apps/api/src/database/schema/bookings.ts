import type { NightPrice } from '@hongwang/shared';
import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, jsonb, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import {
  bookingActorEnum,
  bookingStatusEnum,
  cancellationPolicyEnum,
  paymentMethodEnum,
  paymentStatusEnum,
} from './enums';
import { listings } from './listings';
import { createdAt, daterange, tstz, updatedAt } from './types';
import { users } from './users';

/**
 * Bookings. The no-double-booking guarantee is a Postgres constraint, not application code:
 *
 *   EXCLUDE USING gist (listing_id WITH =, stay WITH &&)
 *     WHERE (status IN ('payment_hold','confirmed','completed'))
 *
 * (see migrations/0002_booking_constraints.sql). `stay` is generated from check_in/check_out as
 * the half-open range [check_in, check_out). Prices are snapshotted at reservation time (satang).
 * host_id is denormalised from the listing so CASL can check ownership without a join.
 */
export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ref: varchar('ref', { length: 12 }).notNull().unique(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'restrict' }),
    guestId: uuid('guest_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    hostId: uuid('host_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: bookingStatusEnum('status').notNull(),
    checkIn: date('check_in', { mode: 'string' }).notNull(),
    checkOut: date('check_out', { mode: 'string' }).notNull(),
    stay: daterange('stay').generatedAlwaysAs(sql`daterange(check_in, check_out, '[)')`),
    guests: integer('guests').notNull(),
    nights: integer('nights').notNull(),
    // price snapshot (satang)
    nightlyPrices: jsonb('nightly_prices').$type<NightPrice[]>().notNull(),
    nightsSubtotal: integer('nights_subtotal').notNull(),
    weeklyDiscount: integer('weekly_discount').notNull().default(0),
    nightsTotal: integer('nights_total').notNull(),
    cleaningFee: integer('cleaning_fee').notNull(),
    serviceFee: integer('service_fee').notNull(),
    total: integer('total').notNull(),
    hostFee: integer('host_fee').notNull(),
    hostPayout: integer('host_payout').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('THB'),
    cancellationPolicy: cancellationPolicyEnum('cancellation_policy').notNull(),
    instant: boolean('instant').notNull(),
    message: text('message'),
    // lifecycle
    requestExpiresAt: tstz('request_expires_at'),
    holdExpiresAt: tstz('hold_expires_at'),
    approvedAt: tstz('approved_at'),
    confirmedAt: tstz('confirmed_at'),
    completedAt: tstz('completed_at'),
    rejectedAt: tstz('rejected_at'),
    rejectReason: text('reject_reason'),
    expiredAt: tstz('expired_at'),
    cancelledAt: tstz('cancelled_at'),
    cancelledBy: bookingActorEnum('cancelled_by'),
    cancelReason: text('cancel_reason'),
    refundAmount: integer('refund_amount'),
    hostPenalty: integer('host_penalty'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('bookings_guest_idx').on(t.guestId, t.checkIn),
    index('bookings_host_idx').on(t.hostId, t.status),
    index('bookings_listing_idx').on(t.listingId),
    index('bookings_hold_expiry_idx').on(t.holdExpiresAt).where(sql`${t.status} = 'payment_hold'`),
    index('bookings_request_expiry_idx').on(t.requestExpiresAt).where(sql`${t.status} = 'requested'`),
    check('bookings_not_own_listing', sql`${t.guestId} <> ${t.hostId}`),
    check('bookings_dates_valid', sql`${t.checkOut} > ${t.checkIn}`),
    check('bookings_guests_positive', sql`${t.guests} >= 1`),
  ],
);

/** Append-only log of every status change. */
export const bookingEvents = pgTable(
  'booking_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    fromStatus: bookingStatusEnum('from_status'),
    toStatus: bookingStatusEnum('to_status').notNull(),
    actor: bookingActorEnum('actor').notNull(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('booking_events_booking_idx').on(t.bookingId, t.createdAt)],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'restrict' }),
    provider: varchar('provider', { length: 20 }).notNull().default('stripe'),
    stripePaymentIntentId: text('stripe_payment_intent_id').unique(),
    method: paymentMethodEnum('method'),
    status: paymentStatusEnum('status').notNull().default('pending'),
    amount: integer('amount').notNull(),
    refundedAmount: integer('refunded_amount').notNull().default(0),
    currency: varchar('currency', { length: 3 }).notNull().default('THB'),
    last4: varchar('last4', { length: 4 }),
    paidAt: tstz('paid_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('payments_booking_idx').on(t.bookingId)],
);

/** Stripe webhook idempotency: an event id is processed once. */
export const stripeEvents = pgTable('stripe_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  receivedAt: createdAt(),
  processedAt: tstz('processed_at'),
});
