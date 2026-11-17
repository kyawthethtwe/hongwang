import {
  DATE_HOLDING_STATUSES,
  ERROR_CODES,
  todayInBangkok,
  type AvailabilityDto,
  type AvailabilityQuery,
  type CreateListingInput,
  type HostListingDto,
  type HostListingSummaryDto,
  type ListingDetailDto,
  type UpdateListingInput,
} from '@hongwang/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { AbilityFactory, assertCan, sub } from '../../authz/ability';
import type { AuthUser } from '../../common/auth';
import { AppException, badRequest, notFound } from '../../common/errors';
import { ENV, type Env } from '../../config/env';
import { InjectDb, type Database, type DbOrTx } from '../../database/database.module';
import { bookings, listingBlocks, listingPhotos, listingPriceOverrides, listings, users } from '../../database/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { availabilityRangeError, computeAvailability } from './availability';
import { listingCompleteness, missingSections } from './completeness';
import {
  EMPTY_STATS,
  shortGuestName,
  toHostListing,
  toHostListingSummary,
  toListingDetail,
  type HostListingStats,
  type ListingRow,
} from './listing.mappers';
import { buildListingPatch } from './listing-patch';

const invalidTransition = (message: string) => new AppException(409, ERROR_CODES.invalidTransition, message);

/**
 * Owner: Listings & Search module. Public listing page + availability, and the host's listing
 * CRUD (design C3/C4). Authorization is CASL ownership: `update` on the Listing row.
 */
