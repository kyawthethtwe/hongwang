/* eslint-disable no-console */
/**
 * Development seed, based on the people and rooms in the design. Usage: pnpm db:seed
 * Every seeded account signs in with the password in SEED_PASSWORD (dev only).
 * Dates are relative to today so the dashboards always have something to show.
 */
import { existsSync } from 'node:fs';
import { hash } from '@node-rs/argon2';
import {
  addDays,
  PAYMENT_HOLD_TTL_MS,
  quoteStay,
  REQUEST_TTL_MS,
  todayInBangkok,
  type Amenity,
  type BookingStatus,
} from '@hongwang/shared';
import { sql } from 'drizzle-orm';
import { createDatabase } from './database.module';
import * as s from './schema';

export const SEED_PASSWORD = 'hongwang-dev-2026';

type ListingSeed = {
  key: string;
  host: string;
  title: string;
  area: string;
  district: string;
  subdistrict: string;
  lat: number;
  lng: number;
  station: string;
  walk: number;
  price: number; // baht
  cleaning: number;
  instant: boolean;
  rating: number;
  reviews: number;
  roomType?: 'entire_place' | 'private_room' | 'shared_room';
  propertyType?: 'condo' | 'apartment' | 'house' | 'townhouse' | 'shophouse';
  status?: 'published' | 'draft';
  amenities: Amenity[];
  description: string;
};

const LISTINGS: ListingSeed[] = [
  { key: 'studio', host: 'ploy', title: 'Sunny studio near BTS Ari', area: 'Ari', district: 'Phaya Thai', subdistrict: 'Samsen Nai', lat: 13.7801, lng: 100.5452, station: 'BTS Ari', walk: 4, price: 1200, cleaning: 300, instant: true, rating: 4.92, reviews: 38, amenities: ['wifi', 'air_conditioning', 'workspace', 'pool', 'gym', 'keycard_access', 'kitchen'], description: 'A bright corner studio a short walk from BTS Ari and the cafés along Soi Ari 1. Fibre Wi-Fi and a real desk make it easy to work from here, and the building has a pool, a gym and 24-hour keycard access.' },
  { key: 'balcony', host: 'ploy', title: 'Quiet 1-bed with balcony', area: 'Ari', district: 'Phaya Thai', subdistrict: 'Samsen Nai', lat: 13.7836, lng: 100.5481, station: 'BTS Ari', walk: 7, price: 1480, cleaning: 350, instant: false, rating: 4.85, reviews: 21, amenities: ['wifi', 'air_conditioning', 'balcony', 'washer', 'kitchen'], description: 'A calm one-bedroom on a leafy soi with a balcony big enough for morning coffee.' },
  { key: 'loft', host: 'krit', title: 'Loft above a coffee shop', area: 'Saphan Khwai', district: 'Phaya Thai', subdistrict: 'Phaya Thai', lat: 13.7931, lng: 100.5493, station: 'BTS Saphan Khwai', walk: 3, price: 990, cleaning: 200, instant: true, rating: 4.78, reviews: 54, roomType: 'private_room', propertyType: 'shophouse', amenities: ['wifi', 'air_conditioning', 'workspace'], description: 'A converted shophouse loft upstairs from a neighbourhood roastery.' },
  { key: 'teak', host: 'somchai', title: 'Garden room in a teak house', area: 'Pradiphat', district: 'Phaya Thai', subdistrict: 'Phaya Thai', lat: 13.7889, lng: 100.5403, station: 'BTS Saphan Khwai', walk: 10, price: 1900, cleaning: 400, instant: false, rating: 4.96, reviews: 17, roomType: 'private_room', propertyType: 'house', amenities: ['wifi', 'air_conditioning', 'parking', 'hot_water'], description: 'A private room opening onto the garden of an old teak family house.' },
  { key: 'coliving', host: 'krit', title: 'Co-living room with desk', area: 'Ari', district: 'Phaya Thai', subdistrict: 'Samsen Nai', lat: 13.7772, lng: 100.5437, station: 'BTS Ari', walk: 2, price: 750, cleaning: 150, instant: true, rating: 4.7, reviews: 63, roomType: 'private_room', propertyType: 'apartment', amenities: ['wifi', 'air_conditioning', 'workspace', 'washer'], description: 'Your own room with a proper desk in a friendly co-living apartment.' },
  { key: 'corner', host: 'ploy', title: 'Corner suite with city view', area: 'Sanam Pao', district: 'Phaya Thai', subdistrict: 'Samsen Nai', lat: 13.7729, lng: 100.5419, station: 'BTS Sanam Pao', walk: 5, price: 2350, cleaning: 400, instant: false, rating: 4.88, reviews: 29, amenities: ['wifi', 'air_conditioning', 'pool', 'gym', 'tv', 'elevator', 'keycard_access'], description: 'A high-floor corner suite with floor-to-ceiling windows over the city.' },
  { key: 'canal', host: 'krit', title: 'Canal-view room in Bang Rak', area: 'Bang Rak', district: 'Bang Rak', subdistrict: 'Si Phraya', lat: 13.7286, lng: 100.5158, station: 'MRT Sam Yan', walk: 12, price: 1700, cleaning: 300, instant: true, rating: 4.6, reviews: 12, roomType: 'private_room', amenities: ['wifi', 'air_conditioning', 'fridge'], description: 'A room overlooking the canal in the old Bang Rak neighbourhood.' },
  { key: 'riverside', host: 'somchai', title: 'Riverside room in Talat Noi', area: 'Talat Noi', district: 'Samphanthawong', subdistrict: 'Talat Noi', lat: 13.7334, lng: 100.5137, station: 'MRT Hua Lamphong', walk: 9, price: 1550, cleaning: 250, instant: false, rating: 4.9, reviews: 33, roomType: 'private_room', propertyType: 'shophouse', amenities: ['wifi', 'air_conditioning', 'hot_water'], description: 'A restored shophouse room steps from the river and the street-art lanes of Talat Noi.' },
  { key: 'shophouse', host: 'arthit', title: 'Shophouse room in Charoen Krung', area: 'Charoen Krung', district: 'Samphanthawong', subdistrict: 'Talat Noi', lat: 13.7357, lng: 100.5146, station: 'MRT Wat Mangkon', walk: 6, price: 1300, cleaning: 250, instant: false, rating: 0, reviews: 0, roomType: 'private_room', propertyType: 'shophouse', status: 'draft', amenities: ['wifi'], description: '' },
];

