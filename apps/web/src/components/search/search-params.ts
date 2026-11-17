import { AMENITIES, ROOM_TYPES, SEARCH_SORTS, nightsBetween, type Amenity, type IsoDate, type RoomType, type SearchSort } from '@hongwang/shared';
import {
  createLoader,
  createParser,
  createSerializer,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from 'nuqs/server';

/**
 * Search URL state (nuqs), shared by the server pages (SSR the first page) and client components.
 * Keys match the API query (`/search?place=ari&checkIn=...`), except `minPrice` / `maxPrice`,
 * which are whole baht in the URL (readable) and satang for the API.
 */
const isoDate = createParser<IsoDate>({
  parse: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : null),
  serialize: (v) => v,
});

export const searchParsers = {
  place: parseAsString,
  checkIn: isoDate,
  checkOut: isoDate,
  guests: parseAsInteger,
  minPrice: parseAsInteger,
  maxPrice: parseAsInteger,
  roomTypes: parseAsArrayOf(parseAsStringLiteral(ROOM_TYPES)),
  amenities: parseAsArrayOf(parseAsStringLiteral(AMENITIES)),
  instantBook: parseAsBoolean,
  nearTransit: parseAsBoolean,
  petsAllowed: parseAsBoolean,
  sort: parseAsStringLiteral(SEARCH_SORTS),
  bbox: parseAsString,
};

export type SearchState = inferParserType<typeof searchParsers>;

/** Only the stay part, for the listing page calendar and the saved page. */
export const stayParsers = {
  checkIn: searchParsers.checkIn,
  checkOut: searchParsers.checkOut,
  guests: searchParsers.guests,
};

export const loadSearchParams = createLoader(searchParsers);
/** `serializeSearch(state)` -> '?place=ari&checkIn=...' ('' when empty). */
export const serializeSearch = createSerializer(searchParsers);

/** Query object for GET /search (no cursor/limit). Same input -> same object, so SSR and client share the cache key. */
export type ApiSearchQuery = {
  place?: string;
  bbox?: string;
  checkIn?: IsoDate;
  checkOut?: IsoDate;
  guests?: number;
  minPrice?: number;
  maxPrice?: number;
  roomTypes?: RoomType[];
  amenities?: Amenity[];
  instantBook?: boolean;
  nearTransit?: boolean;
  petsAllowed?: boolean;
  sort?: SearchSort;
};

/** Valid [checkIn, checkOut) from URL state, else null. */
export function stayOf(s: { checkIn: IsoDate | null; checkOut: IsoDate | null }): { checkIn: IsoDate; checkOut: IsoDate; nights: number } | null {
  if (!s.checkIn || !s.checkOut) return null;
  const nights = nightsBetween(s.checkIn, s.checkOut);
  return nights >= 1 && nights <= 365 ? { checkIn: s.checkIn, checkOut: s.checkOut, nights } : null;
}

const BBOX_RE = /^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/;

export function toApiSearchQuery(s: SearchState): ApiSearchQuery {
  const q: ApiSearchQuery = {};
  if (s.place) q.place = s.place;
  if (s.bbox && BBOX_RE.test(s.bbox)) q.bbox = s.bbox;
  const stay = stayOf(s);
  if (stay) {
    q.checkIn = stay.checkIn;
    q.checkOut = stay.checkOut;
  }
  if (s.guests && s.guests >= 1) q.guests = Math.min(16, s.guests);
  if (s.minPrice !== null && s.minPrice > 0) q.minPrice = s.minPrice * 100;
  if (s.maxPrice !== null && s.maxPrice > 0) q.maxPrice = s.maxPrice * 100;
  if (q.minPrice !== undefined && q.maxPrice !== undefined && q.minPrice > q.maxPrice) delete q.maxPrice;
  if (s.roomTypes?.length) q.roomTypes = [...new Set(s.roomTypes)].sort();
  if (s.amenities?.length) q.amenities = [...new Set(s.amenities)].sort();
  if (s.instantBook) q.instantBook = true;
  if (s.nearTransit) q.nearTransit = true;
  if (s.petsAllowed) q.petsAllowed = true;
  if (s.sort && s.sort !== 'recommended') q.sort = s.sort;
  return q;
}

/** Number of active filters (chips), for the empty state. */
export function hasFilters(s: SearchState): boolean {
  return Boolean(
    s.minPrice || s.maxPrice || s.roomTypes?.length || s.amenities?.length || s.instantBook || s.nearTransit || s.petsAllowed,
  );
}

export const CLEARED_FILTERS = {
  minPrice: null,
  maxPrice: null,
  roomTypes: null,
  amenities: null,
  instantBook: null,
  nearTransit: null,
  petsAllowed: null,
} as const;
