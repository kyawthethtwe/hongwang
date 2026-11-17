import { todayInBangkok, type ParsedSearchQuery, type PlaceDto, type SearchResultDto } from '@hongwang/shared';
import { Injectable } from '@nestjs/common';
import { badRequest } from '../../common/errors';
import { InjectDb, type Database } from '../../database/database.module';
import { decodeCursor, encodeCursor } from './cursor';
import { findPlace, parseBbox, searchPlaces } from './places';
import {
  buildCountQuery,
  buildSearchConditions,
  buildSearchQuery,
  resolveStay,
  searchOrderBy,
  summaryRowToDto,
  type SummaryRow,
} from './search-sql';
import { loadStayTotals } from './stay-totals';

/**
 * Owner: Listings & Search module. Map + date search on Postgres: PostGIS `&&` against the map box
 * (GiST index on public_location), NOT EXISTS over date-holding bookings and host blocks.
 */
@Injectable()
export class SearchService {
  constructor(@InjectDb() private readonly db: Database) {}

  async search(q: ParsedSearchQuery, now = new Date()): Promise<SearchResultDto> {
    const today = todayInBangkok(now);
    const place = findPlace(q.place);
    const stay = resolveStay(q.checkIn, q.checkOut);
    const offset = decodeCursor(q.cursor);
    if (offset === null) throw badRequest('That page link has expired. Search again.');
    if (q.minPrice !== undefined && q.maxPrice !== undefined && q.minPrice > q.maxPrice) {
      throw badRequest('Minimum price is above the maximum', [{ path: ['minPrice'], message: 'Must be at most the maximum' }]);
    }
    // The map box wins over the place's own box (the guest moved the map).
    const bbox = parseBbox(q.bbox) ?? (place ? parseBbox(place.bbox) : null);
    if (q.bbox && !parseBbox(q.bbox)) throw badRequest('Invalid map area', [{ path: ['bbox'], message: 'Invalid bbox' }]);

    const conditions = buildSearchConditions({
      bbox,
      guests: q.guests,
      minPrice: q.minPrice,
      maxPrice: q.maxPrice,
      roomTypes: q.roomTypes,
      amenities: q.amenities,
      instantBook: q.instantBook,
      nearTransit: q.nearTransit,
      petsAllowed: q.petsAllowed,
      stay,
      today,
    });

    const [rowsRes, countRes] = await Promise.all([
      this.db.execute<SummaryRow>(buildSearchQuery(conditions, searchOrderBy(q.sort), q.limit, offset)),
      this.db.execute<{ total: number }>(buildCountQuery(conditions)),
    ]);
    const rows = rowsRes.rows;
    const total = Number(countRes.rows[0]?.total ?? 0);
    const totals = await loadStayTotals(this.db, rows, stay);
    const next = offset + rows.length;

    return {
      items: rows.map((r) => summaryRowToDto(r, stay ? (totals.get(r.id) ?? null) : null)),
      nextCursor: rows.length > 0 && next < total ? encodeCursor(next) : null,
      total,
      center: place ? place.center : null,
      place,
    };
  }

  places(q: string): PlaceDto[] {
    return searchPlaces(q);
  }
}
