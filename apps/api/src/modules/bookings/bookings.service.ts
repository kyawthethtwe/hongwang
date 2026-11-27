import {
  eachNight,
  ERROR_CODES,
  freeCancellationUntil,
  nightsBetween,
  PAYMENT_HOLD_TTL_MS,
  QUOTE_REASONS,
  quoteStay,
  REQUEST_TTL_MS,
  todayInBangkok,
  type BookingActor,
  type BookingDto,
  type BookingStatus,
  type CancelBookingInput,
  type CreateBookingInput,
  type IsoDate,
  type MyBookingsQuery,
  type QuoteDto,
  type QuoteInput,
  type QuoteReason,
  type RefundQuote,
  type RejectBookingInput,
} from '@hongwang/shared';
import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, lt, or, type SQL } from 'drizzle-orm';
import { AbilityFactory, assertCan, sub } from '../../authz/ability';
import type { AuthUser } from '../../common/auth';
import { AppException, badRequest, isExclusionViolation, isUniqueViolation, notFound } from '../../common/errors';
import { InjectDb, type Database, type DbOrTx } from '../../database/database.module';
import { bookingEvents, bookings, listingBlocks, listings } from '../../database/schema';
import { RefundsService } from '../payments/refunds.service';
import {
  expireStaleHolds,
  hasBlockedNight,
  hasHeldOverlap,
  priceOverridesFor,
} from './booking-availability';
import { BookingEmails } from './booking-emails.service';
import { BookingReadService } from './booking-read.service';
import { generateBookingRef, REF_UNIQUE_CONSTRAINT } from './booking-ref';
import { QUOTE_REASON_MESSAGES, refundFor, stayRuleViolations, TAB_STATUSES, type BookingTab } from './booking-rules';
import { BookingTimeouts } from './booking-timeouts.service';
import { applyTransition, assertTransition, invalidTransition, type BookingRow } from './booking-transitions';

/** Longest range we price at all (max_nights catches anything above the listing's own limit). */
const MAX_QUOTED_NIGHTS = 731;
const REF_ATTEMPTS = 5;
const IDEMPOTENCY_KEY_CONSTRAINT = 'bookings_guest_idempotency_key_unique';

export const datesUnavailable = (message = 'Those dates aren’t available any more') =>
  new AppException(409, ERROR_CODES.datesUnavailable, message);

type ListingRow = typeof listings.$inferSelect;

/** Which side of the booking the caller is on. Only called after a CASL check passed. */
export function actorFor(user: AuthUser, b: Pick<BookingRow, 'guestId' | 'hostId'>): BookingActor {
  if (b.guestId === user.id) return 'guest';
  if (b.hostId === user.id) return 'host';
  return 'admin';
}

/** SQL for a /bookings/mine tab; mirrors `bookingTab` in booking-rules.ts. */
export function tabWhere(tab: BookingTab, today: IsoDate): { where: SQL; orderBy: SQL[] } {
  switch (tab) {
    case 'upcoming':
      return {
        where: and(inArray(bookings.status, [...TAB_STATUSES.upcoming]), gte(bookings.checkOut, today))!,
        orderBy: [asc(bookings.checkIn), asc(bookings.createdAt)],
      };
    case 'past':
      return {
        where: or(eq(bookings.status, 'completed'), and(eq(bookings.status, 'confirmed'), lt(bookings.checkOut, today)))!,
        orderBy: [desc(bookings.checkIn), desc(bookings.createdAt)],
      };
    case 'cancelled':
      return {
        where: inArray(bookings.status, [...TAB_STATUSES.cancelled]),
        orderBy: [desc(bookings.updatedAt)],
      };
  }
}

/**
 * Owner: Bookings & Payments module. Quote, create (request or instant book), approve, reject,
 * cancel. The no-double-booking guarantee is the EXCLUDE constraint on bookings: this service only
 * translates its violation (SQLSTATE 23P01) into 409 DATES_UNAVAILABLE. No application locks.
 */
