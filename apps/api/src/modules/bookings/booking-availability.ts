import type { IsoDate, Satang } from '@hongwang/shared';
import { and, eq, gt, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { DbOrTx } from '../../database/database.module';
import { bookingEvents, bookings, listingBlocks, listingPriceOverrides } from '../../database/schema';
import { assertTransition } from './booking-transitions';

/**
 * Availability reads for quotes and the pre-checks of create/approve. These are for friendly
 * errors only: the EXCLUDE constraint on bookings is the one guard against double booking.
 */

const stayOverlaps = (checkIn: IsoDate, checkOut: IsoDate) =>
  sql`${bookings.stay} && daterange(${checkIn}::date, ${checkOut}::date, '[)')`;

/** A live booking (confirmed, completed, or a payment hold that hasn't run out) overlaps the stay. */
export async function hasHeldOverlap(db: DbOrTx, listingId: string, checkIn: IsoDate, checkOut: IsoDate, now: Date) {
  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.listingId, listingId),
        stayOverlaps(checkIn, checkOut),
        or(
          inArray(bookings.status, ['confirmed', 'completed']),
          and(eq(bookings.status, 'payment_hold'), or(isNull(bookings.holdExpiresAt), gt(bookings.holdExpiresAt, now))),
        ),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** The host blocked one of the nights [checkIn, checkOut). */
export async function hasBlockedNight(db: DbOrTx, listingId: string, checkIn: IsoDate, checkOut: IsoDate) {
  const rows = await db
    .select({ date: listingBlocks.date })
    .from(listingBlocks)
    .where(and(eq(listingBlocks.listingId, listingId), gte(listingBlocks.date, checkIn), lt(listingBlocks.date, checkOut)))
    .limit(1);
  return rows.length > 0;
}

/** Host special prices for the nights of the stay, keyed by date. */
export async function priceOverridesFor(db: DbOrTx, listingId: string, checkIn: IsoDate, checkOut: IsoDate) {
  const rows = await db
    .select({ date: listingPriceOverrides.date, price: listingPriceOverrides.price })
    .from(listingPriceOverrides)
    .where(
      and(
        eq(listingPriceOverrides.listingId, listingId),
        gte(listingPriceOverrides.date, checkIn),
        lt(listingPriceOverrides.date, checkOut),
      ),
    );
  return Object.fromEntries(rows.map((r) => [r.date, r.price])) as Record<IsoDate, Satang>;
}

/**
 * Expires this listing's payment holds that ran out (payment_hold -> expired, by the system), so
 * their nights are free for the booking being created in the same transaction. Rows another
 * transaction is already expiring are skipped (SKIP LOCKED), so concurrent creates never deadlock.
 * Returns the expired booking ids (send their emails after commit).
 */
export async function expireStaleHolds(tx: DbOrTx, listingId: string, now: Date): Promise<string[]> {
  const to = assertTransition('payment_hold', 'expire', 'system');
  const res = await tx.execute<{ id: string }>(sql`
    WITH stale AS (
      SELECT id FROM bookings
      WHERE listing_id = ${listingId} AND status = 'payment_hold' AND hold_expires_at < ${now}
      ORDER BY id
      FOR UPDATE SKIP LOCKED
    )
    UPDATE bookings AS b
    SET status = ${to}, expired_at = ${now}, updated_at = ${now}
    FROM stale
    WHERE b.id = stale.id AND b.status = 'payment_hold'
    RETURNING b.id`);
  const ids = res.rows.map((r) => r.id);
  if (ids.length) {
    await tx.insert(bookingEvents).values(
      ids.map((id) => ({
        bookingId: id,
        fromStatus: 'payment_hold' as const,
        toStatus: to,
        actor: 'system' as const,
        note: 'Payment hold ran out',
      })),
    );
  }
  return ids;
}
