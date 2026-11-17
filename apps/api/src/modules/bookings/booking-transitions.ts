import {
  BOOKING_STATUS_LABELS,
  ERROR_CODES,
  nextStatus,
  type BookingActor,
  type BookingStatus,
  type BookingTransition,
} from '@hongwang/shared';
import { and, eq, type SQL } from 'drizzle-orm';
import { AppException } from '../../common/errors';
import type { DbOrTx } from '../../database/database.module';
import { bookingEvents, bookings } from '../../database/schema';

export type BookingRow = typeof bookings.$inferSelect;
type BookingUpdate = Partial<Omit<typeof bookings.$inferInsert, 'id' | 'status'>>;

const VERBS: Record<BookingTransition, string> = {
  approve: 'approve',
  reject: 'decline',
  expire: 'expire',
  pay: 'pay for',
  complete: 'complete',
  cancel: 'cancel',
};

export function invalidTransition(from: BookingStatus, transition: BookingTransition, message?: string) {
  return new AppException(
    409,
    ERROR_CODES.invalidTransition,
    message ?? `You can’t ${VERBS[transition]} a booking that is ${BOOKING_STATUS_LABELS[from].toLowerCase()}`,
    { from, transition },
  );
}

/** Target status for `transition` from `from` by `actor`, or 409 INVALID_TRANSITION. */
export function assertTransition(from: BookingStatus, transition: BookingTransition, actor: BookingActor): BookingStatus {
  const to = nextStatus(from, transition, actor);
  if (!to) throw invalidTransition(from, transition);
  return to;
}

export interface TransitionArgs {
  booking: { id: string; status: BookingStatus };
  transition: BookingTransition;
  actor: BookingActor;
  actorId?: string | null;
  /** Extra columns to set with the new status (timestamps, refund amounts ...). */
  set?: BookingUpdate;
  /** Extra guard, e.g. `lte(bookings.holdExpiresAt, now)` for timeouts. */
  where?: SQL;
  note?: string | null;
}

/**
 * Every status change goes through here: the state machine (`nextStatus`) decides the target,
 * then a conditional `UPDATE ... WHERE id = $1 AND status = $from RETURNING *` applies it, so two
 * concurrent transitions can't both win (no lost updates), and a booking_events row records it.
 *
 * Throws 409 INVALID_TRANSITION when the state machine forbids it. Returns null when the row was no
 * longer in `from` (someone else changed it first) or the extra guard didn't match.
 */
export async function applyTransition(tx: DbOrTx, args: TransitionArgs): Promise<BookingRow | null> {
  const from = args.booking.status;
  const to = assertTransition(from, args.transition, args.actor);
  const conditions = [eq(bookings.id, args.booking.id), eq(bookings.status, from)];
  if (args.where) conditions.push(args.where);
  const [row] = await tx
    .update(bookings)
    .set({ ...args.set, status: to, updatedAt: new Date() })
    .where(and(...conditions))
    .returning();
  if (!row) return null;
  await tx.insert(bookingEvents).values({
    bookingId: row.id,
    fromStatus: from,
    toStatus: to,
    actor: args.actor,
    actorId: args.actorId ?? null,
    note: args.note ?? null,
  });
  return row;
}
