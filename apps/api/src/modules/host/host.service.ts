import {
  addDays,
  DATE_HOLDING_STATUSES,
  ERROR_CODES,
  todayInBangkok,
  type BookingDto,
  type HostCalendarDto,
  type HostCalendarQuery,
  type HostDashboardDto,
  type HostIdentityInput,
  type HostOnboardingDto,
  type HostOnboardingInput,
  type HostReservationsQuery,
  type IsoDate,
  type SetBlocksInput,
  type SetPricesInput,
} from '@hongwang/shared';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, sql, type SQL } from 'drizzle-orm';
import { AbilityFactory, assertCan } from '../../authz/ability';
import type { AuthUser } from '../../common/auth';
import { AppException, badRequest, notFound } from '../../common/errors';
import { ENV, type Env } from '../../config/env';
import { InjectDb, type Database } from '../../database/database.module';
import { bookings, listingBlocks, listingPriceOverrides, listings, users } from '../../database/schema';
import { BookingReadService } from '../bookings/booking-read.service';
import { buildDashboard, DASHBOARD_STATUSES, monthStart, nextKycStatus, TIMELINE_DAYS, toOnboardingDto } from './dashboard';
import {
  buildCalendarDays,
  CALENDAR_STATUSES,
  monthDates,
  monthOf,
  nightsHeldByBookings,
  shortName,
  uniqueSorted,
} from './day-states';

type CalendarListing = HostCalendarDto['listing'] & { hostId: string; status: string };

/**
 * Owner: Host Dashboard module. Everything here is scoped to listings the caller owns:
 * booking queries filter on bookings.host_id, listing-specific calls load the listing and
 * assertCan(ability, 'update', 'Listing', row).
 */
@Injectable()
export class HostService {
  constructor(
    @InjectDb() private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly abilities: AbilityFactory,
    private readonly bookingRead: BookingReadService,
  ) {}

  // ---------------------------------------------------------------- dashboard (C2)

  async dashboard(user: AuthUser, now = new Date()): Promise<HostDashboardDto> {
    const today = todayInBangkok(now);
    const timelineEnd = addDays(today, TIMELINE_DAYS);

    const [me] = await this.db.select({ firstName: users.firstName }).from(users).where(eq(users.id, user.id)).limit(1);
    if (!me) throw notFound('User');

    const [listingRows, blockRows, bookingDtos] = await Promise.all([
      this.db
        .select({ id: listings.id, title: listings.title })
        .from(listings)
        .where(and(eq(listings.hostId, user.id), isNull(listings.deletedAt)))
        .orderBy(asc(listings.createdAt)),
      this.db
        .select({ listingId: listingBlocks.listingId, date: listingBlocks.date })
        .from(listingBlocks)
        .innerJoin(listings, eq(listings.id, listingBlocks.listingId))
        .where(and(eq(listings.hostId, user.id), gte(listingBlocks.date, today), lt(listingBlocks.date, timelineEnd))),
      this.bookingRead.findDtos(
        and(
          eq(bookings.hostId, user.id),
          inArray(bookings.status, [...DASHBOARD_STATUSES]),
          gte(bookings.checkOut, monthStart(today)),
        ),
        user,
        { orderBy: asc(bookings.checkIn) },
      ),
    ]);

    return buildDashboard({
      now,
      greetingName: me.firstName,
      listings: listingRows.map((l) => ({ id: l.id, title: l.title || 'Untitled listing' })),
      blocks: blockRows,
      bookings: bookingDtos,
    });
  }

  // ---------------------------------------------------------------- reservations