const USERS = {
  ploy: { firstName: 'Ploy', lastName: 'Kittisak', email: 'ploy@hongwang.local', phone: '+66811110001', kyc: 'verified', about: 'Designer and long-time Ari resident. Happy to share café tips.' },
  krit: { firstName: 'Krit', lastName: 'Wongsa', email: 'krit@hongwang.local', phone: '+66811110002', kyc: 'verified', about: null },
  somchai: { firstName: 'Somchai', lastName: 'Rattana', email: 'somchai@hongwang.local', phone: '+66811110003', kyc: 'verified', about: null },
  arthit: { firstName: 'Arthit', lastName: 'Thongdee', email: 'arthit@hongwang.local', phone: '+66811110004', kyc: 'pending', about: null },
  daniel: { firstName: 'Daniel', lastName: 'Morris', email: 'daniel@hongwang.local', phone: '+66812345678', kyc: 'none', about: 'Product designer from Singapore. Quiet guest, early riser.' },
  nok: { firstName: 'Nok', lastName: 'Prasert', email: 'nok@hongwang.local', phone: '+66811110006', kyc: 'none', about: null },
  hana: { firstName: 'Hana', lastName: 'Kimura', email: 'hana@hongwang.local', phone: '+66811110007', kyc: 'none', about: null },
  mia: { firstName: 'Mia', lastName: 'Schmidt', email: 'mia@hongwang.local', phone: '+66811110008', kyc: 'none', about: null },
  fern: { firstName: 'Fern', lastName: 'Nattaya', email: 'fern@hongwang.local', phone: '+66811110009', kyc: 'verified', about: 'Trust and safety', role: 'admin' },
} as const;

