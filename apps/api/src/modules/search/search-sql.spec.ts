import { PgDialect } from 'drizzle-orm/pg-core';
import { sql, type SQL } from 'drizzle-orm';
import {
  buildCountQuery,
  buildSearchConditions,
  buildSearchQuery,
  displayArea,
  ratingOf,
  resolveStay,
  searchOrderBy,
  stayAvailableSql,
  summaryRowToDto,
  type SearchFilters,
  type SummaryRow,
} from './search-sql';

const dialect = new PgDialect();
const render = (q: SQL) => dialect.sqlToQuery(q);
const renderAll = (conds: SQL[]) => render(sql.join(conds, sql` AND `));
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

const base: SearchFilters = { bbox: null, stay: null, today: '2026-11-15' };

describe('buildSearchConditions', () => {
  it('always limits to published, non-deleted listings with a pin', () => {
    const { sql: text, params } = renderAll(buildSearchConditions(base));
    expect(text).toContain(`l.status = 'published'`);
    expect(text).toContain('l.deleted_at IS NULL');
    expect(text).toContain('l.public_location IS NOT NULL');
    expect(params).toEqual([]);
  });

  it('puts the map box in ST_MakeEnvelope as parameters', () => {
    const { sql: text, params } = renderAll(
      buildSearchConditions({ ...base, bbox: { west: 100.5, south: 13.7, east: 100.6, north: 13.8 } }),
    );
    expect(text).toContain('l.public_location && ST_MakeEnvelope($1::float8, $2::float8, $3::float8, $4::float8, 4326)');
    expect(params).toEqual([100.5, 13.7, 100.6, 13.8]);
  });

  it('binds every filter value instead of concatenating it', () => {
    const { sql: text, params } = renderAll(
      buildSearchConditions({
        ...base,
        guests: 2,
        minPrice: 50000,
        maxPrice: 200000,
        roomTypes: ['private_room', 'entire_place'],
        amenities: ['air_conditioning', 'wifi'],
        instantBook: true,
        nearTransit: true,
        petsAllowed: true,
      }),
    );
    const t = squash(text);
    expect(t).toContain('l.max_guests >= $1');
    expect(t).toContain('l.base_price >= $2');
    expect(t).toContain('l.base_price <= $3');
    expect(t).toContain('l.room_type::text IN ($4, $5)');
    expect(t).toContain('l.amenities @> ARRAY[$6, $7]::text[]');
    expect(t).toContain('l.instant_book = true');
    expect(t).toContain('l.station_walk_minutes <= $8');
    expect(t).toContain(`(l.house_rules->>'pets') = 'true'`);
    expect(params).toEqual([2, 50000, 200000, 'private_room', 'entire_place', 'air_conditioning', 'wifi', 10]);
  });

  it('keeps hostile input as a parameter', () => {
    const evil = "x') OR 1=1 --";
    const { sql: text, params } = renderAll(buildSearchConditions({ ...base, amenities: [evil as never] }));
    expect(text).not.toContain(evil);
    expect(params).toContain(evil);
  });

  it('skips false/empty filters', () => {
    const { sql: text } = renderAll(
      buildSearchConditions({ ...base, instantBook: false, nearTransit: false, petsAllowed: false, roomTypes: [], amenities: [] }),
    );
    expect(text).not.toContain('instant_book');
    expect(text).not.toContain('station_walk_minutes');
    expect(text).not.toContain('room_type');
    expect(text).not.toContain('amenities');
  });

  it('adds date availability when there is a stay', () => {
    const stay = { checkIn: '2026-12-12', checkOut: '2026-12-15', nights: 3 };
    const { sql: text } = renderAll(buildSearchConditions({ ...base, stay }));
    expect(text).toContain('NOT EXISTS');
  });
});

describe('stayAvailableSql', () => {
  const stay = { checkIn: '2026-12-12', checkOut: '2026-12-15', nights: 3 };
  const { sql: text, params } = render(stayAvailableSql(stay, '2026-11-15'));
  const t = squash(text);

  it('checks min/max nights, advance notice and booking window', () => {
    expect(t).toContain('l.min_nights <= $1');
    expect(t).toContain('l.max_nights >= $2');
    expect(t).toContain('$3::date >= $4::date + l.advance_notice_days');
    expect(t).toContain('$5::date <= ($6::date + make_interval(months => l.booking_window_months))::date');
    expect(params.slice(0, 6)).toEqual([3, 3, '2026-12-12', '2026-11-15', '2026-12-15', '2026-11-15']);
  });

  it('excludes overlapping date-holding bookings with NOT EXISTS on the [) daterange', () => {
    expect(t).toMatch(/NOT EXISTS \( SELECT 1 FROM bookings b WHERE b.listing_id = l.id AND b.status IN \(\$7, \$8, \$9\) AND b.stay && daterange\(\$10::date, \$11::date, '\[\)'\) \)/);
    expect(params.slice(6, 11)).toEqual(['payment_hold', 'confirmed', 'completed', '2026-12-12', '2026-12-15']);
  });

  it('excludes host blocks inside the stay', () => {
    expect(t).toContain('NOT EXISTS ( SELECT 1 FROM listing_blocks lb WHERE lb.listing_id = l.id AND lb.date >= $12::date AND lb.date < $13::date )');
  });
});