  async reservations(user: AuthUser, q: HostReservationsQuery): Promise<BookingDto[]> {
    const today = todayInBangkok();
    const where: (SQL | undefined)[] = [eq(bookings.hostId, user.id)];
    if (q.listingId) where.push(eq(bookings.listingId, q.listingId));
    let orderBy: SQL[] = [asc(bookings.checkIn), asc(bookings.createdAt)];
    switch (q.status) {
      case 'upcoming':
        where.push(inArray(bookings.status, ['requested', 'payment_hold', 'confirmed']), gte(bookings.checkOut, today));
        break;
      case 'all':
        orderBy = [desc(bookings.checkIn), desc(bookings.createdAt)];
        break;
      case 'completed':
      case 'cancelled':
        where.push(eq(bookings.status, q.status));
        orderBy = [desc(bookings.checkIn), desc(bookings.createdAt)];
        break;
      default:
        where.push(eq(bookings.status, q.status));
    }
    return this.bookingRead.findDtos(and(...where), user, { orderBy });
  }

  // ---------------------------------------------------------------- calendar (C5)

  async calendar(user: AuthUser, q: HostCalendarQuery): Promise<HostCalendarDto> {
    const listing = await this.loadOwnListing(user, q.listingId);
    return this.buildMonth(listing, q.month);
  }

  async setBlocks(user: AuthUser, listingId: string, input: SetBlocksInput): Promise<HostCalendarDto> {
    const listing = await this.loadOwnListing(user, listingId);
    const dates = this.futureDates(input.dates);

    if (input.blocked) {
      await this.db.transaction(async (tx) => {
        // Serialise with other writers of this listing's calendar.
        await tx.select({ id: listings.id }).from(listings).where(eq(listings.id, listing.id)).for('update');
        const held = await tx
          .select({ status: bookings.status, checkIn: bookings.checkIn, checkOut: bookings.checkOut })
          .from(bookings)
          .where(
            and(
              eq(bookings.listingId, listing.id),
              inArray(bookings.status, [...DATE_HOLDING_STATUSES]),
              lt(bookings.checkIn, addDays(dates.at(-1)!, 1)),
              gt(bookings.checkOut, dates[0]!),
            ),
          );
        const conflicts = nightsHeldByBookings(dates, held);
        if (conflicts.length) {
          throw new AppException(
            409,
            ERROR_CODES.datesUnavailable,
            conflicts.length === 1 ? 'That night is already booked' : 'Some of those nights are already booked',
            { dates: conflicts },
          );
        }
        await tx
          .insert(listingBlocks)
          .values(dates.map((date) => ({ listingId: listing.id, date })))
          .onConflictDoNothing();
      });
    } else {
      await this.db
        .delete(listingBlocks)
        .where(and(eq(listingBlocks.listingId, listing.id), inArray(listingBlocks.date, dates)));
    }
    return this.buildMonth(listing, monthOf(dates[0]!));
  }

  async setPrices(user: AuthUser, listingId: string, input: SetPricesInput): Promise<HostCalendarDto> {
    const listing = await this.loadOwnListing(user, listingId);
    const dates = this.futureDates(input.dates);

    // Setting the base price again is the same as resetting: no special price row.
    if (input.price === null || input.price === listing.basePrice) {
      await this.db
        .delete(listingPriceOverrides)
        .where(and(eq(listingPriceOverrides.listingId, listing.id), inArray(listingPriceOverrides.date, dates)));
    } else {
      await this.db
        .insert(listingPriceOverrides)
        .values(dates.map((date) => ({ listingId: listing.id, date, price: input.price! })))
        .onConflictDoUpdate({
          target: [listingPriceOverrides.listingId, listingPriceOverrides.date],
          set: { price: sql`excluded.price` },
        });
    }
    return this.buildMonth(listing, monthOf(dates[0]!));
  }

  private futureDates(input: readonly IsoDate[]): IsoDate[] {
    const dates = uniqueSorted(input);
    if (dates[0]! < todayInBangkok()) throw badRequest('Past dates can’t be changed');
    return dates;
  }

  private async loadOwnListing(user: AuthUser, listingId: string): Promise<CalendarListing> {
    const [row] = await this.db
      .select({
        id: listings.id,
        hostId: listings.hostId,
        status: listings.status,
        title: listings.title,
        basePrice: listings.basePrice,
        cleaningFee: listings.cleaningFee,
        minNights: listings.minNights,
        instantBook: listings.instantBook,
      })
      .from(listings)
      .where(and(eq(listings.id, listingId), isNull(listings.deletedAt)))
      .limit(1);
    if (!row) throw notFound('Listing');
    assertCan(this.abilities.for(user), 'update', 'Listing', row);
    return row;
  }

