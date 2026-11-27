import type {
  HostListingDto,
  HostListingSummaryDto,
  IsoDate,
  ListingDetailDto,
  ListingPhotoDto,
  ListingSummaryDto,
  Satang,
} from '@hongwang/shared';
import { iso, toLatLng, toPublicUser } from '../../common/mappers';
import type { listingPhotos, listings, users } from '../../database/schema';
import { BANGKOK_CENTER, displayArea, ratingOf, transitOf } from '../search/search-sql';
import { isComplete, listingCompleteness, missingSections } from './completeness';

export type ListingRow = typeof listings.$inferSelect;
export type PhotoRow = typeof listingPhotos.$inferSelect;
export type UserRow = typeof users.$inferSelect;

export function toPhotoDto(p: PhotoRow): ListingPhotoDto {
  return { id: p.id, url: p.url, caption: p.caption, position: p.position, width: p.width, height: p.height };
}

/** Photos by position (cover first). */
export const sortPhotos = <T extends Pick<PhotoRow, 'position' | 'createdAt'>>(photos: T[]) =>
  [...photos].sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime());

/** Card shape from a Drizzle row. Uses the public pin, never the exact location. */
export function toListingSummary(l: ListingRow, coverPhotoUrl: string | null, stayTotal: Satang | null = null): ListingSummaryDto {
  return {
    id: l.id,
    title: l.title,
    roomType: l.roomType,
    propertyType: l.propertyType,
    area: displayArea(l),
    transit: transitOf(l.nearestStation, l.stationWalkMinutes),
    basePrice: l.basePrice,
    stayTotal,
    rating: ratingOf(l.ratingAvg, l.reviewCount),
    reviewCount: l.reviewCount,
    instantBook: l.instantBook,
    coverPhotoUrl,
    location: toLatLng(l.publicLocation) ?? { ...BANGKOK_CENTER },
    maxGuests: l.maxGuests,
  };
}

type DetailBase = Omit<ListingDetailDto, 'host'>;

function toDetailBase(l: ListingRow, photos: PhotoRow[]): DetailBase {
  const sorted = sortPhotos(photos);
  return {
    ...toListingSummary(l, sorted[0]?.url ?? null),
    description: l.description,
    status: l.status,
    sizeSqm: l.sizeSqm,
    bedrooms: l.bedrooms,
    beds: l.beds,
    bathrooms: Number(l.bathrooms),
    floor: l.floor,
    amenities: l.amenities ?? [],
    photos: sorted.map(toPhotoDto),
    cleaningFee: l.cleaningFee,
    weeklyDiscountPct: l.weeklyDiscountPct,
    minNights: l.minNights,
    maxNights: l.maxNights,
    advanceNoticeDays: l.advanceNoticeDays,
    bookingWindowMonths: l.bookingWindowMonths,
    checkInFrom: l.checkInFrom,
    checkOutBy: l.checkOutBy,
    cancellationPolicy: l.cancellationPolicy,
    houseRules: l.houseRules ?? { smoking: false, pets: false, events: false, notes: null },
    subdistrict: l.subdistrict,
    district: l.district,
    province: l.province,
  };
}

/**
 * Public listing page. No address line, postcode, exact location or contact details.
 * `hostingSince` is when the host joined (there's no separate "became a host" date yet).
 */
export function toListingDetail(l: ListingRow, photos: PhotoRow[], host: UserRow): ListingDetailDto {
  return {
    ...toDetailBase(l, photos),
    host: { ...toPublicUser(host), hostingSince: host.createdAt.toISOString() },
  };
}

/** Editor view for the owner (or an admin): everything, plus completeness. */
export function toHostListing(l: ListingRow, photos: PhotoRow[]): HostListingDto {
  const completeness = listingCompleteness(l, photos.length);
  return {
    ...toDetailBase(l, photos),
    hostId: l.hostId,
    storedArea: l.area,
    addressLine: l.addressLine,
    postcode: l.postcode,
    exactLocation: toLatLng(l.location),
    nearestStation: l.nearestStation,
    stationWalkMinutes: l.stationWalkMinutes,
    completeness,
    canSubmit: isComplete(completeness) && (l.status === 'draft' || l.status === 'rejected'),
    reviewNote: l.reviewNote,
    updatedAt: l.updatedAt.toISOString(),
    publishedAt: iso(l.publishedAt),
    submittedAt: iso(l.submittedAt),
  };
}

export interface HostListingStats {
  upcomingBookings: number;
  pendingRequests: number;
  nextGuest: { name: string; checkIn: IsoDate } | null;
}

export const EMPTY_STATS: HostListingStats = { upcomingBookings: 0, pendingRequests: 0, nextGuest: null };

export function toHostListingSummary(l: ListingRow, photos: PhotoRow[], stats: HostListingStats): HostListingSummaryDto {
  const sorted = sortPhotos(photos);
  return {
    id: l.id,
    title: l.title,
    status: l.status,
    coverPhotoUrl: sorted[0]?.url ?? null,
    area: displayArea(l),
    basePrice: l.basePrice,
    instantBook: l.instantBook,
    rating: ratingOf(l.ratingAvg, l.reviewCount),
    reviewCount: l.reviewCount,
    upcomingBookings: stats.upcomingBookings,
    updatedAt: l.updatedAt.toISOString(),
    reviewNote: l.reviewNote,
    pendingRequests: stats.pendingRequests,
    nextGuest: stats.nextGuest,
    submittedAt: iso(l.submittedAt),
    missingSections: missingSections(listingCompleteness(l, photos.length)),
    photoCount: photos.length,
  };
}

/** "Daniel M." from first/last name. */
export const shortGuestName = (firstName: string, lastName: string | null) =>
  [firstName, lastName ? `${lastName[0]!.toUpperCase()}.` : ''].filter(Boolean).join(' ');
