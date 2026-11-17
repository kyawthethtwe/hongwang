import { PgDialect } from 'drizzle-orm/pg-core';
import { buildSavedQuery, savedRowToDto, type SavedRow } from './saved-sql';

const dialect = new PgDialect();
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

describe('saved queries', () => {
  it('lists the user’s published saved rooms, newest first, without availability when no dates', () => {
    const { sql, params } = dialect.sqlToQuery(buildSavedQuery('user-1', null, '2026-11-15'));
    const t = squash(sql);
    expect(t).toContain('FROM saved_listings s JOIN listings l ON l.id = s.listing_id');
    expect(t).toContain('WHERE s.user_id = $1');
    expect(t).toContain(`l.status = 'published'`);
    expect(t).toContain('NULL::boolean AS available');
    expect(t).toContain('ORDER BY s.created_at DESC');
    expect(params).toEqual(['user-1']);
  });

  it('computes availability for the dates', () => {
    const { sql, params } = dialect.sqlToQuery(
      buildSavedQuery('user-1', { checkIn: '2026-12-12', checkOut: '2026-12-15', nights: 3 }, '2026-11-15'),
    );
    expect(sql).toContain('NOT EXISTS');
    expect(params[params.length - 1]).toBe('user-1');
  });

  it('maps rows', () => {
    const row: SavedRow = {
      id: 'l1',
      title: 'Loft above a coffee shop',
      roomType: 'private_room',
      propertyType: 'shophouse',
      area: 'Saphan Khwai',
      subdistrict: null,
      district: null,
      nearestStation: 'BTS Saphan Khwai',
      stationWalkMinutes: 3,
      basePrice: 99000,
      cleaningFee: 20000,
      weeklyDiscountPct: 0,
      ratingAvg: '4.78',
      reviewCount: 54,
      instantBook: true,
      maxGuests: 2,
      lng: 100.55,
      lat: 13.79,
      coverPhotoUrl: null,
      savedAt: new Date('2026-11-01T00:00:00Z'),
      available: false,
    };
    expect(savedRowToDto(row, 297000)).toMatchObject({ id: 'l1', savedAt: '2026-11-01T00:00:00.000Z', available: false, stayTotal: 297000 });
    expect(savedRowToDto({ ...row, available: null }, null).available).toBeNull();
  });
});
