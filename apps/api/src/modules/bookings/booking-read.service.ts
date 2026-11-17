import { freeCancellationUntil, type BookingDto } from '@hongwang/shared';
import { Injectable } from '@nestjs/common';
import { eq, type BuildQueryResult, type ExtractTablesWithRelations, type SQL } from 'drizzle-orm';
import type { AuthUser } from '../../common/auth';
import { iso, toLatLng, toPublicUser } from '../../common/mappers';
import { InjectDb, type Database, type DbOrTx } from '../../database/database.module';
import * as schema from '../../database/schema';
import { bookings } from '../../database/schema';

const UNLOCKED_STATUSES = new Set(['confirmed', 'completed']);

type FindOpts = {
  orderBy?: SQL | SQL[];
  limit?: number;
  tx?: DbOrTx;
};

/**
 * Owner: Bookings & Payments module. Shared read model: turns booking rows into BookingDto.
 * The Host module depends on this, so keep `findDtos` / `findDto` signatures stable.
 * Callers do the authorization (CASL) before returning DTOs.
 */
@Injectable()
export class BookingReadService {
  constructor(@InjectDb() private readonly db: Database) {}

  async findDtos(where: SQL | undefined, viewer: AuthUser, opts: FindOpts = {}): Promise<BookingDto[]> {
    const db = opts.tx ?? this.db;
    const rows = await db.query.bookings.findMany({
      where,
      orderBy: opts.orderBy ? (Array.isArray(opts.orderBy) ? opts.orderBy : [opts.orderBy]) : undefined,
      limit: opts.limit,
      with: {
        listing: {
          with: { photos: { orderBy: (p, { asc }) => [asc(p.position)], limit: 1 } },
        },
        guest: true,
        host: true,
        payments: { orderBy: (p, { desc }) => [desc(p.createdAt)], limit: 1 },
      },
    });
    return rows.map((r) => this.toDto(r, viewer));
  }

  async findDto(id: string, viewer: AuthUser, tx?: DbOrTx): Promise<BookingDto | null> {
    const [dto] = await this.findDtos(eq(bookings.id, id), viewer, { limit: 1, tx });
    return dto ?? null;
  }

  private toDto(r: BookingRowWithRelations, viewer: AuthUser): BookingDto {
    const viewerRole = viewer.id === r.guestId ? 'guest' : viewer.id === r.hostId ? 'host' : 'admin';
    const l = r.listing;
    const unlocked = UNLOCKED_STATUSES.has(r.status)
      ? {
          address: [l.addressLine, l.subdistrict, l.district, l.province, l.postcode].filter(Boolean).join(', '),
          location: toLatLng(l.location),
          hostPhone: viewerRole !== 'host' ? r.host.phone : null,
          guestPhone: viewerRole !== 'guest' ? r.guest.phone : null,
          checkInFrom: l.checkInFrom,
          checkOutBy: l.checkOutBy,
        }
      : null;
    const pay = r.payments[0];
    return {
      id: r.id,
      ref: r.ref,
      status: r.status,
      viewerRole,
      listing: {
        id: l.id,
        title: l.title,
        coverPhotoUrl: l.photos[0]?.url ?? null,
        area: l.area,
        roomType: l.roomType,
        rating: l.ratingAvg ?? null,
        reviewCount: l.reviewCount,
      },
      guest: toPublicUser(r.guest),
      host: toPublicUser(r.host),
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      nights: r.nights,
      guests: r.guests,
      pricing: {
        nightly: r.nightlyPrices,
        nightsSubtotal: r.nightsSubtotal,
        weeklyDiscount: r.weeklyDiscount,
        nightsTotal: r.nightsTotal,
        cleaningFee: r.cleaningFee,
        serviceFee: r.serviceFee,
        total: r.total,
        hostFee: r.hostFee,
        hostPayout: r.hostPayout,
        currency: 'THB',
      },
      cancellationPolicy: r.cancellationPolicy,
      freeCancellationUntil: freeCancellationUntil(r.cancellationPolicy, r.checkIn),
      instant: r.instant,
      message: r.message,
      holdExpiresAt: iso(r.holdExpiresAt),
      requestExpiresAt: iso(r.requestExpiresAt),
      confirmedAt: iso(r.confirmedAt),
      cancelledAt: iso(r.cancelledAt),
      cancelledBy: r.cancelledBy,
      cancelReason: viewerRole === 'admin' || r.cancelledBy === viewerRole ? r.cancelReason : null,
      refundAmount: r.refundAmount,
      hostPenalty: viewerRole === 'guest' ? null : r.hostPenalty,
      createdAt: r.createdAt.toISOString(),
      unlocked,
      payment: pay
        ? { status: pay.status, method: pay.method, last4: pay.last4, paidAt: iso(pay.paidAt) }
        : null,
    };
  }
}

type Schema = ExtractTablesWithRelations<typeof schema>;
type BookingRowWithRelations = BuildQueryResult<
  Schema,
  Schema['bookings'],
  { with: { listing: { with: { photos: true } }; guest: true; host: true; payments: true } }
>;