@Injectable()
export class BookingsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly abilities: AbilityFactory,
    private readonly read: BookingReadService,
    private readonly emails: BookingEmails,
    private readonly timeouts: BookingTimeouts,
    private readonly refunds: RefundsService,
  ) {}

  // ---------------------------------------------------------------- quote

  async quote(user: AuthUser | undefined, input: QuoteInput, now = new Date()): Promise<QuoteDto> {
    const listing = await this.loadListing(input.listingId);
    if (!listing || listing.status !== 'published') throw notFound('Listing');
    this.assertQuotable(input);
    const reasons = stayRuleViolations(listing, input, todayInBangkok(now));
    if (await this.isUnavailable(this.db, listing.id, input.checkIn, input.checkOut, now)) reasons.push('unavailable');
    if (user?.id === listing.hostId) reasons.push('own_listing');
    return {
      available: reasons.length === 0,
      reasons: sortReasons(reasons),
      quote: await this.priceFor(listing, input),
      instantBook: listing.instantBook,
      cancellationPolicy: listing.cancellationPolicy,
      freeCancellationUntil: freeCancellationUntil(listing.cancellationPolicy, input.checkIn),
    };
  }

  // ---------------------------------------------------------------- create

  /**
   * With an Idempotency-Key, a retry gets the booking the first attempt created instead of a 409
   * against the guest's own hold. The key is stored on the booking in the same transaction, so
   * neither a response lost after commit nor a double submit can create a second booking.
   */
  async create(
    user: AuthUser,
    input: CreateBookingInput,
    now = new Date(),
    idempotencyKey: string | null = null,
  ): Promise<BookingDto> {
    if (!idempotencyKey) return this.createNew(user, input, now, null);
    const prior = await this.findByIdempotencyKey(user.id, idempotencyKey);
    if (prior) return this.replay(user, prior, input);
    try {
      return await this.createNew(user, input, now, idempotencyKey);
    } catch (err) {
      // A concurrent request with the same key got there first (its key row, or its hold on the
      // dates): answer with that booking.
      const lostRace =
        isUniqueViolation(err, IDEMPOTENCY_KEY_CONSTRAINT) ||
        (err instanceof AppException && err.code === ERROR_CODES.datesUnavailable);
      if (!lostRace) throw err;
      const winner = await this.findByIdempotencyKey(user.id, idempotencyKey);
      if (winner) return this.replay(user, winner, input);
      throw err;
    }
  }

  private async createNew(user: AuthUser, input: CreateBookingInput, now: Date, idempotencyKey: string | null): Promise<BookingDto> {
    const listing = await this.loadListing(input.listingId);
    if (!listing) throw notFound('Listing');
    if (listing.hostId === user.id) {
      throw new AppException(403, ERROR_CODES.ownListing, 'You can’t book your own listing');
    }
    assertCan(this.abilities.for(user), 'book', 'Listing', listing, 'This listing isn’t taking bookings right now');
    this.assertQuotable(input);

    const reasons = sortReasons(stayRuleViolations(listing, input, todayInBangkok(now)));
    if (reasons.length) {
      throw new AppException(400, ERROR_CODES.validation, QUOTE_REASON_MESSAGES[reasons[0]!](listing), { reasons });
    }
    const instant = listing.instantBook;
    const message = input.message?.trim() || null;
    if (!instant && !message) {
      throw badRequest('Add a short message so the host knows who’s coming', [{ path: ['message'], message: 'Add a message for the host' }]);
    }
    if (await this.isUnavailable(this.db, listing.id, input.checkIn, input.checkOut, now)) throw datesUnavailable();

    const price = await this.priceFor(listing, input);
    const status: BookingStatus = instant ? 'payment_hold' : 'requested';
    const holdExpiresAt = instant ? new Date(now.getTime() + PAYMENT_HOLD_TTL_MS) : null;
    const requestExpiresAt = instant ? null : new Date(now.getTime() + REQUEST_TTL_MS);

    const created = await this.withRefRetry(() =>
      this.db.transaction(async (tx) => {
        // Free nights held by payment holds that ran out, then re-check the host's blocks.
        const expired = await expireStaleHolds(tx, listing.id, now);
        if (await hasBlockedNight(tx, listing.id, input.checkIn, input.checkOut)) throw datesUnavailable();
        const [row] = await tx
          .insert(bookings)
          .values({
            ref: generateBookingRef(),
            listingId: listing.id,
            guestId: user.id,
            hostId: listing.hostId,
            status,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            guests: input.guests,
            nights: price.nights,
            nightlyPrices: price.nightly,
            nightsSubtotal: price.nightsSubtotal,
            weeklyDiscount: price.weeklyDiscount,
            nightsTotal: price.nightsTotal,
            cleaningFee: price.cleaningFee,
            serviceFee: price.serviceFee,
            total: price.total,
            hostFee: price.hostFee,
            hostPayout: price.hostPayout,
            currency: price.currency,
            cancellationPolicy: listing.cancellationPolicy,
            instant,
            message,
            idempotencyKey,
            holdExpiresAt,
            requestExpiresAt,
          })
          .returning({ id: bookings.id });
        await tx.insert(bookingEvents).values({
          bookingId: row!.id,
          fromStatus: null,
          toStatus: status,
          actor: 'guest',
          actorId: user.id,
          note: instant ? 'Instant book' : 'Request to book',
        });
        return { id: row!.id, expired };
      }),
    );

    await this.afterHoldsExpired(created.expired);
    await this.afterCreate({ id: created.id, status, holdExpiresAt, requestExpiresAt });
    return this.dto(created.id, user);
  }

  /** Deadline jobs and request emails for a new booking. Each is deduplicated by job id, so a replay can run it again. */
  private async afterCreate(b: Pick<BookingRow, 'id' | 'status' | 'holdExpiresAt' | 'requestExpiresAt'>) {
    if (b.status === 'payment_hold' && b.holdExpiresAt) {
      await this.timeouts.expireHoldAt(b.id, b.holdExpiresAt);
    } else if (b.status === 'requested' && b.requestExpiresAt) {
      await this.timeouts.expireRequestAt(b.id, b.requestExpiresAt);
      await this.emails.requested(b.id);
    }
  }

  /** A retry of a create that already happened: same stay, so return that booking as it is now. */
  private async replay(user: AuthUser, prior: BookingRow, input: CreateBookingInput): Promise<BookingDto> {
    const sameStay =
      prior.listingId === input.listingId &&
      prior.checkIn === input.checkIn &&
      prior.checkOut === input.checkOut &&
      prior.guests === input.guests;
    if (!sameStay) {
      throw new AppException(422, ERROR_CODES.idempotencyKeyReused, 'That Idempotency-Key was already used for a different stay');
    }
    // The first attempt may have failed between commit and its follow-up work.
    await this.afterCreate(prior);
    return this.dto(prior.id, user);
  }

  private async findByIdempotencyKey(guestId: string, key: string): Promise<BookingRow | null> {
    const [row] = await this.db
      .select()
      .from(bookings)
      .where(and(eq(bookings.guestId, guestId), eq(bookings.idempotencyKey, key)))
      .limit(1);
    return row ?? null;
  }

  // ---------------------------------------------------------------- host: approve / reject

  async approve(user: AuthUser, id: string, now = new Date()): Promise<BookingDto> {
    const b = await this.loadVisible(user, id);
    assertCan(this.abilities.for(user), 'approve', 'Booking', b);
    const actor = actorFor(user, b);
    assertTransition(b.status, 'approve', actor);

    if (b.requestExpiresAt && b.requestExpiresAt <= now) {
      const expired = await applyTransition(this.db, {
        booking: b,
        transition: 'expire',
        actor: 'system',
        set: { expiredAt: now },
        note: 'Host didn’t answer in time',
      });
      if (expired) await this.emails.expired(b.id, 'request');
      throw invalidTransition(b.status, 'approve', 'This request has expired');
    }
    if (b.checkIn < todayInBangkok(now)) {
      throw invalidTransition(b.status, 'approve', 'The check-in date has already passed');
    }

    const holdExpiresAt = new Date(now.getTime() + PAYMENT_HOLD_TTL_MS);
    let expired: string[];
    try {
      expired = await this.db.transaction(async (tx) => {
        const stale = await expireStaleHolds(tx, b.listingId, now);
        if (await hasBlockedNight(tx, b.listingId, b.checkIn, b.checkOut)) {
          throw datesUnavailable('Some of these nights are blocked in your calendar. Unblock them first.');
        }
        // requested -> payment_hold makes the row date-holding: the EXCLUDE constraint decides here.
        const row = await applyTransition(tx, {
          booking: b,
          transition: 'approve',
          actor,
          actorId: user.id,
          set: { approvedAt: now, holdExpiresAt },
        });
        if (!row) throw invalidTransition(b.status, 'approve', 'This request changed in the meantime. Refresh and try again.');
        return stale;
      });
    } catch (err) {
      if (isExclusionViolation(err)) throw datesUnavailable('Another guest booked these dates in the meantime');
      throw err;
    }

    await this.afterHoldsExpired(expired);
    await this.timeouts.expireHoldAt(b.id, holdExpiresAt);
    await this.emails.approved(b.id);
    return this.dto(b.id, user);
  }

  async reject(user: AuthUser, id: string, input: RejectBookingInput, now = new Date()): Promise<BookingDto> {
    const b = await this.loadVisible(user, id);
    assertCan(this.abilities.for(user), 'reject', 'Booking', b);
    const actor = actorFor(user, b);
    const row = await applyTransition(this.db, {
      booking: b,
      transition: 'reject',
      actor,
      actorId: user.id,
      set: { rejectedAt: now, rejectReason: input.reason?.trim() || null },
      note: input.reason ?? null,
    });
    if (!row) throw invalidTransition(b.status, 'reject', 'This request changed in the meantime. Refresh and try again.');
    await this.emails.rejected(b.id);
    return this.dto(b.id, user);
  }

  // ---------------------------------------------------------------- cancel

  async cancellationQuote(user: AuthUser, id: string, now = new Date()): Promise<RefundQuote> {
    const b = await this.loadVisible(user, id);
    assertCan(this.abilities.for(user), 'cancel', 'Booking', b);
    const actor = actorFor(user, b);
    assertTransition(b.status, 'cancel', actor);
    return refundFor(b, actor, todayInBangkok(now));
  }

  async cancel(user: AuthUser, id: string, input: CancelBookingInput, now = new Date()): Promise<BookingDto> {
    const b = await this.loadVisible(user, id);
    assertCan(this.abilities.for(user), 'cancel', 'Booking', b);
    const actor = actorFor(user, b);
    assertTransition(b.status, 'cancel', actor);
    const charged = b.status === 'confirmed';
    const quote = refundFor(b, actor, todayInBangkok(now));
    const hostPenalty = actor === 'host' ? quote.hostPenalty : null;

    await this.db.transaction(async (tx) => {
      // Win the status change first (the row is now locked), then move money.
      const row = await applyTransition(tx, {
        booking: b,
        transition: 'cancel',
        actor,
        actorId: user.id,
        set: {
          cancelledAt: now,
          cancelledBy: actor,
          cancelReason: input.reason,
          refundAmount: charged ? quote.refundTotal : 0,
          hostPenalty,
        },
        note: input.reason,
      });
      if (!row) throw invalidTransition(b.status, 'cancel', 'This booking changed in the meantime. Refresh and try again.');
      if (charged) {
        const refunded = await this.refunds.refund(tx, b.id, quote.refundTotal, 'cancel');
        if (refunded !== quote.refundTotal) {
          await tx.update(bookings).set({ refundAmount: refunded }).where(eq(bookings.id, b.id));
        }
      }
      if (actor === 'host') {
        // Design C6: a host who cancels keeps those nights blocked (no re-selling the dates).
        await tx
          .insert(listingBlocks)
          .values(eachNight(b.checkIn, b.checkOut).map((date) => ({ listingId: b.listingId, date })))
          .onConflictDoNothing();
      }
    });

    if (!charged) await this.refunds.cancelPending(b.id);
    await this.emails.cancelled(b.id);
    return this.dto(b.id, user);
  }

  // ---------------------------------------------------------------- reads

  async mine(user: AuthUser, query: MyBookingsQuery, now = new Date()): Promise<BookingDto[]> {
    const { where, orderBy } = tabWhere(query.tab, todayInBangkok(now));
    return this.read.findDtos(and(eq(bookings.guestId, user.id), where), user, { orderBy, limit: 200 });
  }

  async get(user: AuthUser, id: string): Promise<BookingDto> {
    await this.loadVisible(user, id);
    return this.dto(id, user);
  }

  // ---------------------------------------------------------------- helpers

  private async loadListing(id: string): Promise<ListingRow | null> {
    const [row] = await this.db.select().from(listings).where(eq(listings.id, id)).limit(1);
    return row && !row.deletedAt ? row : null;
  }

  /** The booking, if the caller may read it (CASL); 404 otherwise so ids don't leak. */
  private async loadVisible(user: AuthUser, id: string): Promise<BookingRow> {
    const [row] = await this.db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    if (!row || !this.abilities.for(user).can('read', sub('Booking', row))) throw notFound('Booking');
    return row;
  }

  private async dto(id: string, user: AuthUser): Promise<BookingDto> {
    const dto = await this.read.findDto(id, user);
    if (!dto) throw notFound('Booking');
    return dto;
  }

  private assertQuotable(input: { checkIn: IsoDate; checkOut: IsoDate }) {
    if (nightsBetween(input.checkIn, input.checkOut) > MAX_QUOTED_NIGHTS) {
      throw badRequest('That stay is too long', [{ path: ['checkOut'], message: 'Choose a shorter stay' }]);
    }
  }

  private async isUnavailable(db: DbOrTx, listingId: string, checkIn: IsoDate, checkOut: IsoDate, now: Date) {
    const [held, blocked] = await Promise.all([
      hasHeldOverlap(db, listingId, checkIn, checkOut, now),
      hasBlockedNight(db, listingId, checkIn, checkOut),
    ]);
    return held || blocked;
  }

  private async priceFor(listing: ListingRow, stay: { checkIn: IsoDate; checkOut: IsoDate }) {
    return quoteStay({
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      basePrice: listing.basePrice,
      cleaningFee: listing.cleaningFee,
      weeklyDiscountPct: listing.weeklyDiscountPct,
      priceOverrides: await priceOverridesFor(this.db, listing.id, stay.checkIn, stay.checkOut),
    });
  }

  /** Retries the create transaction when the random ref collides (bookings_ref_unique). */
  private async withRefRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (isExclusionViolation(err)) throw datesUnavailable('Those dates were just booked by someone else');
        if (attempt < REF_ATTEMPTS && isUniqueViolation(err, REF_UNIQUE_CONSTRAINT)) continue;
        throw err;
      }
    }
  }

  private async afterHoldsExpired(ids: string[]) {
    for (const id of ids) {
      await this.refunds.cancelPending(id);
      await this.emails.expired(id, 'hold');
    }
  }
}

function sortReasons(reasons: QuoteReason[]): QuoteReason[] {
  return [...new Set(reasons)].sort((a, b) => QUOTE_REASONS.indexOf(a) - QUOTE_REASONS.indexOf(b));
}
