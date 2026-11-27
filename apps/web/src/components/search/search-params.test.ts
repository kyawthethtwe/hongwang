import { describe, expect, it } from 'vitest';
import { hasFilters, loadSearchParams, serializeSearch, stayOf, toApiSearchQuery, type SearchState } from './search-params';

const state = (over: Partial<SearchState> = {}): SearchState => ({
  place: null,
  checkIn: null,
  checkOut: null,
  guests: null,
  minPrice: null,
  maxPrice: null,
  roomTypes: null,
  amenities: null,
  instantBook: null,
  nearTransit: null,
  petsAllowed: null,
  sort: null,
  bbox: null,
  ...over,
});

describe('search URL params', () => {
  it('round-trip through the URL', () => {
    const s = state({
      place: 'ari',
      checkIn: '2026-12-12',
      checkOut: '2026-12-15',
      guests: 2,
      roomTypes: ['private_room'],
      amenities: ['wifi', 'pool'],
      instantBook: true,
      sort: 'price_asc',
    });
    const qs = serializeSearch(s);
    expect(qs).toContain('place=ari');
    expect(loadSearchParams(new URLSearchParams(qs))).toEqual(s);
    expect(serializeSearch(state())).toBe('');
  });

  it('drops values the URL can’t hold: bad dates, unknown amenities and sorts', () => {
    const parsed = loadSearchParams(new URLSearchParams('checkIn=2026-13-45&amenities=wifi,jacuzzi&sort=cheapest&guests=two'));
    expect(parsed.checkIn).toBeNull();
    expect(parsed.sort).toBeNull();
    expect(parsed.guests).toBeNull();
    expect(parsed.amenities).toEqual(['wifi']);
  });
});

describe('toApiSearchQuery', () => {
  it('turns baht into satang and keeps only active filters', () => {
    expect(toApiSearchQuery(state({ place: 'ari', minPrice: 800, maxPrice: 2500, sort: 'recommended', instantBook: false }))).toEqual({
      place: 'ari',
      minPrice: 80000,
      maxPrice: 250000,
    });
  });

  it('drops a maximum below the minimum, an invalid map box and an invalid stay', () => {
    expect(
      toApiSearchQuery(state({ minPrice: 3000, maxPrice: 1000, bbox: 'not-a-box', checkIn: '2026-12-15', checkOut: '2026-12-12' })),
    ).toEqual({ minPrice: 300000 });
  });

  it('sorts and dedupes lists, caps guests, and keeps a valid stay and box', () => {
    expect(
      toApiSearchQuery(
        state({
          roomTypes: ['shared_room', 'entire_place', 'shared_room'],
          amenities: ['wifi', 'gym', 'wifi'],
          guests: 40,
          checkIn: '2026-12-12',
          checkOut: '2026-12-15',
          bbox: '100.5,13.7,100.6,13.8',
        }),
      ),
    ).toEqual({
      roomTypes: ['entire_place', 'shared_room'],
      amenities: ['gym', 'wifi'],
      guests: 16,
      checkIn: '2026-12-12',
      checkOut: '2026-12-15',
      bbox: '100.5,13.7,100.6,13.8',
    });
  });

  it('gives the same object for the same state (shared SSR and client cache key)', () => {
    const s = state({ amenities: ['wifi', 'gym'] });
    expect(JSON.stringify(toApiSearchQuery(s))).toBe(JSON.stringify(toApiSearchQuery(state({ amenities: ['gym', 'wifi'] }))));
  });
});

describe('stayOf and hasFilters', () => {
  it('accepts 1 to 365 nights', () => {
    expect(stayOf({ checkIn: '2026-12-12', checkOut: '2026-12-13' })).toEqual({ checkIn: '2026-12-12', checkOut: '2026-12-13', nights: 1 });
    expect(stayOf({ checkIn: '2026-12-12', checkOut: '2026-12-12' })).toBeNull();
    expect(stayOf({ checkIn: '2026-01-01', checkOut: '2027-01-02' })).toBeNull();
    expect(stayOf({ checkIn: '2026-12-12', checkOut: null })).toBeNull();
  });

  it('counts filters but not the place, dates or sort', () => {
    expect(hasFilters(state({ place: 'ari', checkIn: '2026-12-12', sort: 'price_asc' }))).toBe(false);
    expect(hasFilters(state({ nearTransit: true }))).toBe(true);
    expect(hasFilters(state({ amenities: [] }))).toBe(false);
  });
});
