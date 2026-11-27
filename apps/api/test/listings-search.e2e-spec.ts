/**
 * Search, availability, saved rooms and the host calendar against real Postgres (implementation
 * plan, M0 5.4): the PostGIS map box, the NOT EXISTS date filters, sorting and paging, special
 * prices in stay totals, and the 409 when a host blocks a booked night.
 *
 *   DATABASE_URL_TEST=postgres://hongwang:hongwang@localhost:5433/hongwang_test pnpm --filter @hongwang/api test:e2e
 */
import { addDays, ERROR_CODES, searchQuerySchema, todayInBangkok, type SearchQuery } from '@hongwang/shared';
import { eq } from 'drizzle-orm';
import { AbilityFactory } from '../src/authz/ability';
import type { AuthUser } from '../src/common/auth';
import { envSchema } from '../src/config/env';
import { listingBlocks } from '../src/database/schema';
import { BookingReadService } from '../src/modules/bookings/booking-read.service';
import { HostService } from '../src/modules/host/host.service';
import { ListingsService } from '../src/modules/listings/listings.service';
import type { NotificationsService } from '../src/modules/notifications/notifications.service';
import { SavedService } from '../src/modules/saved/saved.service';
import { SearchService } from '../src/modules/search/search.service';
import { createBookingTestApp, type BookingTestApp } from './setup/booking-app';
import { SKIP_ENV, testDatabaseUrl, truncateAll } from './setup/database';
import { createListing, createUser } from './setup/fixtures';

const skipReason = process.env[SKIP_ENV];
const describeDb = skipReason ? describe.skip : describe;

/** Points near two seeded neighbourhoods (src/modules/search/places.ts). */
const ARI = { location: { x: 100.5452, y: 13.7801 }, publicLocation: { x: 100.5434, y: 13.7816 } };
const THONG_LO = { location: { x: 100.5801, y: 13.7268 }, publicLocation: { x: 100.5789, y: 13.7281 } };