@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly abilities: AbilityFactory,
    private readonly notifications: NotificationsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ---------------------------------------------------------------- public

  /** Published listings for everyone; drafts etc. only for the owner and admins (else 404). */
  async detail(id: string, viewer: AuthUser | undefined): Promise<ListingDetailDto> {
    const row = await this.db.query.listings.findFirst({
      where: and(eq(listings.id, id), isNull(listings.deletedAt)),
      with: { photos: true, host: true },
    });
    if (!row || !this.abilities.for(viewer).can('read', sub('Listing', row))) throw notFound('Listing');
    return toListingDetail(row, row.photos, row.host);
  }

  async availability(id: string, q: AvailabilityQuery, viewer: AuthUser | undefined, now = new Date()): Promise<AvailabilityDto> {
    const rangeError = availabilityRangeError(q.from, q.to);
    if (rangeError) throw badRequest(rangeError, [{ path: ['to'], message: rangeError }]);
    const row = await this.db.query.listings.findFirst({
      where: and(eq(listings.id, id), isNull(listings.deletedAt)),
      columns: {
        id: true,
        hostId: true,
        status: true,
        basePrice: true,
        minNights: true,
        maxNights: true,
        advanceNoticeDays: true,
        bookingWindowMonths: true,
      },
    });
    if (!row || !this.abilities.for(viewer).can('read', sub('Listing', row))) throw notFound('Listing');

    const [held, blocks, overrides] = await Promise.all([
      this.db
        .select({ checkIn: bookings.checkIn, checkOut: bookings.checkOut })
        .from(bookings)
        .where(
          and(
            eq(bookings.listingId, id),
            inArray(bookings.status, [...DATE_HOLDING_STATUSES]),
            sql`${bookings.stay} && daterange(${q.from}::date, ${q.to}::date, '[)')`,
          ),
        ),
      this.db
        .select({ date: listingBlocks.date })
        .from(listingBlocks)
        .where(and(eq(listingBlocks.listingId, id), gte(listingBlocks.date, q.from), lt(listingBlocks.date, q.to))),
      this.db
        .select({ date: listingPriceOverrides.date, price: listingPriceOverrides.price })
        .from(listingPriceOverrides)
        .where(
          and(
            eq(listingPriceOverrides.listingId, id),
            gte(listingPriceOverrides.date, q.from),
            lt(listingPriceOverrides.date, q.to),
          ),
        ),
    ]);

    const { unavailable, prices } = computeAvailability({
      from: q.from,
      to: q.to,
      today: todayInBangkok(now),
      advanceNoticeDays: row.advanceNoticeDays,
      bookingWindowMonths: row.bookingWindowMonths,
      basePrice: row.basePrice,
      bookings: held,
      blocks: blocks.map((b) => b.date),
      overrides: Object.fromEntries(overrides.map((o) => [o.date, o.price])),
    });
    return { unavailable, prices, minNights: row.minNights, maxNights: row.maxNights };
  }

  // ---------------------------------------------------------------- host

  async mine(user: AuthUser, now = new Date()): Promise<HostListingSummaryDto[]> {
    const rows = await this.db.query.listings.findMany({
      where: and(eq(listings.hostId, user.id), isNull(listings.deletedAt)),
      orderBy: [desc(listings.updatedAt)],
      with: { photos: true },
    });
    if (rows.length === 0) return [];
    const stats = await this.hostStats(user.id, todayInBangkok(now));
    return rows.map((r) => toHostListingSummary(r, r.photos, stats.get(r.id) ?? EMPTY_STATS));
  }

  async create(user: AuthUser, input: CreateListingInput): Promise<HostListingDto> {
    assertCan(this.abilities.for(user), 'create', 'Listing');
    const [row] = await this.db
      .insert(listings)
      .values({
        hostId: user.id,
        status: 'draft',
        title: input.title ?? '',
        roomType: input.roomType ?? 'entire_place',
      })
      .returning();
    return toHostListing(row!, []);
  }

  async getForEdit(id: string, user: AuthUser): Promise<HostListingDto> {
    const row = await this.loadEditable(id, user);
    return toHostListing(row, await this.photosOf(id));
  }

  async update(id: string, user: AuthUser, input: UpdateListingInput): Promise<HostListingDto> {
    const row = await this.loadEditable(id, user);
    const patch = buildListingPatch(row, input);
    let updated = row;
    if (Object.keys(patch).length > 0) {
      const [r] = await this.db.update(listings).set(patch).where(eq(listings.id, id)).returning();
      updated = r!;
    }
    return toHostListing(updated, await this.photosOf(id));
  }

  /**
   * draft / rejected -> in_review, or straight to published when AUTO_APPROVE_LISTINGS is on.
   * A listing still in review is published by a repeat submit once auto-approve is on.
   */
  async submit(id: string, user: AuthUser): Promise<HostListingDto> {
    const row = await this.loadEditable(id, user);
    const photos = await this.photosOf(id);
    const autoApprove = this.env.AUTO_APPROVE_LISTINGS;
    if (row.status === 'in_review' && !autoApprove) return toHostListing(row, photos);
    if (row.status === 'published' || row.status === 'paused') {
      throw invalidTransition('This listing is already live');
    }
    const missing = missingSections(listingCompleteness(row, photos.length));
    if (missing.length > 0) {
      throw badRequest('Finish every section before submitting', { missing });
    }
    const now = new Date();
    const [updated] = await this.db
      .update(listings)
      .set(
        autoApprove
          ? { status: 'published', submittedAt: now, publishedAt: row.publishedAt ?? now, reviewNote: null }
          : { status: 'in_review', submittedAt: now },
      )
      .where(and(eq(listings.id, id), inArray(listings.status, ['draft', 'rejected', 'in_review'])))
      .returning();
    if (!updated) throw invalidTransition('This listing changed while you were submitting it. Reload and try again.');
    if (updated.status === 'published') await this.sendPublishedEmail(updated);
    return toHostListing(updated, photos);
  }

  pause(id: string, user: AuthUser) {
    return this.transition(id, user, 'published', 'paused', 'Only a live listing can be paused');
  }

  unpause(id: string, user: AuthUser) {
    return this.transition(id, user, 'paused', 'published', 'Only a paused listing can be turned back on');
  }

  /** Drafts only, soft delete (published listings are paused instead: they have booking history). */
  async remove(id: string, user: AuthUser): Promise<void> {
    const row = await this.loadEditable(id, user);
    if (row.status !== 'draft') throw invalidTransition('Only drafts can be deleted. Pause the listing instead.');
    await this.db
      .update(listings)
      .set({ deletedAt: new Date() })
      .where(and(eq(listings.id, id), eq(listings.status, 'draft')));
  }

  // ---------------------------------------------------------------- helpers

  /** Loads a non-deleted listing and checks CASL `update` (owner or admin). 404 / 403. */
  async loadEditable(id: string, user: AuthUser, db: DbOrTx = this.db): Promise<ListingRow> {
    const [row] = await db
      .select()
      .from(listings)
      .where(and(eq(listings.id, id), isNull(listings.deletedAt)))
      .limit(1);
    if (!row) throw notFound('Listing');
    assertCan(this.abilities.for(user), 'update', 'Listing', row, 'Only the host can change this listing');
    return row;
  }

  private photosOf(id: string, db: DbOrTx = this.db) {
    return db
      .select()
      .from(listingPhotos)
      .where(eq(listingPhotos.listingId, id))
      .orderBy(asc(listingPhotos.position), asc(listingPhotos.createdAt));
  }

  private async transition(
    id: string,
    user: AuthUser,
    from: 'published' | 'paused',
    to: 'published' | 'paused',
    message: string,
  ): Promise<HostListingDto> {
    const row = await this.loadEditable(id, user);
    if (row.status !== from) throw invalidTransition(message);
    const [updated] = await this.db
      .update(listings)
      .set({ status: to })
      .where(and(eq(listings.id, id), eq(listings.status, from)))
      .returning();
    if (!updated) throw invalidTransition(message);
    return toHostListing(updated, await this.photosOf(id));
  }

  private async hostStats(hostId: string, today: string): Promise<Map<string, HostListingStats>> {
    const [counts, next] = await Promise.all([
      this.db.execute<{ listingId: string; upcoming: number; pending: number }>(sql`
        SELECT b.listing_id AS "listingId",
          (count(*) FILTER (WHERE b.status IN ('payment_hold', 'confirmed') AND b.check_in >= ${today}::date))::int AS upcoming,
          (count(*) FILTER (WHERE b.status = 'requested'))::int AS pending
        FROM bookings b
        WHERE b.host_id = ${hostId}
        GROUP BY b.listing_id`),
      this.db.execute<{ listingId: string; checkIn: string; firstName: string; lastName: string | null }>(sql`
        SELECT DISTINCT ON (b.listing_id)
          b.listing_id AS "listingId", b.check_in::text AS "checkIn",
          u.first_name AS "firstName", u.last_name AS "lastName"
        FROM bookings b
        JOIN users u ON u.id = b.guest_id
        WHERE b.host_id = ${hostId}
          AND b.status IN ('payment_hold', 'confirmed')
          AND b.check_in >= ${today}::date
        ORDER BY b.listing_id, b.check_in ASC`),
    ]);
    const out = new Map<string, HostListingStats>();
    for (const c of counts.rows) {
      out.set(c.listingId, { upcomingBookings: Number(c.upcoming), pendingRequests: Number(c.pending), nextGuest: null });
    }
    for (const n of next.rows) {
      const s = out.get(n.listingId) ?? { ...EMPTY_STATS };
      s.nextGuest = { name: shortGuestName(n.firstName, n.lastName), checkIn: n.checkIn };
      out.set(n.listingId, s);
    }
    return out;
  }

  private async sendPublishedEmail(l: ListingRow) {
    try {
      const [host] = await this.db
        .select({ email: users.email, firstName: users.firstName })
        .from(users)
        .where(eq(users.id, l.hostId))
        .limit(1);
      if (!host?.email) return;
      await this.notifications.sendEmail({
        template: 'listing-published-host',
        to: host.email,
        userId: l.hostId,
        data: {
          firstName: host.firstName,
          listingTitle: l.title,
          listingUrl: `${this.env.WEB_ORIGIN.replace(/\/$/, '')}/rooms/${l.id}`,
        },
      });
    } catch (err) {
      // The listing is live either way; a queue hiccup shouldn't fail the submit.
      this.logger.warn(`Could not queue listing-published-host for ${l.id}: ${(err as Error).message}`);
    }
  }
}