  private async buildMonth(listing: CalendarListing, month: string): Promise<HostCalendarDto> {
    const dates = monthDates(month);
    const start = dates[0]!;
    const end = addDays(dates.at(-1)!, 1);

    const [stays, blocks, overrides] = await Promise.all([
      this.db
        .select({
          id: bookings.id,
          status: bookings.status,
          checkIn: bookings.checkIn,
          checkOut: bookings.checkOut,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(bookings)
        .innerJoin(users, eq(users.id, bookings.guestId))
        .where(
          and(
            eq(bookings.listingId, listing.id),
            inArray(bookings.status, [...CALENDAR_STATUSES]),
            lt(bookings.checkIn, end),
            gt(bookings.checkOut, start),
          ),
        ),
      this.db
        .select({ date: listingBlocks.date })
        .from(listingBlocks)
        .where(and(eq(listingBlocks.listingId, listing.id), gte(listingBlocks.date, start), lt(listingBlocks.date, end))),
      this.db
        .select({ date: listingPriceOverrides.date, price: listingPriceOverrides.price })
        .from(listingPriceOverrides)
        .where(
          and(
            eq(listingPriceOverrides.listingId, listing.id),
            gte(listingPriceOverrides.date, start),
            lt(listingPriceOverrides.date, end),
          ),
        ),
    ]);

    return {
      listing: {
        id: listing.id,
        title: listing.title,
        basePrice: listing.basePrice,
        cleaningFee: listing.cleaningFee,
        minNights: listing.minNights,
        instantBook: listing.instantBook,
      },
      month,
      days: buildCalendarDays({
        month,
        today: todayInBangkok(),
        basePrice: listing.basePrice,
        overrides: Object.fromEntries(overrides.map((o) => [o.date, o.price])),
        blocked: blocks.map((b) => b.date),
        stays: stays.map((s) => ({ ...s, guestName: shortName(s.firstName, s.lastName) })),
      }),
    };
  }

  // ---------------------------------------------------------------- onboarding (C1)

  async onboarding(user: AuthUser): Promise<HostOnboardingDto> {
    return toOnboardingDto(await this.loadHostRow(user.id));
  }

  async saveOnboarding(user: AuthUser, input: HostOnboardingInput): Promise<HostOnboardingDto> {
    const row = await this.loadHostRow(user.id);
    const hostProfile = {
      ...row.hostProfile,
      relation: input.relation,
      roomCount: input.roomCount,
      onboardedAt: row.hostProfile?.onboardedAt ?? new Date().toISOString(),
    };
    const [updated] = await this.db
      .update(users)
      .set({ hostProfile })
      .where(eq(users.id, user.id))
      .returning({ hostProfile: users.hostProfile, kycStatus: users.kycStatus, stripeAccountId: users.stripeAccountId });
    return toOnboardingDto(updated!);
  }

  /** Phase 1: records that the ID step was done. Documents and the trust-team review come with the admin module. */
  async submitIdentity(user: AuthUser, _input: HostIdentityInput): Promise<HostOnboardingDto> {
    const row = await this.loadHostRow(user.id);
    const kycStatus = nextKycStatus(row.kycStatus, this.env.AUTO_APPROVE_LISTINGS);
    if (kycStatus === row.kycStatus) return toOnboardingDto(row);
    const [updated] = await this.db
      .update(users)
      .set({ kycStatus })
      .where(eq(users.id, user.id))
      .returning({ hostProfile: users.hostProfile, kycStatus: users.kycStatus, stripeAccountId: users.stripeAccountId });
    return toOnboardingDto(updated!);
  }

  private async loadHostRow(userId: string) {
    const [row] = await this.db
      .select({ hostProfile: users.hostProfile, kycStatus: users.kycStatus, stripeAccountId: users.stripeAccountId })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);
    if (!row) throw notFound('User');
    return row;
  }
}
