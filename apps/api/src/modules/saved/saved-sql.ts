import type { IsoDate, Satang, SavedListingDto } from '@hongwang/shared';
import { sql, type SQL } from 'drizzle-orm';
import { stayAvailableSql, SUMMARY_COLUMNS, summaryRowToDto, type Stay, type SummaryRow } from '../search/search-sql';

export type SavedRow = SummaryRow & { savedAt: Date | string; available: boolean | null };

/** The user's saved, still-published rooms, newest first; `available` is null without dates. */
export function buildSavedQuery(userId: string, stay: Stay | null, today: IsoDate): SQL {
  const available = stay ? stayAvailableSql(stay, today) : sql`NULL::boolean`;
  return sql`
    SELECT ${SUMMARY_COLUMNS}, s.created_at AS "savedAt", ${available} AS available
    FROM saved_listings s
    JOIN listings l ON l.id = s.listing_id
    WHERE s.user_id = ${userId}
      AND l.status = 'published'
      AND l.deleted_at IS NULL
    ORDER BY s.created_at DESC, l.id ASC`;
}

export function savedRowToDto(r: SavedRow, stayTotal: Satang | null): SavedListingDto {
  return {
    ...summaryRowToDto(r, stayTotal),
    savedAt: r.savedAt instanceof Date ? r.savedAt.toISOString() : new Date(r.savedAt).toISOString(),
    available: r.available === null || r.available === undefined ? null : Boolean(r.available),
  };
}