describeDb('search, availability, saved and host calendar (real Postgres)', () => {
  let app: BookingTestApp;
  let search: SearchService;
  let listingsService: ListingsService;
  let saved: SavedService;
  let hostService: HostService;
  let host: AuthUser;
  let guest: AuthUser;
  const day = (n: number) => addDays(todayInBangkok(), 30 + n);
  const find = (q: SearchQuery) => search.search(searchQuerySchema.parse(q));
  const titles = async (q: SearchQuery) => (await find(q)).items.map((i) => i.title);

  beforeAll(async () => {
    app = await createBookingTestApp(testDatabaseUrl()!);
    const env = envSchema.parse({
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl(),
      JWT_ACCESS_SECRET: 'e2e-access-secret-0123456789abcdef0123',
      JWT_REFRESH_SECRET: 'e2e-refresh-secret-0123456789abcdef012',
    });
    const abilities = new AbilityFactory();
    search = new SearchService(app.db);
    listingsService = new ListingsService(app.db, abilities, { sendEmail: jest.fn() } as unknown as NotificationsService, env);
    saved = new SavedService(app.db, abilities);
    hostService = new HostService(app.db, env, abilities, new BookingReadService(app.db));
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await truncateAll(app.db);
    jest.clearAllMocks();
    host = await createUser(app.db, 'host');
    guest = await createUser(app.db, 'guest');
  });

  describe('search', () => {
    it('finds rooms inside the map box or the place, and nowhere else', async () => {
      await createListing(app.db, host.id, { title: 'Ari studio', ...ARI });
      await createListing(app.db, host.id, { title: 'Thong Lo 1-bed', area: 'Thong Lo', ...THONG_LO });
      await createListing(app.db, host.id, { title: 'Ari draft', status: 'draft', ...ARI });

      expect(await titles({ place: 'thong-lo' })).toEqual(['Thong Lo 1-bed']);
      expect(await titles({ place: 'ari' })).toEqual(['Ari studio']);
      // The map box wins over the place (the guest moved the map).
      expect(await titles({ place: 'ari', bbox: '100.57,13.72,100.59,13.735' })).toEqual(['Thong Lo 1-bed']);
      expect((await titles({ place: 'bangkok' })).sort()).toEqual(['Ari studio', 'Thong Lo 1-bed']);
    });

    it('hides rooms whose nights are held or blocked, but not ones with only a request', async () => {
      const held = await createListing(app.db, host.id, { title: 'Held', ...ARI });
      const blocked = await createListing(app.db, host.id, { title: 'Blocked', ...ARI });
      const requested = await createListing(app.db, host.id, { title: 'Requested', instantBook: false, ...ARI });
      const backToBack = await createListing(app.db, host.id, { title: 'Back to back', ...ARI });
      await createListing(app.db, host.id, { title: 'Free', ...ARI });

      await app.bookings.create(guest, { listingId: held.id, checkIn: day(1), checkOut: day(3), guests: 1 });
      await app.db.insert(listingBlocks).values({ listingId: blocked.id, date: day(2) });
      await app.bookings.create(guest, { listingId: requested.id, checkIn: day(0), checkOut: day(4), guests: 1, message: 'Hi!' });
      // Leaves on the stay's check-in day: no overlap.
      await app.bookings.create(guest, { listingId: backToBack.id, checkIn: day(-2), checkOut: day(0), guests: 1 });

      const stay = { place: 'ari', checkIn: day(0), checkOut: day(4) };
      expect((await titles(stay)).sort()).toEqual(['Back to back', 'Free', 'Requested']);
      // Without dates every published room shows.
      expect(await titles({ place: 'ari' })).toHaveLength(5);
    });

    it('applies guests, price, room type, amenities, instant book and transit filters', async () => {
      await createListing(app.db, host.id, {
        title: 'Big flat',
        maxGuests: 6,
        basePrice: 300000,
        amenities: ['wifi', 'pool'],
        stationWalkMinutes: 15,
        instantBook: false,
        ...ARI,
      });
      await createListing(app.db, host.id, {
        title: 'Small room',
        roomType: 'private_room',
        maxGuests: 1,
        basePrice: 80000,
        amenities: ['wifi'],
        stationWalkMinutes: 3,
        ...ARI,
      });

      expect(await titles({ place: 'ari', guests: 4 })).toEqual(['Big flat']);
      expect(await titles({ place: 'ari', maxPrice: 100000 })).toEqual(['Small room']);
      expect(await titles({ place: 'ari', minPrice: 100000 })).toEqual(['Big flat']);
      expect(await titles({ place: 'ari', roomTypes: 'private_room' })).toEqual(['Small room']);
      expect(await titles({ place: 'ari', amenities: 'wifi,pool' })).toEqual(['Big flat']);
      expect(await titles({ place: 'ari', instantBook: 'true' })).toEqual(['Small room']);
      expect(await titles({ place: 'ari', nearTransit: 'true' })).toEqual(['Small room']);
      await expect(find({ place: 'ari', minPrice: 200000, maxPrice: 100000 })).rejects.toMatchObject({ status: 400 });
    });

    it('sorts by price and rating, and pages with a cursor', async () => {
      await createListing(app.db, host.id, { title: 'Mid', basePrice: 150000, ratingAvg: 4.5, reviewCount: 10, ...ARI });
      await createListing(app.db, host.id, { title: 'Cheap', basePrice: 90000, ratingAvg: 4.9, reviewCount: 3, ...ARI });
      await createListing(app.db, host.id, { title: 'Dear', basePrice: 400000, ratingAvg: null, reviewCount: 0, ...ARI });

      expect(await titles({ place: 'ari', sort: 'price_asc' })).toEqual(['Cheap', 'Mid', 'Dear']);
      expect(await titles({ place: 'ari', sort: 'top_rated' })).toEqual(['Cheap', 'Mid', 'Dear']);

      const first = await find({ place: 'ari', sort: 'price_asc', limit: 2 });
      expect(first.items.map((i) => i.title)).toEqual(['Cheap', 'Mid']);
      expect(first.total).toBe(3);
      expect(first.nextCursor).not.toBeNull();
      const second = await find({ place: 'ari', sort: 'price_asc', limit: 2, cursor: first.nextCursor! });
      expect(second.items.map((i) => i.title)).toEqual(['Dear']);
      expect(second.nextCursor).toBeNull();
    });

    it('prices the stay with the host’s special prices', async () => {
      const listing = await createListing(app.db, host.id, { title: 'Studio', basePrice: 100000, cleaningFee: 20000, ...ARI });
      await hostService.setPrices(host, listing.id, { dates: [day(1)], price: 150000 });

      const [item] = (await find({ place: 'ari', checkIn: day(0), checkOut: day(3) })).items;
      const quote = await app.bookings.quote(guest, { listingId: listing.id, checkIn: day(0), checkOut: day(3), guests: 1 });
      expect(quote.quote.nightsTotal).toBe(100000 + 150000 + 100000);
      // stayTotal is the nights total (ListingSummaryDto), the same number the quote charges for nights.
      expect(item!.stayTotal).toBe(quote.quote.nightsTotal);
    });
  });

  it('availability: held nights, blocks and special prices', async () => {
    const listing = await createListing(app.db, host.id, { basePrice: 120000, ...ARI });
    await app.bookings.create(guest, { listingId: listing.id, checkIn: day(1), checkOut: day(3), guests: 1 });
    await hostService.setBlocks(host, listing.id, { dates: [day(5)], blocked: true });
    await hostService.setPrices(host, listing.id, { dates: [day(6)], price: 200000 });

    const a = await listingsService.availability(listing.id, { from: day(0), to: day(8) }, guest);
    expect(a.unavailable).toEqual([day(1), day(2), day(5)]);
    expect(a.prices[day(0)]).toBe(120000);
    expect(a.prices[day(6)]).toBe(200000);
    await expect(listingsService.availability(listing.id, { from: day(8), to: day(0) }, guest)).rejects.toMatchObject({ status: 400 });
  });

  it('saved: idempotent save and unsave, availability for the dates, and only visible rooms', async () => {
    const free = await createListing(app.db, host.id, { title: 'Free', ...ARI });
    const taken = await createListing(app.db, host.id, { title: 'Taken', ...ARI });
    const draft = await createListing(app.db, host.id, { title: 'Draft', status: 'draft', ...ARI });
    const other = await createUser(app.db, 'other');
    await app.bookings.create(other, { listingId: taken.id, checkIn: day(0), checkOut: day(2), guests: 1 });

    await saved.save(guest, free.id);
    await saved.save(guest, free.id);
    await saved.save(guest, taken.id);
    await expect(saved.save(guest, draft.id)).rejects.toMatchObject({ status: 404 });

    expect((await saved.ids(guest)).sort()).toEqual([free.id, taken.id].sort());
    const withDates = await saved.list(guest, { checkIn: day(0), checkOut: day(2) });
    expect(Object.fromEntries(withDates.map((s) => [s.title, s.available]))).toEqual({ Free: true, Taken: false });
    expect((await saved.list(guest, {})).every((s) => s.available === null)).toBe(true);

    await saved.unsave(guest, free.id);
    await saved.unsave(guest, free.id);
    expect(await saved.ids(guest)).toEqual([taken.id]);
  });

  describe('host calendar', () => {
    it('refuses to block a booked night with 409 and the nights, and blocks free ones', async () => {
      const listing = await createListing(app.db, host.id, { ...ARI });
      await app.bookings.create(guest, { listingId: listing.id, checkIn: day(1), checkOut: day(3), guests: 1 });

      await expect(hostService.setBlocks(host, listing.id, { dates: [day(0), day(2)], blocked: true })).rejects.toMatchObject({
        status: 409,
        code: ERROR_CODES.datesUnavailable,
        details: { dates: [day(2)] },
      });
      expect(await app.db.select().from(listingBlocks).where(eq(listingBlocks.listingId, listing.id))).toHaveLength(0);

      await hostService.setBlocks(host, listing.id, { dates: [day(4), day(5)], blocked: true });
      const state = async (d: string) =>
        (await hostService.calendar(host, { listingId: listing.id, month: d.slice(0, 7) })).days.find((x) => x.date === d)?.state;
      expect([await state(day(1)), await state(day(4)), await state(day(5))]).toEqual(['payment_hold', 'blocked', 'blocked']);
      // A guest can't book a blocked night, and unblocking frees it.
      await expect(
        app.bookings.create(await createUser(app.db, 'late'), { listingId: listing.id, checkIn: day(4), checkOut: day(6), guests: 1 }),
      ).rejects.toMatchObject({ code: ERROR_CODES.datesUnavailable });
      await hostService.setBlocks(host, listing.id, { dates: [day(4), day(5)], blocked: false });
      expect(await app.db.select().from(listingBlocks).where(eq(listingBlocks.listingId, listing.id))).toHaveLength(0);
    });

    it('sets, overwrites and resets special prices', async () => {
      const listing = await createListing(app.db, host.id, { basePrice: 120000, ...ARI });
      const priceOn = async (d: string) => (await listingsService.availability(listing.id, { from: d, to: addDays(d, 1) }, guest)).prices[d];

      await hostService.setPrices(host, listing.id, { dates: [day(1), day(2)], price: 150000 });
      await hostService.setPrices(host, listing.id, { dates: [day(2)], price: 180000 });
      expect([await priceOn(day(1)), await priceOn(day(2))]).toEqual([150000, 180000]);

      // The base price again, or null, removes the special price.
      await hostService.setPrices(host, listing.id, { dates: [day(1)], price: 120000 });
      await hostService.setPrices(host, listing.id, { dates: [day(2)], price: null });
      expect([await priceOn(day(1)), await priceOn(day(2))]).toEqual([120000, 120000]);
    });

    it('only the owner can change the calendar', async () => {
      const listing = await createListing(app.db, host.id, { ...ARI });
      await expect(hostService.setBlocks(guest, listing.id, { dates: [day(1)], blocked: true })).rejects.toMatchObject({ status: 403 });
      await expect(hostService.setPrices(guest, listing.id, { dates: [day(1)], price: 150000 })).rejects.toMatchObject({ status: 403 });
      expect(await app.db.select().from(listingBlocks)).toHaveLength(0);
    });
  });
});