/** ~250 m deterministic offset so the public pin never reveals the front door. */
const jitter = (lat: number, lng: number, i: number) => ({
  x: lng + 0.0024 * Math.cos(i * 2.4),
  y: lat + 0.0022 * Math.sin(i * 2.4),
});

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ref = (i: number) =>
  `BK-${Array.from({ length: 6 }, (_, k) => REF_ALPHABET[(i * 7 + k * 13 + k * k * 3) % REF_ALPHABET.length]).join('')}`;

async function main() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed in production');
  const url = process.argv[2] ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const { pool, db } = createDatabase(url, 2);

  try {
    await db.execute(sql`
      TRUNCATE booking_events, payments, stripe_events, bookings, saved_listings, listing_price_overrides,
        listing_blocks, listing_photos, listings, notification_preferences, email_log, verification_tokens,
        sessions, users RESTART IDENTITY CASCADE`);

    const passwordHash = await hash(SEED_PASSWORD);
    const now = new Date();
    const userIds: Record<string, string> = {};
    for (const [key, u] of Object.entries(USERS)) {
      const [row] = await db
        .insert(s.users)
        .values({
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          phone: u.phone,
          passwordHash,
          emailVerifiedAt: now,
          phoneVerifiedAt: now,
          kycStatus: u.kyc,
          about: u.about,
          role: 'role' in u ? u.role : 'user',
          hostProfile: ['ploy', 'krit', 'somchai', 'arthit'].includes(key)
            ? { relation: 'owner', roomCount: '2-5', onboardedAt: now.toISOString() }
            : null,
          createdAt: new Date(Date.UTC(2023 + (key.length % 3), key.length % 12, 1)),
        })
        .returning({ id: s.users.id });
      userIds[key] = row!.id;
    }

    const listingIds: Record<string, string> = {};
    const listingRows: Record<string, ListingSeed> = {};
    for (const [i, l] of LISTINGS.entries()) {
      const published = (l.status ?? 'published') === 'published';
      const [row] = await db
        .insert(s.listings)
        .values({
          hostId: userIds[l.host]!,
          status: l.status ?? 'published',
          title: l.title,
          description: l.description,
          roomType: l.roomType ?? 'entire_place',
          propertyType: l.propertyType ?? 'condo',
          sizeSqm: 28 + i * 6,
          maxGuests: l.roomType === 'private_room' ? 2 : 3,
          bedrooms: 1,
          beds: 1,
          bathrooms: 1,
          floor: 3 + i,
          addressLine: `[FULL ADDRESS ${i + 1}]`,
          subdistrict: l.subdistrict,
          district: l.district,
          province: 'Bangkok',
          postcode: '10400',
          area: l.area,
          location: { x: l.lng, y: l.lat },
          publicLocation: jitter(l.lat, l.lng, i + 1),
          nearestStation: l.station,
          stationWalkMinutes: l.walk,
          amenities: l.amenities,
          basePrice: l.price * 100,
          cleaningFee: l.cleaning * 100,
          weeklyDiscountPct: i % 2 === 0 ? 10 : 0,
          instantBook: l.instant,
          minNights: 1,
          maxNights: 90,
          cancellationPolicy: i % 3 === 2 ? 'strict' : 'moderate',
          ratingAvg: l.reviews ? l.rating : null,
          reviewCount: l.reviews,
          publishedAt: published ? now : null,
          submittedAt: published ? now : null,
        })
        .returning({ id: s.listings.id });
      listingIds[l.key] = row!.id;
      listingRows[l.key] = l;
    }

    // A special price and a few blocked nights on the studio calendar.
    const today = todayInBangkok();
    await db.insert(s.listingPriceOverrides).values([
      { listingId: listingIds.studio!, date: addDays(today, 30), price: 150000 },
      { listingId: listingIds.studio!, date: addDays(today, 31), price: 150000 },
    ]);
    await db.insert(s.listingBlocks).values([
      { listingId: listingIds.studio!, date: addDays(today, 18) },
      { listingId: listingIds.studio!, date: addDays(today, 19) },
    ]);

    type BookingSeed = { listing: string; guest: string; status: BookingStatus; from: number; nights: number; message?: string };
    const BOOKINGS: BookingSeed[] = [
      { listing: 'balcony', guest: 'nok', status: 'confirmed', from: 1, nights: 3 },
      { listing: 'studio', guest: 'daniel', status: 'payment_hold', from: 2, nights: 3 },
      { listing: 'studio', guest: 'hana', status: 'confirmed', from: 10, nights: 7 },
      { listing: 'corner', guest: 'daniel', status: 'requested', from: 21, nights: 4, message: 'Hi Ploy, I’m in Bangkok for a design conference. Quiet guest, early riser.' },
      { listing: 'balcony', guest: 'mia', status: 'requested', from: 14, nights: 2, message: 'Could I check in around 16:00?' },
      { listing: 'riverside', guest: 'daniel', status: 'completed', from: -17, nights: 3 },
      { listing: 'studio', guest: 'mia', status: 'completed', from: -30, nights: 4 },
      { listing: 'loft', guest: 'daniel', status: 'cancelled', from: 40, nights: 2 },
    ];
    for (const [i, b] of BOOKINGS.entries()) {
      const l = listingRows[b.listing]!;
      const checkIn = addDays(today, b.from);
      const checkOut = addDays(checkIn, b.nights);
      const q = quoteStay({ checkIn, checkOut, basePrice: l.price * 100, cleaningFee: l.cleaning * 100 });
      const instant = b.status !== 'requested' && l.instant;
      const [row] = await db
        .insert(s.bookings)
        .values({
          ref: ref(i + 1),
          listingId: listingIds[b.listing]!,
          guestId: userIds[b.guest]!,
          hostId: userIds[l.host]!,
          status: b.status,
          checkIn,
          checkOut,
          guests: 2,
          nights: q.nights,
          nightlyPrices: q.nightly,
          nightsSubtotal: q.nightsSubtotal,
          weeklyDiscount: q.weeklyDiscount,
          nightsTotal: q.nightsTotal,
          cleaningFee: q.cleaningFee,
          serviceFee: q.serviceFee,
          total: q.total,
          hostFee: q.hostFee,
          hostPayout: q.hostPayout,
          cancellationPolicy: 'moderate',
          instant,
          message: b.message ?? null,
          requestExpiresAt: b.status === 'requested' ? new Date(now.getTime() + REQUEST_TTL_MS - (i + 1) * 3_600_000) : null,
          holdExpiresAt: b.status === 'payment_hold' ? new Date(now.getTime() + PAYMENT_HOLD_TTL_MS) : null,
          confirmedAt: ['confirmed', 'completed'].includes(b.status) ? now : null,
          completedAt: b.status === 'completed' ? now : null,
          cancelledAt: b.status === 'cancelled' ? now : null,
          cancelledBy: b.status === 'cancelled' ? 'guest' : null,
          cancelReason: b.status === 'cancelled' ? 'My plans changed' : null,
          refundAmount: b.status === 'cancelled' ? q.total : null,
        })
        .returning({ id: s.bookings.id });
      await db.insert(s.bookingEvents).values({ bookingId: row!.id, fromStatus: null, toStatus: b.status, actor: 'system', note: 'seed' });
      if (['confirmed', 'completed', 'cancelled'].includes(b.status)) {
        await db.insert(s.payments).values({
          bookingId: row!.id,
          provider: 'simulated',
          method: 'card',
          status: b.status === 'cancelled' ? 'refunded' : 'succeeded',
          amount: q.total,
          refundedAmount: b.status === 'cancelled' ? q.total : 0,
          last4: '4242',
          paidAt: now,
        });
      }
    }

    await db.insert(s.savedListings).values([
      { userId: userIds.daniel!, listingId: listingIds.teak! },
      { userId: userIds.daniel!, listingId: listingIds.loft! },
    ]);

    console.log(`Seeded ${Object.keys(USERS).length} users, ${LISTINGS.length} listings, ${BOOKINGS.length} bookings.`);
    console.log(`Sign in as daniel@hongwang.local (guest), ploy@hongwang.local (host) or fern@hongwang.local (admin).`);
    console.log(`Password for every seeded account: ${SEED_PASSWORD}`);
  } finally {
    await pool.end();
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
