import {
  DATE_HOLDING_STATUSES,
  nightsBetween,
  type Amenity,
  type IsoDate,
  type ListingSummaryDto,
  type PropertyType,
  type RoomType,
  type Satang,
  type SearchSort,
} from '@hongwang/shared';
import { sql, type SQL } from 'drizzle-orm';
import { badRequest } from '../../common/errors';
import type { Bbox } from './places';

/**
 * Raw SQL pieces for search and saved rooms (whiteboard: "Postgres, not Elasticsearch").
 * Everything user-supplied goes in as a bound parameter through Drizzle's `sql` template;
 * nothing is concatenated. The listing table is always aliased `l`.
 */

/** Fallback map position when a listing has no pin yet (owner previews of drafts). */
export const BANGKOK_CENTER = { lat: 13.7563, lng: 100.5018 } as const;

/** Columns a ListingSummaryDto needs, plus what quoteStay needs for `stayTotal`. */
export const SUMMARY_COLUMNS = sql`
  l.id,
  l.title,
  l.room_type AS "roomType",
  l.property_type AS "propertyType",
  l.area,
  l.subdistrict,
  l.district,
  l.nearest_station AS "nearestStation",
  l.station_walk_minutes AS "stationWalkMinutes",
  l.base_price AS "basePrice",
  l.cleaning_fee AS "cleaningFee",
  l.weekly_discount_pct AS "weeklyDiscountPct",
  l.rating_avg AS "ratingAvg",
  l.review_count AS "reviewCount",
  l.instant_book AS "instantBook",
  l.max_guests AS "maxGuests",
  ST_X(l.public_location) AS lng,
  ST_Y(l.public_location) AS lat,
  (SELECT p.url FROM listing_photos p WHERE p.listing_id = l.id ORDER BY p.position ASC, p.created_at ASC LIMIT 1) AS "coverPhotoUrl"`;

/** One row selected with SUMMARY_COLUMNS (node-postgres returns numeric as string). */
export type SummaryRow = {
  id: string;
  title: string;
  roomType: RoomType;
  propertyType: PropertyType;
  area: string;
  subdistrict: string | null;
  district: string | null;
  nearestStation: string | null;
  stationWalkMinutes: number | null;
  basePrice: number;
  cleaningFee: number;
  weeklyDiscountPct: number;
  ratingAvg: string | number | null;
  reviewCount: number;
  instantBook: boolean;
  maxGuests: number;
  lng: number | null;
  lat: number | null;
  coverPhotoUrl: string | null;
};

/** Guest-facing neighbourhood, falling back to the address parts. */
export const displayArea = (r: { area: string | null; subdistrict: string | null; district: string | null }) =>
  r.area?.trim() || r.subdistrict?.trim() || r.district?.trim() || 'Bangkok';

/** Rating to 2 dp, or null when there are no reviews yet. */
export function ratingOf(avg: string | number | null | undefined, count: number): number | null {
  if (!count || avg === null || avg === undefined) return null;
  const n = Number(avg);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function transitOf(station: string | null, walkMinutes: number | null): ListingSummaryDto['transit'] {
  return station && walkMinutes !== null && walkMinutes !== undefined ? { station, walkMinutes } : null;
}

export function summaryRowToDto(r: SummaryRow, stayTotal: Satang | null): ListingSummaryDto {
  return {
    id: r.id,
    title: r.title,
    roomType: r.roomType,
    propertyType: r.propertyType,
    area: displayArea(r),
    transit: transitOf(r.nearestStation, r.stationWalkMinutes),
    basePrice: Number(r.basePrice),
    stayTotal,
    rating: ratingOf(r.ratingAvg, Number(r.reviewCount)),
    reviewCount: Number(r.reviewCount),
    instantBook: r.instantBook,
    coverPhotoUrl: r.coverPhotoUrl,
    location:
      r.lat !== null && r.lng !== null ? { lat: Number(r.lat), lng: Number(r.lng) } : { ...BANGKOK_CENTER },
    maxGuests: Number(r.maxGuests),
  };
}

/** `IN (...)` list of bound parameters. */
const inList = (values: readonly string[]) => sql`(${sql.join(
  values.map((v) => sql`${v}`),
  sql`, `,
)})`;

export interface Stay {
  checkIn: IsoDate;
  checkOut: IsoDate;
  nights: number;
}

/** Longest stay search accepts (monthly stays use the same model). */
export const MAX_SEARCH_NIGHTS = 365;

/** Both dates -> Stay; either missing -> null; check-out not after check-in -> 400. */
export function resolveStay(checkIn: IsoDate | undefined, checkOut: IsoDate | undefined): Stay | null {
  if (!checkIn || !checkOut) return null;
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) {
    throw badRequest('Check-out must be after check-in', [{ path: ['checkOut'], message: 'Check-out must be after check-in' }]);
  }
  if (nights > MAX_SEARCH_NIGHTS) {
    throw badRequest(`Stays can be up to ${MAX_SEARCH_NIGHTS} nights`, [{ path: ['checkOut'], message: 'Stay is too long' }]);
  }
  return { checkIn, checkOut, nights };
}