describe('searchOrderBy', () => {
  it.each([
    ['recommended', 'ln((l.review_count + 2)::float8)) DESC, l.published_at DESC NULLS LAST, l.id ASC'],
    ['price_asc', 'l.base_price ASC, l.id ASC'],
    ['nearest_transit', 'l.station_walk_minutes ASC NULLS LAST'],
    ['top_rated', 'l.rating_avg DESC NULLS LAST'],
  ] as const)('%s', (sort, expected) => {
    expect(render(searchOrderBy(sort)).sql).toContain(expected);
  });
});

describe('search queries', () => {
  it('pages with bound LIMIT/OFFSET and selects the cover photo by position', () => {
    const { sql: text, params } = render(buildSearchQuery(buildSearchConditions({ ...base, guests: 3 }), searchOrderBy('price_asc'), 24, 48));
    const t = squash(text);
    expect(t).toContain('FROM listings l WHERE');
    expect(t).toContain('ORDER BY p.position ASC');
    expect(t).toMatch(/LIMIT \$2 OFFSET \$3$/);
    expect(params).toEqual([3, 24, 48]);
  });

  it('counts with the same conditions', () => {
    const { sql: text, params } = render(buildCountQuery(buildSearchConditions({ ...base, guests: 3 })));
    expect(squash(text)).toContain('SELECT count(*)::int AS total FROM listings l WHERE');
    expect(params).toEqual([3]);
  });
});

describe('resolveStay', () => {
  it('needs both dates', () => {
    expect(resolveStay(undefined, '2026-12-15')).toBeNull();
    expect(resolveStay('2026-12-12', undefined)).toBeNull();
  });
  it('counts nights', () => {
    expect(resolveStay('2026-12-12', '2026-12-15')).toEqual({ checkIn: '2026-12-12', checkOut: '2026-12-15', nights: 3 });
  });
  it('rejects backwards, empty and very long stays', () => {
    expect(() => resolveStay('2026-12-15', '2026-12-12')).toThrow('Check-out must be after check-in');
    expect(() => resolveStay('2026-12-12', '2026-12-12')).toThrow();
    expect(() => resolveStay('2026-01-01', '2027-06-01')).toThrow();
  });
});

describe('summaryRowToDto', () => {
  const row: SummaryRow = {
    id: 'l1',
    title: 'Sunny studio near BTS Ari',
    roomType: 'entire_place',
    propertyType: 'condo',
    area: 'Ari',
    subdistrict: 'Samsen Nai',
    district: 'Phaya Thai',
    nearestStation: 'BTS Ari',
    stationWalkMinutes: 4,
    basePrice: 120000,
    cleaningFee: 30000,
    weeklyDiscountPct: 10,
    ratingAvg: '4.92',
    reviewCount: 38,
    instantBook: true,
    maxGuests: 2,
    lng: 100.5468,
    lat: 13.7815,
    coverPhotoUrl: 'http://x/1.jpg',
  };

  it('maps a raw row to the card DTO', () => {
    expect(summaryRowToDto(row, 360000)).toEqual({
      id: 'l1',
      title: 'Sunny studio near BTS Ari',
      roomType: 'entire_place',
      propertyType: 'condo',
      area: 'Ari',
      transit: { station: 'BTS Ari', walkMinutes: 4 },
      basePrice: 120000,
      stayTotal: 360000,
      rating: 4.92,
      reviewCount: 38,
      instantBook: true,
      coverPhotoUrl: 'http://x/1.jpg',
      location: { lat: 13.7815, lng: 100.5468 },
      maxGuests: 2,
    });
  });

  it('hides the rating without reviews and the transit without minutes', () => {
    const dto = summaryRowToDto({ ...row, reviewCount: 0, ratingAvg: null, stationWalkMinutes: null }, null);
    expect(dto.rating).toBeNull();
    expect(dto.transit).toBeNull();
    expect(dto.stayTotal).toBeNull();
  });

  it('falls back for area and missing pins', () => {
    expect(displayArea({ area: '', subdistrict: 'Talat Noi', district: 'Samphanthawong' })).toBe('Talat Noi');
    expect(displayArea({ area: ' ', subdistrict: null, district: null })).toBe('Bangkok');
    expect(summaryRowToDto({ ...row, lat: null, lng: null }, null).location).toEqual({ lat: 13.7563, lng: 100.5018 });
  });

  it('rounds ratings', () => {
    expect(ratingOf('4.856', 3)).toBe(4.86);
    expect(ratingOf(null, 3)).toBeNull();
  });
});
