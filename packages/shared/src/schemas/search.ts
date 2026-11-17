import { z } from 'zod';
import { AMENITIES, ROOM_TYPES } from '../enums';
import type { Page } from './common';
import { isoDateSchema } from './common';
import type { LatLng, ListingSummaryDto } from './listings';

/**
 * Search contract. Owner: Listings & Search module.
 * Postgres only (whiteboard: "Postgres, not Elasticsearch"): PostGIS for the map box,
 * NOT EXISTS over date-holding bookings and host blocks for availability.
 *
 *   GET    /search                SearchQuery      -> SearchResultDto
 *   GET    /search/places         PlacesQuery      -> PlaceDto[]     (area autocomplete, built-in Bangkok list)
 *   GET    /saved                 SavedQuery       -> SavedListingDto[]  (dates optional: stayTotal + available)
 *   GET    /saved/ids             -                -> string[]
 *   PUT    /saved/:listingId      -                -> 204
 *   DELETE /saved/:listingId      -                -> 204
 */

const csv = <T extends z.ZodType>(item: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v),
    z.array(item),
  );

/** Query-string boolean: 'true'/'1' -> true, 'false'/'0' -> false (z.coerce.boolean treats 'false' as true). */
const queryBool = z.preprocess(
  (v) => (v === 'true' || v === '1' || v === true ? true : v === 'false' || v === '0' || v === false ? false : v),
  z.boolean(),
);

export const SEARCH_SORTS = ['recommended', 'price_asc', 'nearest_transit', 'top_rated'] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export const searchQuerySchema = z.object({
  /** Map viewport 'west,south,east,north'. When absent, `lat`/`lng` + radius or the place is used. */
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/)
    .optional(),
  /** Place slug from /search/places, e.g. 'ari'. */
  place: z.string().max(60).optional(),
  checkIn: isoDateSchema.optional(),
  checkOut: isoDateSchema.optional(),
  guests: z.coerce.number().int().min(1).max(16).optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(), // satang per night
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  roomTypes: csv(z.enum(ROOM_TYPES)).optional(),
  amenities: csv(z.enum(AMENITIES)).optional(),
  instantBook: queryBool.optional(),
  nearTransit: queryBool.optional(),
  petsAllowed: queryBool.optional(),
  sort: z.enum(SEARCH_SORTS).default('recommended'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});
export type SearchQuery = z.input<typeof searchQuerySchema>;
export type ParsedSearchQuery = z.output<typeof searchQuerySchema>;

export interface SearchResultDto extends Page<ListingSummaryDto> {
  total: number;
  /** Suggested map center/zoom when no bbox was given. */
  center: LatLng | null;
  /** The resolved `place`, when the slug is known (for "Rooms in Ari"). */
  place: PlaceDto | null;
}

export const placesQuerySchema = z.object({ q: z.string().max(60).default('') });
export type PlacesQuery = z.infer<typeof placesQuerySchema>;

export interface PlaceDto {
  slug: string;
  name: string; // "Ari"
  label: string; // "Ari, Bangkok"
  center: LatLng;
  /** 'west,south,east,north' */
  bbox: string;
}

export const savedQuerySchema = z.object({
  checkIn: isoDateSchema.optional(),
  checkOut: isoDateSchema.optional(),
});
export type SavedQuery = z.infer<typeof savedQuerySchema>;

export interface SavedListingDto extends ListingSummaryDto {
  savedAt: string;
  /** For the dates in the query: true when bookable, false when not, null without dates. */
  available: boolean | null;
}