/**
 * True when listing `l` can take the stay: length within min/max nights, outside advance notice,
 * inside the booking window, no date-holding booking overlapping [checkIn, checkOut) and no host
 * block on any of its nights. Mirrors GET /listings/:id/availability.
 */
export function stayAvailableSql(stay: Stay, today: IsoDate): SQL {
  return sql`(
    l.min_nights <= ${stay.nights}
    AND l.max_nights >= ${stay.nights}
    AND ${stay.checkIn}::date >= ${today}::date + l.advance_notice_days
    AND ${stay.checkOut}::date <= (${today}::date + make_interval(months => l.booking_window_months))::date
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.listing_id = l.id
        AND b.status IN ${inList(DATE_HOLDING_STATUSES)}
        AND b.stay && daterange(${stay.checkIn}::date, ${stay.checkOut}::date, '[)')
    )
    AND NOT EXISTS (
      SELECT 1 FROM listing_blocks lb
      WHERE lb.listing_id = l.id
        AND lb.date >= ${stay.checkIn}::date
        AND lb.date < ${stay.checkOut}::date
    )
  )`;
}

export interface SearchFilters {
  bbox: Bbox | null;
  guests?: number;
  minPrice?: number;
  maxPrice?: number;
  roomTypes?: RoomType[];
  amenities?: Amenity[];
  instantBook?: boolean;
  nearTransit?: boolean;
  petsAllowed?: boolean;
  stay: Stay | null;
  today: IsoDate;
}

/** Minutes on foot that count as "Near BTS/MRT". */
export const NEAR_TRANSIT_MINUTES = 10;

/** WHERE conditions for GET /search, ANDed together by the caller. */
export function buildSearchConditions(f: SearchFilters): SQL[] {
  const c: SQL[] = [sql`l.status = 'published'`, sql`l.deleted_at IS NULL`, sql`l.public_location IS NOT NULL`];
  if (f.bbox) {
    const { west, south, east, north } = f.bbox;
    c.push(sql`l.public_location && ST_MakeEnvelope(${west}::float8, ${south}::float8, ${east}::float8, ${north}::float8, 4326)`);
  }
  if (f.guests) c.push(sql`l.max_guests >= ${f.guests}`);
  if (f.minPrice !== undefined) c.push(sql`l.base_price >= ${f.minPrice}`);
  if (f.maxPrice !== undefined) c.push(sql`l.base_price <= ${f.maxPrice}`);
  if (f.roomTypes?.length) c.push(sql`l.room_type::text IN ${inList(f.roomTypes)}`);
  if (f.amenities?.length) {
    c.push(sql`l.amenities @> ARRAY[${sql.join(
      f.amenities.map((a) => sql`${a}`),
      sql`, `,
    )}]::text[]`);
  }
  if (f.instantBook) c.push(sql`l.instant_book = true`);
  if (f.nearTransit) c.push(sql`l.station_walk_minutes <= ${NEAR_TRANSIT_MINUTES}`);
  if (f.petsAllowed) c.push(sql`(l.house_rules->>'pets') = 'true'`);
  if (f.stay) c.push(stayAvailableSql(f.stay, f.today));
  return c;
}

export const whereSql = (conditions: SQL[]) => sql.join(conditions, sql` AND `);

/** ORDER BY for each sort; `l.id` last so pages are stable. */
export function searchOrderBy(sort: SearchSort): SQL {
  switch (sort) {
    case 'price_asc':
      return sql`l.base_price ASC, l.id ASC`;
    case 'nearest_transit':
      return sql`l.station_walk_minutes ASC NULLS LAST, l.base_price ASC, l.id ASC`;
    case 'top_rated':
      return sql`l.rating_avg DESC NULLS LAST, l.review_count DESC, l.id ASC`;
    case 'recommended':
    default:
      return sql`(COALESCE(l.rating_avg, 0)::float8 * ln((l.review_count + 2)::float8)) DESC, l.published_at DESC NULLS LAST, l.id ASC`;
  }
}

export function buildSearchQuery(conditions: SQL[], orderBy: SQL, limit: number, offset: number): SQL {
  return sql`SELECT ${SUMMARY_COLUMNS} FROM listings l WHERE ${whereSql(conditions)} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`;
}

export function buildCountQuery(conditions: SQL[]): SQL {
  return sql`SELECT count(*)::int AS total FROM listings l WHERE ${whereSql(conditions)}`;
}
